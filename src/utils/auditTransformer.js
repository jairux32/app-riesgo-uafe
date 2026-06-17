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
    obligations: (auditData.obligaciones_activadas || []).map(ob => ({
      obligacion: ob.obligacion,
      plazo: ob.plazo,
      procedimiento: ob.procedimiento,
      responsable: ob.responsable,
      consecuencia: ob.consecuencia_incumplimiento
    })),

    // Controls evaluation
    controls: {
      effective: (auditData.evaluacion_controles?.controles_efectivos || []).map(c => ({
        id: c.id,
        nombre: c.nombre,
        evaluacion: c.evaluacion
      })),
      deficient: (auditData.evaluacion_controles?.controles_deficientes || []).map(c => ({
        id: c.id,
        nombre: c.nombre,
        evaluacion: c.evaluacion,
        recomendacion: c.recomendacion
      })),
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
