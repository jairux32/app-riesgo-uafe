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

// Versiones del contexto legal y del contrato de respuesta. Se devuelven con
// cada análisis y quedan en el caso y en el audit trail para poder reproducir
// el dictamen meses después.
const LEGAL_CONTEXT_VERSION = '2026-10-23';
const PROMPT_VERSION_POR_DEFECTO = 'desconocida';

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

// Trazas estructuradas: una línea JSON por evento, que Cloud Logging indexa
// como jsonPayload. Nunca se registra el prompt, el dictamen ni datos del
// cliente: solo métricas y motivos técnicos.
function traza(severity, campos) {
  console.log(JSON.stringify({ severity, logType: 'analyzeCase', ...campos }));
}

// --- Registro de errores del cliente -------------------------------------
//
// La app puede enviar errores no controlados para poder diagnosticarlos sin
// pedirle al usuario que abra la consola. El endpoint es público (los errores
// ocurren antes del login), así que se defiende con:
//
// - lista blanca de campos: no se acepta texto libre ni el caso;
// - redacción de identificaciones, correos y tokens, por si algo se coló;
// - límite de tamaño y rate limit por IP;
// - atribución opcional por ID token, sin bloquear el evento si expiró.

const LOG_RATE_LIMIT_MAX = Number(process.env.LOG_RATE_LIMIT_MAX || 60);
const LOG_RATE_LIMIT_WINDOW_MS = Number(process.env.LOG_RATE_LIMIT_WINDOW_MS || 60 * 1000);
const MAX_EVENTO_BYTES = 16 * 1024;
const intentosLogPorIp = new Map();

const NIVELES_LOG = ['error', 'warn', 'info'];
const CLAVES_CONTEXTO_LOG = [
  'etapa', 'operacion', 'accion', 'codigo', 'codigoHttp', 'duracionMs',
  'modelo', 'promptVersion', 'contextoVersion', 'tipo', 'total', 'intentos',
  'online', 'paso', 'proveedor', 'motivo', 'recurso', 'sincronizados',
  'pendientes', 'caseId', 'nivelRiesgo'
];

const redactarLog = (valor) => String(valor ?? '')
  .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [token]')
  .replace(/(api[_-]?key|token|password|contrase(?:n|ñ)a|clave)\s*[:=]\s*[^\s,;]+/gi, '$1=[oculto]')
  .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[correo]')
  .replace(/\b\d{10,13}\b/g, '[identificacion]');

const textoLog = (valor, maximo) => {
  if (typeof valor !== 'string') return null;
  const limpio = redactarLog(valor).trim();
  if (!limpio) return null;
  return limpio.length > maximo ? `${limpio.slice(0, maximo)}…` : limpio;
};

const limitarContextoLog = (contexto) => {
  if (!contexto || typeof contexto !== 'object' || Array.isArray(contexto)) return {};

  const resultado = {};
  let tamano = 0;

  for (const clave of CLAVES_CONTEXTO_LOG) {
    if (!Object.prototype.hasOwnProperty.call(contexto, clave)) continue;

    const valor = contexto[clave];
    let normalizado = null;

    if (typeof valor === 'number' && Number.isFinite(valor)) normalizado = valor;
    else if (typeof valor === 'boolean') normalizado = valor;
    else if (typeof valor === 'string') normalizado = textoLog(valor, 200);
    else if (Array.isArray(valor)) {
      normalizado = valor
        .slice(0, 10)
        .map(item => (typeof item === 'string' || typeof item === 'number'
          ? (typeof item === 'number' ? item : textoLog(item, 200))
          : null))
        .filter(item => item !== null);
    }

    if (normalizado === null) continue;

    const costo = JSON.stringify({ [clave]: normalizado }).length;
    if (tamano + costo > 1500) break;

    resultado[clave] = normalizado;
    tamano += costo;
  }

  return resultado;
};

/**
 * Devuelve el evento saneado o `null` si no es un error legible. No confía en
 * nada de lo que llega: el formato lo controla el cliente.
 */
