const { onRequest } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentWritten } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { getAuth } = require('firebase-admin/auth');
const { initializeApp } = require('firebase-admin/app');
const crypto = require('node:crypto');
const { CONTEXTO_LEGAL_COMPLETO_ECUADOR } = require('./legalContext');

initializeApp();

const GROQ_API_KEY = defineSecret('GROQ_API_KEY');
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Límites de entrada: evitan abuso de cuota y prompts desmesurados.
const MAX_PROMPT_CHARS = 30000;
const MAX_OUTPUT_TOKENS = 6000;

// Rate limit best-effort por instancia. Para un límite distribuido y exacto
// habría que usar Firestore/Redis; esto frena el abuso trivial sin añadir
// latencia ni lecturas a cada llamada.
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 20);
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000);
const intentosPorUsuario = new Map();

function excedeLimite(uid) {
  const ahora = Date.now();
  const registro = intentosPorUsuario.get(uid);

  if (!registro || ahora - registro.inicio > RATE_LIMIT_WINDOW_MS) {
    intentosPorUsuario.set(uid, { inicio: ahora, cuenta: 1 });
    return false;
  }

  registro.cuenta += 1;

  if (intentosPorUsuario.size > 5000) {
    for (const [clave, valor] of intentosPorUsuario) {
      if (ahora - valor.inicio > RATE_LIMIT_WINDOW_MS) intentosPorUsuario.delete(clave);
    }
  }

  return registro.cuenta > RATE_LIMIT_MAX;
}

// App Check opcional: activar con ENFORCE_APP_CHECK=true cuando la app ya
// tenga registrado su proveedor (reCAPTCHA v3) en Firebase Console.
const APP_CHECK_REQUERIDO = process.env.ENFORCE_APP_CHECK === 'true';

// Orígenes permitidos. Configurar ALLOWED_ORIGINS (separados por coma) con el
// dominio real de la notaría; por defecto solo se aceptan localhost y los
// dominios propios de Firebase Hosting.
const ORIGENES_CONFIGURADOS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(origen => origen.trim())
  .filter(Boolean);

const CORS_ORIGINS = ORIGENES_CONFIGURADOS.length > 0
  ? ORIGENES_CONFIGURADOS
  : [
      /^http:\/\/localhost:\d+$/,
      /^http:\/\/127\.0\.0\.1:\d+$/,
      /^https:\/\/[a-z0-9-]+\.web\.app$/,
      /^https:\/\/[a-z0-9-]+\.firebaseapp\.com$/
    ];

exports.analyzeCase = onRequest(
  { secrets: [GROQ_API_KEY], region: 'us-central1', cors: CORS_ORIGINS },
  async (req, res) => {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Método no permitido' });
        return;
      }

      // Autenticación obligatoria: la Function no puede quedar abierta a Internet.
      const authHeader = req.get('authorization') || '';
      const tokenMatch = /^Bearer\s+(.+)$/i.exec(authHeader);

      if (!tokenMatch) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      let decoded;
      try {
        // El segundo argumento comprueba revocación de tokens/sesión.
        decoded = await getAuth().verifyIdToken(tokenMatch[1], true);
      } catch {
        res.status(401).json({ error: 'Token inválido o expirado' });
        return;
      }

      if (APP_CHECK_REQUERIDO && !req.app) {
        res.status(401).json({ error: 'App Check requerido' });
        return;
      }

      if (excedeLimite(decoded.uid)) {
        res.status(429).json({ error: 'Demasiadas solicitudes. Intente más tarde.' });
        return;
      }

      const { prompt, generationConfig } = req.body || {};

      if (typeof prompt !== 'string' || prompt.trim().length === 0) {
        res.status(400).json({ error: 'Prompt is required' });
        return;
      }

      if (prompt.length > MAX_PROMPT_CHARS) {
        res.status(413).json({
          error: `Prompt demasiado largo (máximo ${MAX_PROMPT_CHARS} caracteres)`
        });
        return;
      }

      const apiKey = GROQ_API_KEY.value();

      const messages = [
        { role: 'system', content: CONTEXTO_LEGAL_COMPLETO_ECUADOR },
        { role: 'user', content: prompt },
      ];

      const body = {
        model: GROQ_MODEL,
        messages,
        temperature: Math.min(Math.max(Number(generationConfig?.temperature ?? 0.2), 0), 1.5),
        top_p: Math.min(Math.max(Number(generationConfig?.topP ?? 0.8), 0), 1),
        max_tokens: Math.min(
          Math.max(Number(generationConfig?.maxOutputTokens ?? 5000), 256),
          MAX_OUTPUT_TOKENS
        ),
        response_format: { type: 'json_object' },
      };

      const response = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const msg = err.error?.message || response.statusText;
        res.status(response.status).json({ error: `Groq API error: ${msg}` });
        return;
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;

      if (!text) {
        res.status(500).json({ error: 'Groq no devolvió contenido' });
        return;
      }

      res.json({ text });
    } catch (error) {
      console.error('Error en analyzeCase:', error);
      res.status(500).json({ error: `Analysis failed: ${error.message}` });
    }
  }
);

