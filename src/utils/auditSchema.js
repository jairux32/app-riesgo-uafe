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