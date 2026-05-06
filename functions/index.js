const { onCall } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

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
