# JSON Audit Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a complete JSON audit structure for the Gemini API that combines risk factors and UAFE alert signals into a structured, validated response format.

**Architecture:** Modify `geminiApi.js` to request structured JSON responses using Gemini's `responseMimeType` and `responseSchema` features, update the prompt to request JSON output, and modify downstream consumers to parse the structured response.

**Tech Stack:** JavaScript, Gemini API (gemini-2.5-flash), Vite, React

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/utils/geminiApi.js` | Modify prompt building and API call to request JSON output with schema validation |
| `src/utils/auditSchema.js` | **Create** — JSON schema definition for Gemini response validation |
| `src/utils/auditTransformer.js` | **Create** — Transform structured JSON into display-ready format |
| `src/views/Step4Analisis.jsx` | Modify to render structured JSON response |
| `src/firebase/auditStore.js` | Update to store structured JSON response |
| `src/data/constants.js` | Add JSON schema constants |

---

## Task 1: Create Audit JSON Schema Definition

**Covers:** S2 (Output Layer)

**Files:**
- Create: `src/utils/auditSchema.js`

- [ ] **Step 1: Create the JSON schema file**

```javascript
// src/utils/auditSchema.js

export const AUDIT_RESPONSE_SCHEMA = {
  type: "object",
  required: ["meta", "dictamen", "senales_alerta_identificadas", "fundamento_legal", "obligaciones_activadas", "evaluacion_controles", "analisis_tipologia", "ros", "recomendacion_final", "evidencias", "trazabilidad"],
  properties: {
    meta: {
      type: "object",
      required: ["version", "fecha_analisis", "confianza_global"],
      properties: {
        version: { type: "string" },
        fecha_analisis: { type: "string" },
        modelo_ia: { type: "string" },
        confianza_global: { type: "number", minimum: 0, maximum: 1 }
      }
    },
    dictamen: {
      type: "object",
      required: ["nivel_riesgo_inherente", "nivel_riesgo_residual", "clasificacion_final", "resumen_ejecutivo", "fundamento_score"],
      properties: {
        nivel_riesgo_inherente: { type: "string", enum: ["BAJO", "MEDIO", "MEDIO-ALTO", "ALTO"] },
        nivel_riesgo_residual: { type: "string", enum: ["BAJO", "MEDIO", "MEDIO-ALTO", "ALTO"] },
        clasificacion_final: { type: "string" },
        resumen_ejecutivo: { type: "string", maxLength: 1000 },
        fundamento_score: { type: "string" }
      }
    },
    senales_alerta_identificadas: {
      type: "array",
      items: {
        type: "object",
        required: ["codigo", "descripcion", "categoria", "evidencia", "norma_sustento", "severidad"],
        properties: {
          codigo: { type: "string", pattern: "^SA\\d{2,3}$" },
          descripcion: { type: "string" },
          categoria: { type: "string", enum: ["identidad", "corporativa", "transaccional", "internacional", "bienes_raices", "activos_virtuales", "otra"] },
          evidencia: { type: "string" },
          norma_sustento: { type: "string" },
          severidad: { type: "string", enum: ["baja", "media", "alta", "critica"] }
        }
      }
    },
    fundamento_legal: {
      type: "object",
      required: ["articulos_aplicables", "resoluciones_aplicables", "criterios_gafiat"],
      properties: {
        articulos_aplicables: {
          type: "array",
          items: {
            type: "object",
            required: ["norma", "articulo", "aplicacion_caso"],
            properties: {
              norma: { type: "string" },
              articulo: { type: "string" },
              numeral: { type: "string" },
              texto_referencia: { type: "string" },
              aplicacion_caso: { type: "string" }
            }
          }
        },
        resoluciones_aplicables: {
          type: "array",
          items: {
            type: "object",
            required: ["resolucion", "aplicacion_caso"],
            properties: {
              resolucion: { type: "string" },
              articulo: { type: "string" },
              aplicacion_caso: { type: "string" }
            }
          }
        },
        criterios_gafiat: {
          type: "array",
          items: {
            type: "object",
            required: ["criterio", "aplicacion"],
            properties: {
              criterio: { type: "string" },
              aplicacion: { type: "string" }
            }
          }
        }
      }
    },
    obligaciones_activadas: {
      type: "array",
      items: {
        type: "object",
        required: ["obligacion", "plazo", "procedimiento", "responsable", "consecuencia_incumplimiento"],
        properties: {
          obligacion: { type: "string" },
          plazo: { type: "string" },
          procedimiento: { type: "string" },
          responsable: { type: "string" },
          consecuencia_incumplimiento: { type: "string" }
        }
      }
    },
    evaluacion_controles: {
      type: "object",
      required: ["controles_efectivos", "controles_deficientes", "brechas_criticas", "efectividad_global"],
      properties: {
        controles_efectivos: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "nombre", "evaluacion"],
            properties: {
              id: { type: "string" },
              nombre: { type: "string" },
              evaluacion: { type: "string" }
            }
          }
        },
        controles_deficientes: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "nombre", "evaluacion", "recomendacion"],
            properties: {
              id: { type: "string" },
              nombre: { type: "string" },
              evaluacion: { type: "string" },
              recomendacion: { type: "string" }
            }
          }
        },
        brechas_criticas: { type: "array", items: { type: "string" } },
        efectividad_global: { type: "number", minimum: 0, maximum: 1 }
      }
    },
    analisis_tipologia: {
      type: "object",
      required: ["tipologias_detectadas", "factores_amplificadores", "factores_atenuantes"],
      properties: {
        tipologias_detectadas: {
          type: "array",
          items: {
            type: "object",
            required: ["tipo", "descripcion", "fuente"],
            properties: {
              tipo: { type: "string" },
              descripcion: { type: "string" },
              fuente: { type: "string" }
            }
          }
        },
        factores_amplificadores: { type: "array", items: { type: "string" } },
        factores_atenuantes: { type: "array", items: { type: "string" } }
      }
    },
    ros: {
      type: "object",
      required: ["amerita_ros", "probabilidad_escalada", "justificacion", "plazo_reporte", "procedimiento", "senales_escalada"],
      properties: {
        amerita_ros: { type: "boolean" },
        probabilidad_escalada: { type: "number", minimum: 0, maximum: 1 },
        justificacion: { type: "string" },
        plazo_reporte: { type: "string" },
        procedimiento: { type: "string" },
        senales_escalada: { type: "array", items: { type: "string" } }
      }
    },
    recomendacion_final: {
      type: "object",
      required: ["decision", "fundamento", "acciones_inmediatas", "condiciones_para_proceder", "seguimiento_requerido"],
      properties: {
        decision: { type: "string", enum: ["ELEVAR_CON_DILIGENCIAS", "SOLICITAR_INFO", "NO_ELEVAR"] },
        fundamento: { type: "string" },
        acciones_inmediatas: {
          type: "array",
          items: {
            type: "object",
            required: ["accion", "plazo", "responsable"],
            properties: {
              accion: { type: "string" },
              plazo: { type: "string" },
              responsable: { type: "string" }
            }
          }
        },
        condiciones_para_proceder: { type: "array", items: { type: "string" } },
        seguimiento_requerido: { type: "boolean" },
        proxima_revision: { type: "string" }
      }
    },
    evidencias: {
      type: "array",
      items: {
        type: "object",
        required: ["tipo", "descripcion", "fuente", "fiabilidad", "relevancia"],
        properties: {
          tipo: { type: "string", enum: ["documento", "verificacion", "comportamiento", "datos_externos"] },
          descripcion: { type: "string" },
          fuente: { type: "string" },
          fiabilidad: { type: "string", enum: ["alta", "media", "baja"] },
          relevancia: { type: "string" }
        }
      }
    },
    trazabilidad: {
      type: "object",
      required: ["factores_evaluados", "senales_verificadas", "senales_activadas", "articulos_citados", "metodologia"],
      properties: {
        factores_evaluados: { type: "array", items: { type: "string" } },
        senales_verificadas: { type: "number" },
        senales_activadas: { type: "number" },
        articulos_citados: { type: "number" },
        metodologia: { type: "string" }
      }
    }
  }
};

