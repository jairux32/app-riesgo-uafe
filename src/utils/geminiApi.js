import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';
import { CONTEXTO_LEGAL_COMPLETO_ECUADOR, CONTROLES_INTERNOS } from '../data/constants';

const functions = getFunctions(app, 'us-central1');
const analyzeCaseFn = httpsCallable(functions, 'analyzeCase');

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
genera un análisis jurídico-normativo del caso en el siguiente formato:

## 1. DICTAMEN DE RIESGO
Emite un dictamen formal sobre el nivel de riesgo LA/FD de este caso, 
fundamentado en los datos y scores calculados.

## 2. SEÑALES DE ALERTA IDENTIFICADAS
Lista las señales de alerta concretas presentes en este caso, citando para 
cada una la norma ecuatoriana que la sustenta. Si no hay señales claras, indícalo.

## 3. FUNDAMENTO LEGAL APLICABLE
Cita los artículos específicos de la Ley, Reglamento y Resoluciones UAFE 
que aplican a este caso concreto.

## 4. OBLIGACIONES ACTIVADAS PARA LA NOTARÍA
Describe de forma concreta y accionable qué debe hacer la notaría en este caso,
con plazos y procedimientos específicos según la normativa ecuatoriana.

## 5. RECOMENDACIÓN FINAL
Emite una recomendación clara:
- ELEVAR LA ESCRITURA con las diligencias indicadas, O
- SOLICITAR INFORMACIÓN ADICIONAL antes de proceder, O  
- NO ELEVAR LA ESCRITURA por riesgo inaceptable

## 6. SOBRE EL REPORTE DE OPERACIÓN SOSPECHOSA (ROS)
${scores.inherente >= 15 ?
      'Analiza si este caso amerita o podría ameritar un ROS a la UAFE, según los criterios de la Resolución UAFE-DG-2023-0689 y la Ley vigente. Indica el procedimiento.' :
      'Indica si podría escalar a ROS ante un cambio en las circunstancias.'}

Recuerda: Tu análisis debe ser estrictamente jurídico, objetivo y basado en 
la normativa ecuatoriana vigente. No inventes hechos, solo analiza los datos 
proporcionados. Usa lenguaje formal apropiado para un documento legal notarial.
`;
};

export const analizarConGemini = async (apiKey, promptText) => {
  const result = await analyzeCaseFn({ prompt: promptText });
  return result.data.text;
};