function validarEventoCliente(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;

  const mensaje = textoLog(body.mensaje, 500);
  if (!mensaje) return null;

  return {
    nivel: NIVELES_LOG.includes(body.nivel) ? body.nivel : 'error',
    origen: textoLog(body.origen, 40) || 'cliente',
    mensaje,
    nombreError: textoLog(body.nombreError, 80),
    stack: textoLog(body.stack, 2000),
    contexto: limitarContextoLog(body.contexto),
    idSesion: textoLog(body.idSesion, 64),
    ruta: textoLog(body.ruta, 200),
    agente: textoLog(body.agente, 120),
    version: textoLog(body.version, 40),
    ocurridoEnCliente: textoLog(body.ocurridoEn, 40)
  };
}

function excedeLimiteLog(ip) {
  const ahora = Date.now();
  const clave = String(ip || 'sin-ip');
  const registro = intentosLogPorIp.get(clave);

  if (!registro || ahora - registro.inicio > LOG_RATE_LIMIT_WINDOW_MS) {
    intentosLogPorIp.set(clave, { inicio: ahora, cuenta: 1 });
    return false;
  }

  registro.cuenta += 1;

  if (intentosLogPorIp.size > 5000) {
    for (const [otraClave, valor] of intentosLogPorIp) {
      if (ahora - valor.inicio > LOG_RATE_LIMIT_WINDOW_MS) intentosLogPorIp.delete(otraClave);
    }
  }

  return registro.cuenta > LOG_RATE_LIMIT_MAX;
}

