import { getAuth } from 'firebase/auth';
import app from '../firebase/config';
import { CONTROLES_INTERNOS } from '../data/constants';
import { validarRespuestaAuditoria } from './auditValidator';

const CF_URL = import.meta.env.VITE_CF_ANALYZE_URL
  || 'https://us-central1-app-riesgo-uafe.cloudfunctions.net/analyzeCase';

/**
 * Describe el estado real de una verificación de listas. Nunca convierte
 * "no configurado" en "verificado": eso producía dictámenes que afirmaban
 * controles que no se habían ejecutado.
 */
function describirVerificacion(datos, clave) {
  const verificacion = datos.verificaciones?.[clave];
  if (!verificacion?.estado || verificacion.estado === 'pendiente') {
    return 'NO VERIFICADO';
  }
  if (verificacion.estado === 'no_configurado') {
    return 'SIN FUENTE CONFIGURADA (no se realizó verificación)';
  }
  const fecha = verificacion.fecha ? ` del ${String(verificacion.fecha).slice(0, 10)}` : '';
  return `${String(verificacion.estado).toUpperCase()}${fecha}`;
}

const SCHEMA_DESCRIPTION = `
Devuelve EXCLUSIVAMENTE un JSON válido (sin texto adicional, sin markdown) con esta estructura exacta:

{
  "meta": {
    "version": "string",
    "fecha_analisis": "ISO 8601",
    "modelo_ia": "string",
    "confianza_global": "number 0-1"
  },
  "dictamen": {
    "nivel_riesgo_inherente": "BAJO | MEDIO | MEDIO-ALTO | ALTO",
    "nivel_riesgo_residual": "BAJO | MEDIO | MEDIO-ALTO | ALTO",
    "clasificacion_final": "string",
    "resumen_ejecutivo": "string (max 1000 chars)",
    "fundamento_score": "string"
  },
  "senales_alerta_identificadas": [
    {
      "codigo": "SA01-SA201 (patrón ^SA\\d{2,3}$)",
      "descripcion": "string",
      "categoria": "identidad | corporativa | transaccional | internacional | bienes_raices | activos_virtuales | otra",
      "evidencia": "string",
      "norma_sustento": "string",
      "severidad": "baja | media | alta | critica"
    }
  ],
  "fundamento_legal": {
    "articulos_aplicables": [
      { "norma": "string", "articulo": "string", "numeral": "string", "texto_referencia": "string", "aplicacion_caso": "string" }
    ],
    "resoluciones_aplicables": [
      { "resolucion": "string", "articulo": "string", "aplicacion_caso": "string" }
    ],
    "criterios_gafiat": [
      { "criterio": "string", "aplicacion": "string" }
    ]
  },
  "obligaciones_activadas": [
    { "obligacion": "string", "plazo": "string", "procedimiento": "string", "responsable": "string", "consecuencia_incumplimiento": "string" }
  ],
  "evaluacion_controles": {
    "controles_efectivos": [{ "id": "string", "nombre": "string", "evaluacion": "string" }],
    "controles_deficientes": [{ "id": "string", "nombre": "string", "evaluacion": "string", "recomendacion": "string" }],
    "brechas_criticas": ["string"],
    "efectividad_global": "number 0-1"
  },
  "analisis_tipologia": {
    "tipologias_detectadas": [{ "tipo": "string", "descripcion": "string", "fuente": "string" }],
    "factores_amplificadores": ["string"],
    "factores_atenuantes": ["string"]
  },
  "ros": {
    "amerita_ros": "boolean",
    "probabilidad_escalada": "number 0-1",
    "justificacion": "string",
    "plazo_reporte": "string",
    "procedimiento": "string",
    "senales_escalada": ["string"]
  },
  "recomendacion_final": {
    "decision": "ELEVAR_CON_DILIGENCIAS | SOLICITAR_INFO | NO_ELEVAR",
    "fundamento": "string",
    "acciones_inmediatas": [{ "accion": "string", "plazo": "string", "responsable": "string" }],
    "condiciones_para_proceder": ["string"],
    "seguimiento_requerido": "boolean",
    "proxima_revision": "string"
  },
  "evidencias": [
    { "tipo": "documento | verificacion | comportamiento | datos_externos", "descripcion": "string", "fuente": "string", "fiabilidad": "alta | media | baja", "relevancia": "string" }
  ],
  "trazabilidad": {
    "factores_evaluados": ["string"],
    "senales_verificadas": "number",
    "senales_activadas": "number",
    "articulos_citados": "number",
    "metodologia": "string"
  }
}
`;

export const buildPrompt = (datos, scores, factoresResult, controlesResult) => {
  const controlesEvaluados = controlesResult.lista.map(c => {
    const ctrl = CONTROLES_INTERNOS.find(i => i.id === c.id);
    return { ...c, nombre: ctrl ? ctrl.nombre : c.id };
  });

  return `CASO A ANALIZAR:

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
- Verificación OFAC: ${describirVerificacion(datos, 'ofac')} | ONU: ${describirVerificacion(datos, 'onu')} | PEP/UAFE: ${describirVerificacion(datos, 'uafe')}
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
Basándote EXCLUSIVAMENTE en la normativa ecuatoriana vigente del contexto legal proporcionado,
genera un análisis jurídico-normativo del caso en formato JSON estructurado.

${SCHEMA_DESCRIPTION}

IMPORTANTE:
- Usa EXACTAMENTE los códigos de señales de alerta del catálogo (SA01, SA05, etc.)
- Cita artículos específicos de la Ley Orgánica 2024 y resoluciones UAFE
- Sé estrictamente jurídico, objetivo y basado en normativa ecuatoriana vigente
- No inventes hechos, solo analiza los datos proporcionados
- Devuelve SOLO el JSON, sin texto adicional ni markdown
`;
};

export const analizarConGemini = async (promptText) => {
  const auth = getAuth(app);
  if (!auth.currentUser) {
    throw new Error('Debe iniciar sesión para usar el análisis con IA');
  }

  const token = await auth.currentUser.getIdToken();

  const response = await fetch(CF_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      prompt: promptText,
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        maxOutputTokens: 5000,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Error HTTP ${response.status}`);
  }

  const result = await response.json();
  const text = result.text;

  if (!text) throw new Error('El servidor no devolvió respuesta de IA');

  try {
    const data = JSON.parse(text);
    const { valido, errores } = validarRespuestaAuditoria(data);

    if (!valido) {
      // Un dictamen incompleto no debe llegar al PDF ni usarse para decidir.
      throw new Error(
        `La IA devolvió un dictamen incompleto (${errores.length} error(es)): ${errores.slice(0, 5).join('; ')}`
      );
    }

    return data;
  } catch (parseError) {
    if (parseError.message.startsWith('La IA devolvió')) throw parseError;
    throw new Error(`Error al procesar respuesta de IA: ${parseError.message}`, { cause: parseError });
  }
};

export { analizarConGemini as analizarConIA };