exports.notifyHighRiskCase = onDocumentCreated(
  { document: 'cases/{caseId}', region: 'us-central1' },
  async (event) => {
    const caseData = event.data.data();
    const userId = caseData.userId;

    if (!userId) return;

    const inherentScore = caseData.scores?.inherente
      || caseData.inherentScore
      || 0;

    if (inherentScore < 20) return;

    try {
      const db = getFirestore();
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();

      if (!userData?.fcmToken) return;

      const messaging = getMessaging();
      await messaging.send({
        token: userData.fcmToken,
        notification: {
          title: '⚠️ Caso de Riesgo ALTO detectado',
          body: `${caseData.datos?.cliente || 'Cliente'} - Score: ${Math.round(inherentScore)}/25. Requiere evaluación de ROS.`,
        },
        data: {
          caseId: event.data.id,
          score: String(Math.round(inherentScore)),
          clickAction: '/wizard',
        },
      });
    } catch (err) {
      console.error('Error enviando notificación:', err.message);
    }
  }
);

// Audit trail server-side con cadena de hashes.
// Cada escritura en `cases/{caseId}` genera un registro inmutable en
// `audit_logs` y actualiza la cabeza de la cadena en `audit_heads/{caseId}`.
// El cliente no puede escribir en ninguna de las dos colecciones.
const hashAuditoria = (partes) =>
  crypto.createHash('sha256').update(partes.join('|')).digest('hex');

exports.auditCaseChanges = onDocumentWritten(
  { document: 'cases/{caseId}', region: 'us-central1' },
  async (event) => {
    const before = event.data.before;
    const after = event.data.after;
    const caseId = event.params.caseId;

    const action = !before.exists
      ? 'CASO_CREADO'
      : !after.exists
        ? 'CASO_ELIMINADO'
        : 'CASO_ACTUALIZADO';

    const snapshot = after.exists ? after : before;
    const data = snapshot.data() || {};
    const userId = data.userId;

    if (!userId) return;

    const detalles = {
      cliente: data.datos?.cliente || null,
      acto: data.datos?.acto || null,
      estado: data.datos?.estado || null,
      score: data.inherentScore ?? null
    };

    // Resumen de DDC/BF para que el audit trail permita verificar el art. 47
    // sin almacenar datos personales completos.
    const ddc = data.datos?.ddc || {};
    const esJuridica = data.datos?.tipoPersona === 'juridica';
    const beneficiario = data.datos?.beneficiarioFinal || {};
    detalles.ddcCompleta = Boolean(
      ddc.identificacion
      && ddc.proposito
      && ddc.origenFondos
      && (ddc.listas || ddc.listasNoDisponibles)
      && (!esJuridica || (ddc.beneficiarioFinal && beneficiario.nombre && beneficiario.cedula))
    );

    const reportes = data.datos?.reportes || {};
    detalles.reporteResu = reportes.resu?.estado || null;
    detalles.reporteRos = reportes.ros?.estado || null;

    const db = getFirestore();
    const headRef = db.collection('audit_heads').doc(caseId);
    const logRef = db.collection('audit_logs').doc();

    await db.runTransaction(async (tx) => {
      const headSnap = await tx.get(headRef);
      const prevHash = headSnap.exists
        ? (headSnap.get('lastHash') || 'GENESIS')
        : 'GENESIS';
      const timestampIso = new Date().toISOString();
      const hash = hashAuditoria([
        caseId,
        action,
        timestampIso,
        prevHash,
        JSON.stringify(detalles)
      ]);

      tx.set(logRef, {
        caseId,
        userId,
        action,
        details: detalles,
        source: 'server',
        timestampIso,
        prevHash,
        hash,
        timestamp: FieldValue.serverTimestamp()
      });

      tx.set(headRef, {
        caseId,
        userId,
        lastHash: hash,
        updatedAt: FieldValue.serverTimestamp()
      });
    });
  }
);