export const AUDIT_INPUT_SCHEMA = {
  type: "object",
  required: ["datos_acto", "factores_riesgo", "controles", "senales_alerta_uafe", "scores_calculados"],
  properties: {
    datos_acto: {
      type: "object",
      required: ["notaria", "notario", "cliente", "cedula", "acto", "valor", "origen_fondos", "medio_pago", "actividad_economica", "es_pep", "apoderado", "verificaciones", "reportes_previos"],
      properties: {
        notaria: { type: "string" },
        notario: { type: "string" },
        cliente: { type: "string" },
        cedula: { type: "string" },
        acto: { type: "string" },
        valor: { type: "number" },
        origen_fondos: { type: "string" },
        medio_pago: { type: "string" },
        actividad_economica: { type: "string" },
        es_pep: { type: "boolean" },
        detalle_pep: { type: ["string", "null"] },
        apoderado: { type: "boolean" },
        verificaciones: {
          type: "object",
          required: ["ofac", "onu", "pep_uafe"],
          properties: {
            ofac: { type: "boolean" },
            onu: { type: "boolean" },
            pep_uafe: { type: "boolean" }
          }
        },
        reportes_previos: { type: "boolean" },
        observaciones: { type: "string" }
      }
    },
    factores_riesgo: {
      type: "object",
      required: ["cliente", "producto", "canal", "zona", "cumplimiento"],
      properties: {
        cliente: { $ref: "#/$defs/factorRiesgo" },
        producto: { $ref: "#/$defs/factorRiesgo" },
        canal: { $ref: "#/$defs/factorRiesgo" },
        zona: { $ref: "#/$defs/factorRiesgo" },
        cumplimiento: { $ref: "#/$defs/factorRiesgo" }
      }
    },
    controles: {
      type: "object",
      additionalProperties: {
        type: "object",
        required: ["existe", "efectividad"],
        properties: {
          existe: { type: "boolean" },
          efectividad: { type: "number", minimum: 0, maximum: 3 }
        }
      }
    },
    senales_alerta_uafe: {
      type: "object",
      properties: {
        identidad: { type: "array", items: { type: "string" } },
        corporativa: { type: "array", items: { type: "string" } },
        transaccional: { type: "array", items: { type: "string" } },
        internacional: { type: "array", items: { type: "string" } },
        bienes_raices: { type: "array", items: { type: "string" } },
        activos_virtuales: { type: "array", items: { type: "string" } },
        otra: { type: "array", items: { type: "string" } }
      }
    },
    scores_calculados: {
      type: "object",
      required: ["inherente", "nivel", "diligencia", "residual", "nivel_residual", "efectividad_controles"],
      properties: {
        inherent: { type: "number" },
        nivel: { type: "string" },
        diligencia: { type: "string" },
        residual: { type: "number" },
        nivel_residual: { type: "string" },
        efectividad_controles: { type: "number" }
      }
    }
  },
  $defs: {
    factorRiesgo: {
      type: "object",
      required: ["peso", "subcriterios"],
      properties: {
        peso: { type: "number" },
        subcriterios: {
          type: "object",
          additionalProperties: {
            type: "object",
            required: ["valor", "justificacion"],
            properties: {
              valor: { type: "number", minimum: 1, maximum: 5 },
              justificacion: { type: "string" }
            }
          }
        }
      }
    }
  }
};
```

- [ ] **Step 2: Verify the file was created correctly**

Run: `ls -la src/utils/auditSchema.js`
Expected: File exists with correct permissions

---

## Task 2: Modify Gemini API to Request JSON Output

**Covers:** S2 (Output Layer), S3 (Integration Points)

**Files:**
- Modify: `src/utils/geminiApi.js:91-126`

- [ ] **Step 1: Add JSON schema import and modify the API call**

```javascript
// src/utils/geminiApi.js - Add import at top
import { AUDIT_RESPONSE_SCHEMA } from './auditSchema';

