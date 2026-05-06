const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const GEMINI_MODEL = 'gemini-2.5-flash';

exports.analyzeCase = functions
  .region('us-central1')
  .runWith({ secrets: ['GEMINI_API_KEY'] })
  .https.onCall(async (data, context) => {
    const { prompt } = data;

    if (!prompt) {
      throw new functions.https.HttpsError('invalid-argument', 'Prompt is required');
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
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

      const responseData = await response.json();
      return { text: responseData.candidates[0].content.parts[0].text };
    } catch (error) {
      throw new functions.https.HttpsError('internal', error.message);
    }
  });
