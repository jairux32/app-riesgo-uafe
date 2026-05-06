const { onCall } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const GEMINI_MODEL = 'gemini-2.5-flash';

exports.analyzeCase = onCall(
  { secrets: [GEMINI_API_KEY], region: 'us-central1' },
  async (request) => {
    const { prompt } = request.data;

    if (!prompt) {
      throw new Error('Prompt is required');
    }

    try {
      const apiKey = GEMINI_API_KEY.value();
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

      const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          maxOutputTokens: 4096,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(`Gemini API error: ${err.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return { text: data.candidates[0].content.parts[0].text };
    } catch (error) {
      throw new Error(`Analysis failed: ${error.message}`);
    }
  }
);

// Notificación push cuando se crea un caso de riesgo ALTO
exports.notifyHighRiskCase = onDocumentCreated(
  { document: 'cases/{caseId}', region: 'us-central1' },
  async (event) => {
    const caseData = event.data.data();
    const userId = caseData.userId;

    if (!userId || !caseData.evaluaciones) return;

    // Calcular score (lógica simplificada, debe coincidir con el cliente)
    const evals = caseData.evaluaciones;
    let totalScore = 0;
    let count = 0;
    Object.values(evals).forEach(e => {
      if (e.prob && e.imp) {
        totalScore += e.prob * e.imp;
        count++;
      }
    });
    const avgScore = count > 0 ? totalScore / count : 0;

    // Solo notificar si score >= 20 (riesgo ALTO)
    if (avgScore < 20) return;

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
          body: `${caseData.datos?.cliente || 'Cliente'} - Score: ${Math.round(avgScore)}/25. Requiere evaluación de ROS.`,
        },
        data: {
          caseId: event.data.id,
          score: String(Math.round(avgScore)),
          clickAction: '/wizard',
        },
      });
    } catch (err) {
      console.error('Error enviando notificación:', err.message);
    }
  }
);