// Replace the analizarConGemini function (lines 91-126)
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
  
  // Parse the JSON response
  try {
    return JSON.parse(text);
  } catch (parseError) {
    throw new Error(`Error parsing Gemini response as JSON: ${parseError.message}`);
  }
};
```

- [ ] **Step 2: Verify the file compiles correctly**

Run: `npm run build`
Expected: Build completes without errors

---

## Task 3: Update Prompt to Request JSON Output

**Covers:** S2 (Output Layer), S3 (Integration Points)

**Files:**
- Modify: `src/utils/geminiApi.js:11-89`

- [ ] **Step 1: Modify the buildPrompt function to request JSON output**

```javascript
// src/utils/geminiApi.js - Replace the buildPrompt function (lines 11-89)
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
```

- [ ] **Step 2: Verify the file compiles correctly**

Run: `npm run build`
Expected: Build completes without errors

---

## Task 4: Create Audit Transformer Utility

**Covers:** S2 (Output Layer), S3 (Integration Points)

**Files:**
- Create: `src/utils/auditTransformer.js`

- [ ] **Step 1: Create the transformer utility**

```javascript
// src/utils/auditTransformer.js

/**
 * Transform structured JSON audit response into display-ready format
 */
export const transformAuditForDisplay = (auditData) => {
  if (!auditData) return null;

  return {
    // Header info
    header: {
      fecha: auditData.meta?.fecha_analisis || new Date().toISOString(),
      confianza: auditData.meta?.confianza_global || 0,
      modelo: auditData.meta?.modelo_ia || 'gemini-2.5-flash'
    },

    // Risk levels for display
    riskLevels: {
      inherent: auditData.dictamen?.nivel_riesgo_inherente || 'NO DETERMINADO',
      residual: auditData.dictamen?.nivel_riesgo_residual || 'NO DETERMINADO',
      classification: auditData.dictamen?.clasificacion_final || '',
      summary: auditData.dictamen?.resumen_ejecutivo || ''
    },

    // Alert signals grouped by category
    alertSignals: groupSignalsByCategory(auditData.senales_alerta_identificadas || []),

    // Legal foundation organized by norm type
    legalFoundation: {
      articles: auditData.fundamento_legal?.articulos_aplicables || [],
      resolutions: auditData.fundamento_legal?.resoluciones_aplicables || [],
      gafiatCriteria: auditData.fundamento_legal?.criterios_gafiat || []
    },

    // Obligations with deadlines
    obligations: auditData.obligaciones_activadas || [],

    // Controls evaluation
    controls: {
      effective: auditData.evaluacion_controles?.controles_efectivos || [],
      deficient: auditData.evaluacion_controles?.controles_deficientes || [],
      criticalGaps: auditData.evaluacion_controles?.brechas_criticas || [],
      effectiveness: auditData.evaluacion_controles?.efectividad_global || 0
    },

    // Typology analysis
    typology: {
      detected: auditData.analisis_tipologia?.tipologias_detectadas || [],
      amplifying: auditData.analisis_tipologia?.factores_amplificadores || [],
      mitigating: auditData.analisis_tipologia?.factores_atenuantes || []
    },

    // ROS analysis
    ros: {
      required: auditData.ros?.amerita_ros || false,
      probability: auditData.ros?.probabilidad_escalada || 0,
      justification: auditData.ros?.justificacion || '',
      procedure: auditData.ros?.procedimiento || ''
    },

    // Final recommendation
    recommendation: {
      decision: auditData.recomendacion_final?.decision || 'SOLICITAR_INFO',
      justification: auditData.recomendacion_final?.fundamento || '',
      immediateActions: auditData.recomendacion_final?.acciones_inmediatas || [],
      conditions: auditData.recomendacion_final?.condiciones_para_proceder || [],
      followUpRequired: auditData.recomendacion_final?.seguimiento_requerido || false,
      nextReview: auditData.recomendacion_final?.proxima_revision || ''
    },

    // Evidence list
    evidence: auditData.evidencias || [],

    // Traction metrics
    traction: {
      factorsEvaluated: auditData.trazabilidad?.factores_evaluados || [],
      signalsChecked: auditData.trazabilidad?.senales_verificadas || 0,
      signalsActivated: auditData.trazabilidad?.senales_activadas || 0,
      articlesCited: auditData.trazabilidad?.articulos_citados || 0,
      methodology: auditData.trazabilidad?.metodologia || ''
    }
  };
};

