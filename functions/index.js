const { onRequest } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { getAuth } = require('firebase-admin/auth');
const { initializeApp } = require('firebase-admin/app');
const { CONTEXTO_LEGAL_COMPLETO_ECUADOR } = require('./legalContext');

initializeApp();

const GROQ_API_KEY = defineSecret('GROQ_API_KEY');
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Límites de entrada: evitan abuso de cuota y prompts desmesurados.
const MAX_PROMPT_CHARS = 30000;
const MAX_OUTPUT_TOKENS = 6000;

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

      try {
        await getAuth().verifyIdToken(tokenMatch[1]);
      } catch {
        res.status(401).json({ error: 'Token inválido o expirado' });
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