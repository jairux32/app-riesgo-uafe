import { CONTEXTO_LEGAL_COMPLETO_ECUADOR, CONTROLES_INTERNOS } from '../data/constants';
import { AUDIT_RESPONSE_SCHEMA } from './auditSchema';

const GEMINI_MODEL = 'gemini-2.5-flash';

const getApiKey = () => {
  const key = sessionStorage.getItem('gemini_api_key');
  if (!key) throw new Error('API Key de Gemini no configurada. Guárdela en Ajustes.');
  return key;
};

export const buildPrompt = (datos, scores, factoresResult, controlesResult) => {
  const controlesEvaluados = controlesResult.lista.map(c => {
    const ctrl = CONTROLES_INTERNOS.find(i => i.id === c.id);
    return { ...c, nombre: ctrl ? ctrl.nombre : c.id };
  });

  return `${CONTEXTO_LEGAL_COMPLETO_ECUADOR}

---

CASO A ANALIZAR:

DATOS DEL ACTO NOTARIAL:
- Notaría: ${datos.notaria || 'N/A'} — Notario/a: ${datos.notario || 'N/A'}
- Cliente: ${datos.cliente || 'N/A'} — Identificación: ${datos.cedula || 'N/A'}
- Tipo de acto: ${datos.acto || 'N/A'}
- Valor de la operación: USD ${datos.valor || '0'}
- Origen declarado de fondos: ${datos.origen || 'N/A'}
- Medio de pago: ${datos.medioPago || 'N/A'}
- Actividad económica: ${datos.actividad || 'N/A'}
- ¿Es PEP?: ${datos.esPep ? 'Sí' : 'No'} ${datos.detallePep ? `(${datos.detallePep})` : ''}
- ¿Actúa mediante apoderado?: ${datos.apoderado ? 'Sí' : 'No'}
- Verificado en OFAC: ${datos.ofac ? 'Sí' : 'No'} | ONU: ${datos.onu ? 'Sí' : 'No'} | PEP UAFE: ${datos.pepUafe ? 'Sí' : 'No'}
- Reportes previos UAFE: ${datos.reportesPrevios ? 'Sí' : 'No'}
- Observaciones: ${datos.observaciones || 'Ninguna'}

RESULTADO DE LA MATRIZ DE RIESGO:
- Score Riesgo Inherente: ${scores.inherente}/25
- Nivel de Riesgo: ${scores.nivel}
- Debida Diligencia Requerida: ${scores.diligencia}

DETALLE POR FACTOR:
${factoresResult.map(f => `- ${f.nombre} (peso ${f.peso * 100}%): Score promedio ${f.promedio}/25 → Ponderado ${f.ponderado}`).join('\n')}

EVALUACIÓN DE CONTROLES INTERNOS:
- Efectividad promedio de controles: ${controlesResult.efectividadPromedio * 100}%
- Score Riesgo Residual: ${controlesResult.residual}/25
- Nivel Riesgo Residual: ${controlesResult.nivelResidual}
Controles evaluados:
${controlesEvaluados.map(c => `  • ${c.nombre}: ${c.existe ? 'Existe' : 'NO existe'} — Efectividad: ${c.efectividad}/3`).join('\n')}

---

INSTRUCCIÓN:
Basándote EXCLUSIVAMENTE en la normativa ecuatoriana vigente detallada arriba,
genera un análisis jurídico-normativo del caso en formato JSON estructurado.

El JSON debe incluir EXACTAMENTE las siguientes secciones:

1. "meta": Metadata del análisis (versión, fecha, modelo, confianza)
2. "dictamen": Dictamen formal con niveles de riesgo y resumen ejecutivo
3. "senales_alerta_identificadas": Array de señales de alerta detectadas con evidencia y norma
4. "fundamento_legal": Artículos y resoluciones aplicables con aplicación al caso
5. "obligaciones_activadas": Obligaciones concretas para la notaría con plazos
6. "evaluacion_controles": Evaluación de controles internos (efectivos, deficientes, brechas)
7. "analisis_tipologia": Tipologías de lavado detectadas y factores amplificadores/atenuantes
8. "ros": Análisis sobre si amerita Reporte de Operación Sospechosa
9. "recomendacion_final": Decisión clara (ELEVAR_CON_DILIGENCIAS, SOLICITAR_INFO, o NO_ELEVAR)
10. "evidencias": Lista de evidencias que soportan el análisis
11. "trazabilidad": Metadatos del análisis (factores evaluados, señales verificadas, artículos citados)

IMPORTANTE:
- Usa EXACTAMENTE los códigos de señales de alerta del catálogo (SA01, SA05, etc.)
- Cita artículos específicos de la Ley Orgánica 2024 y resoluciones UAFE
- Sé estrictamente jurídico, objetivo y basado en normativa ecuatoriana vigente
- No inventes hechos, solo analiza los datos proporcionados
- El JSON debe ser válido y seguir el esquema proporcionado
`;
};

export const analizarConGemini = async (promptText) => {
  const apiKey = getApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      temperature: 0.2,
      topP: 0.8,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: AUDIT_RESPONSE_SCHEMA,
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
    const err = await response.json().catch(() => ({}));
    const msg = err.error?.message || `Error HTTP ${response.status}`;
    throw new Error(`Gemini API: ${msg}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini no devolvió texto en la respuesta');

  try {
    return JSON.parse(text);
  } catch (parseError) {
    throw new Error(`Error parsing Gemini response as JSON: ${parseError.message}`, { cause: parseError });
  }
};