/**
 * Group alert signals by category for display
 */
const groupSignalsByCategory = (signals) => {
  const groups = {
    identidad: [],
    corporativa: [],
    transaccional: [],
    internacional: [],
    bienes_raices: [],
    activos_virtuales: [],
    otra: []
  };

  signals.forEach(signal => {
    if (groups[signal.categoria]) {
      groups[signal.categoria].push(signal);
    }
  });

  return groups;
};

/**
 * Get decision color class for UI
 */
export const getDecisionColorClass = (decision) => {
  switch (decision) {
    case 'ELEVAR_CON_DILIGENCIAS':
      return 'text-amarillo bg-amarillo/10 border-amarillo';
    case 'SOLICITAR_INFO':
      return 'text-naranja bg-naranja/10 border-naranja';
    case 'NO_ELEVAR':
      return 'text-rojo bg-rojo/10 border-rojo';
    default:
      return 'text-gris bg-gris/10 border-gris';
  }
};

/**
 * Get severity color class for UI
 */
export const getSeverityColorClass = (severity) => {
  switch (severity) {
    case 'baja':
      return 'text-verde bg-verde/10';
    case 'media':
      return 'text-amarillo bg-amarillo/10';
    case 'alta':
      return 'text-naranja bg-naranja/10';
    case 'critica':
      return 'text-rojo bg-rojo/10';
    default:
      return 'text-gris bg-gris/10';
  }
};