exports.analyzeCase = onRequest(
  { secrets: [GROQ_API_KEY], region: 'us-central1', cors: CORS_ORIGINS },
  async (req, res) => {
    const inicio = Date.now();
    let uid = null;

    try {
      if (req.method !== 'POST') {
        traza('WARNING', { resultado: 'rechazado', motivo: 'metodo', duracionMs: Date.now() - inicio });
        res.status(405).json({ error: 'Método no permitido' });
        return;
      }

      // Autenticación obligatoria: la Function no puede quedar abierta a Internet.
      const authHeader = req.get('authorization') || '';
      const tokenMatch = /^Bearer\s+(.+)$/i.exec(authHeader);

      if (!tokenMatch) {
        traza('WARNING', { resultado: 'rechazado', motivo: 'sin_token', duracionMs: Date.now() - inicio });
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      let decoded;
      try {
        // El segundo argumento comprueba revocación de tokens/sesión.
        decoded = await getAuth().verifyIdToken(tokenMatch[1], true);
      } catch {
        traza('WARNING', { resultado: 'rechazado', motivo: 'token_invalido', duracionMs: Date.now() - inicio });
        res.status(401).json({ error: 'Token inválido o expirado' });
        return;
      }

      uid = decoded.uid;

      if (APP_CHECK_REQUERIDO && !req.app) {
        traza('WARNING', { resultado: 'rechazado', motivo: 'app_check', uid, duracionMs: Date.now() - inicio });
        res.status(401).json({ error: 'App Check requerido' });
        return;
      }

      if (excedeLimite(decoded.uid)) {
        traza('WARNING', { resultado: 'rechazado', motivo: 'rate_limit', uid, duracionMs: Date.now() - inicio });
        res.status(429).json({ error: 'Demasiadas solicitudes. Intente más tarde.' });
        return;
      }

      const { prompt, generationConfig, promptVersion } = req.body || {};

      if (typeof prompt !== 'string' || prompt.trim().length === 0) {
        traza('WARNING', { resultado: 'rechazado', motivo: 'prompt_invalido', uid, duracionMs: Date.now() - inicio });
        res.status(400).json({ error: 'Prompt is required' });
        return;
      }

      if (prompt.length > MAX_PROMPT_CHARS) {
        traza('WARNING', {
          resultado: 'rechazado',
          motivo: 'prompt_largo',
          uid,
          total: prompt.length,
          duracionMs: Date.now() - inicio
        });
        res.status(413).json({
          error: `Prompt demasiado largo (máximo ${MAX_PROMPT_CHARS} caracteres)`
        });
        return;
      }

      const versionPrompt = typeof promptVersion === 'string' && promptVersion.length <= 50
        ? promptVersion
        : PROMPT_VERSION_POR_DEFECTO;

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
        traza('ERROR', {
          resultado: 'error_proveedor',
          motivo: String(msg).slice(0, 200),
          codigoHttp: response.status,
          uid,
          duracionMs: Date.now() - inicio
        });
        res.status(response.status).json({ error: `Groq API error: ${msg}` });
        return;
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;

      if (!text) {
        traza('ERROR', {
          resultado: 'sin_contenido',
          motivo: 'respuesta_vacia',
          uid,
          duracionMs: Date.now() - inicio
        });
        res.status(500).json({ error: 'Groq no devolvió contenido' });
        return;
      }

      traza('INFO', {
        resultado: 'ok',
        uid,
        modelo: GROQ_MODEL,
        promptVersion: versionPrompt,
        contextoVersion: LEGAL_CONTEXT_VERSION,
        total: text.length,
        duracionMs: Date.now() - inicio
      });

      res.json({
        text,
        meta: {
          modelo: GROQ_MODEL,
          contextoVersion: LEGAL_CONTEXT_VERSION,
          promptVersion: versionPrompt,
          generadoEn: new Date().toISOString()
        }
      });
    } catch (error) {
      traza('ERROR', {
        resultado: 'excepcion',
        motivo: String(error.message).slice(0, 200),
        uid,
        duracionMs: Date.now() - inicio
      });
      console.error('Error en analyzeCase:', error);
      res.status(500).json({ error: `Analysis failed: ${error.message}` });
    }
  }
);

// Registro de errores del cliente. No requiere sesión (un fallo puede ocurrir
// antes del login), pero el evento se sanea y se acota; si llega un ID token
// válido se atribuye al usuario. El cuerpo del caso nunca se acepta.
exports.logClientError = onRequest(
  { region: 'us-central1', cors: CORS_ORIGINS },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Método no permitido' });
      return;
    }

    const ip = req.ip || String(req.get('x-forwarded-for') || '').split(',')[0].trim();

    if (excedeLimiteLog(ip)) {
      res.status(429).json({ error: 'Demasiadas solicitudes' });
      return;
    }

    const declarado = Number(req.get('content-length'));
    if (Number.isFinite(declarado) && declarado > MAX_EVENTO_BYTES) {
      res.status(413).json({ error: 'Evento demasiado grande' });
      return;
    }

    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json({ error: 'Evento inválido' });
      return;
    }

    if (Buffer.byteLength(JSON.stringify(req.body), 'utf8') > MAX_EVENTO_BYTES) {
      res.status(413).json({ error: 'Evento demasiado grande' });
      return;
    }

    const evento = validarEventoCliente(req.body);
    if (!evento) {
      res.status(400).json({ error: 'Evento inválido' });
      return;
    }

    let uid = null;
    const tokenMatch = /^Bearer\s+(.+)$/i.exec(req.get('authorization') || '');
    if (tokenMatch) {
      try {
        // Sin comprobar revocación: un error no debe perderse ni demorar por
        // una consulta extra, y el peor caso es atribuirlo a una sesión vieja.
        uid = (await getAuth().verifyIdToken(tokenMatch[1])).uid;
      } catch {
        uid = null;
      }
    }

    const severity = evento.nivel === 'error'
      ? 'ERROR'
      : evento.nivel === 'warn' ? 'WARNING' : 'INFO';

    console.log(JSON.stringify({
      severity,
      logType: 'cliente',
      uid,
      ...evento,
      ocurridoEn: new Date().toISOString()
    }));

    res.status(204).end();
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
    const cadena = Array.isArray(data.datos?.cadenaPropiedad) ? data.datos.cadenaPropiedad : [];
    const cadenaCompleta = cadena.every((nivel) => {
      const porcentaje = Number(nivel?.porcentaje);
      return String(nivel?.nombre || '').trim()
        && String(nivel?.identificacion || '').trim()
        && Number.isFinite(porcentaje)
        && porcentaje > 0
        && porcentaje <= 100;
    });
    detalles.cadenaPropiedadNiveles = cadena.length;
    detalles.cadenaPropiedadCompleta = cadena.length === 0 ? null : cadenaCompleta;

    // Fichas de revisión de coincidencias en listas: permiten demostrar que
    // un falso positivo fue descartado con fundamento y por quién.
    const verificaciones = data.datos?.verificaciones || {};
    const coincidencias = Object.entries(verificaciones)
      .filter(([, verificacion]) =>
        verificacion?.estado === 'posible' || verificacion?.estado === 'coincidencia'
      )
      .map(([tipo, verificacion]) => ({
        tipo,
        estado: verificacion.estado,
        decision: verificacion.revision?.decision || null,
        revisor: verificacion.revision?.revisor || null,
        fecha: verificacion.revision?.fecha || null,
        justificacion: verificacion.revision?.justificacion || null
      }));
    detalles.coincidenciasListas = coincidencias.length;
    detalles.coincidenciasRevisadas = coincidencias.filter(c => c.decision).length;
    detalles.coincidenciasConfirmadas = coincidencias.filter(c => c.decision === 'confirmado').length;
    detalles.revisionCoincidencias = coincidencias;

    // Comparación con el perfil transaccional del cliente, si se evaluó.
    const evaluacionPerfil = data.datos?.perfilTransaccionalEvaluacion;
    if (evaluacionPerfil) {
      detalles.perfilTransaccional = {
        nivel: evaluacionPerfil.nivel || null,
        alertas: (evaluacionPerfil.alertas || []).map(a => a?.codigo).filter(Boolean),
        evaluadoEn: evaluacionPerfil.evaluadoEn || null
      };
    }

    // Expediente documental: el audit trail conserva los hashes SHA-256 para
    // demostrar qué archivos sustentaron la diligencia sin almacenar su
    // contenido (que permanece solo en el dispositivo del usuario).
    const evidencias = Array.isArray(data.datos?.evidencias) ? data.datos.evidencias : [];
    const hashSha256 = /^[a-f0-9]{64}$/;
    detalles.evidencias = {
      total: evidencias.length,
      tipos: [...new Set(evidencias.map(e => e?.tipo).filter(Boolean))],
      hashesValidos: evidencias.filter(e => hashSha256.test(String(e?.hash || ''))).length,
      archivos: evidencias.map(e => ({
        tipo: e?.tipo || null,
        nombre: e?.nombre || null,
        hash: e?.hash || null,
        tamano: Number(e?.tamano) || 0,
        cargadaEn: e?.cargadaEn || null
      }))
    };
    detalles.ddcCompleta = Boolean(
      ddc.identificacion
      && ddc.proposito
      && ddc.origenFondos
      && (ddc.listas || ddc.listasNoDisponibles)
      && coincidencias.every(c => c.decision)
      && cadenaCompleta
      && (!esJuridica || (ddc.beneficiarioFinal && beneficiario.nombre && beneficiario.cedula))
    );

    const reportes = data.datos?.reportes || {};
    detalles.reporteResu = reportes.resu?.estado || null;
    detalles.reporteRos = reportes.ros?.estado || null;

    // Trazabilidad del dictamen: permite reproducir qué modelo, prompt y
    // contexto legal se usaron cuando se generó el análisis.
    const metaIA = data.analysis?._meta;
    if (metaIA) {
      detalles.modeloIA = metaIA.modelo || null;
      detalles.promptVersion = metaIA.promptVersion || null;
      detalles.contextoVersion = metaIA.contextoVersion || null;
      detalles.analisisGeneradoEn = metaIA.generadoEn || null;
    }

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