/**
 * Format confidence percentage for display
 */
export const formatConfidence = (confidence) => {
  return `${Math.round(confidence * 100)}%`;
};
```

- [ ] **Step 2: Verify the file was created correctly**

Run: `ls -la src/utils/auditTransformer.js`
Expected: File exists with correct permissions

---

## Task 5: Update Step4Analisis to Render Structured Response

**Covers:** S2 (Output Layer), S3 (Integration Points)

**Files:**
- Modify: `src/views/Step4Analisis.jsx`

- [ ] **Step 1: Read the current Step4Analisis.jsx to understand its structure**

Run: `head -100 src/views/Step4Analisis.jsx`
Expected: Shows current implementation

- [ ] **Step 2: Update Step4Analisis to use structured JSON**

Based on the current implementation, update the component to:
1. Import `transformAuditForDisplay` from `../utils/auditTransformer`
2. Transform the Gemini response using the transformer
3. Render the structured sections with proper formatting

Key changes needed:
- Replace markdown rendering with structured section rendering
- Add proper error handling for JSON parsing
- Display alert signals by category
- Show legal foundation with proper citations
- Render controls evaluation with effective/deficient/critical gaps
- Display final recommendation with decision color coding

- [ ] **Step 3: Verify the component renders correctly**

Run: `npm run dev`
Expected: Dev server starts without errors

---

## Task 6: Update Audit Store to Store Structured JSON

**Covers:** S2 (Output Layer), S3 (Integration Points)

**Files:**
- Modify: `src/firebase/auditStore.js:9-22`

- [ ] **Step 1: Update logAuditChange to handle structured JSON**

```javascript
// src/firebase/auditStore.js - Update the logAuditChange function
export const logAuditChange = async (caseId, userId, userEmail, action, details = {}) => {
  try {
    // Store structured JSON response if present
    const auditData = details.structuredResponse || null;
    
    await addDoc(collection(db, AUDIT_COLLECTION), {
      caseId,
      userId,
      userEmail,
      action,
      details: {
        ...details,
        // Store structured response separately for easy querying
        structuredResponse: auditData,
        // Store summary fields for quick access
        riskLevel: auditData?.dictamen?.nivel_riesgo_residual || null,
        recommendation: auditData?.recomendacion_final?.decision || null,
        alertCount: auditData?.senales_alerta_identificadas?.length || 0
      },
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error('Error guardando audit log:', err);
  }
};
```

- [ ] **Step 2: Add query function for structured audits**

```javascript
// src/firebase/auditStore.js - Add new function after getCaseAuditHistory
export const getStructuredAuditByCase = async (caseId) => {
  try {
    const q = query(
      collection(db, AUDIT_COLLECTION),
      where('caseId', '==', caseId),
      where('action', '==', AUDIT_ACTIONS.ANALYSIS_GENERATED),
      orderBy('timestamp', 'desc')
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    
    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate().toISOString() || new Date().toISOString()
    };
  } catch (err) {
    console.error('Error obteniendo auditoría estructurada:', err);
    return null;
  }
};
```

- [ ] **Step 3: Verify the file compiles correctly**

Run: `npm run build`
Expected: Build completes without errors

---

## Task 7: Add JSON Schema Constants

**Covers:** S2 (Output Layer)

**Files:**
- Modify: `src/data/constants.js`

- [ ] **Step 1: Add JSON schema constants at the end of constants.js**

```javascript
// src/data/constants.js - Add at the end of the file

// JSON Schema constants for Gemini API structured responses
export const GEMINI_JSON_CONFIG = {
  responseMimeType: "application/json",
  maxOutputTokens: 8192
};

// Decision enum values for recommendation
export const RECOMMENDATION_DECISIONS = {
  ELEVAR_CON_DILIGENCIAS: 'ELEVAR_CON_DILIGENCIAS',
  SOLICITAR_INFO: 'SOLICITAR_INFO',
  NO_ELEVAR: 'NO_ELEVAR'
};

// Severity levels for alert signals
export const ALERT_SEVERITY = {
  BAJA: 'baja',
  MEDIA: 'media',
  ALTA: 'alta',
  CRITICA: 'critica'
};

// Evidence types
export const EVIDENCE_TYPES = {
  DOCUMENTO: 'documento',
  VERIFICACION: 'verificacion',
  COMPORTAMIENTO: 'comportamiento',
  DATOS_EXTERNOS: 'datos_externos'
};

// Reliability levels
export const RELIABILITY_LEVELS = {
  ALTA: 'alta',
  MEDIA: 'media',
  BAJA: 'baja'
};
```

- [ ] **Step 2: Verify the file compiles correctly**

Run: `npm run build`
Expected: Build completes without errors

---

## Task 8: Run Lint and Type Checks

**Covers:** All sections

**Files:**
- All modified files

- [ ] **Step 1: Run ESLint**

Run: `npm run lint`
Expected: No lint errors

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build completes without errors

- [ ] **Step 3: Test the application**

Run: `npm run dev`
Expected: Dev server starts, navigate to Step 4 and verify structured JSON response renders correctly

---

## Self-Review Checklist

- [ ] **Spec coverage:** All sections (S1-S3) are covered by tasks
- [ ] **Placeholder scan:** No TBD/TODO/placeholders found
- [ ] **Type consistency:** All function names, property names, and types match across tasks
- [ ] **Code completeness:** All steps contain actual code blocks
- [ ] **Commands:** All commands are exact with expected output

---

## Execution Handoff

**Recommendation:** Inline execution (3 tightly coupled tasks, shared state)

The tasks are sequential and share state (schema → API → transformer → UI), making inline execution more efficient than subagent dispatch.