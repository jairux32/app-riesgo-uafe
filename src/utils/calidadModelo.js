// Tablero de calidad y calibración del modelo de riesgo.
//
// No existe una "verdad de referencia" etiquetada, así que la app no puede
// afirmar tasas reales de falsos positivos o negativos. Lo que sí puede hacer
// es señalar casos donde el score y la decisión de reporte no coinciden:
//
// - posible subestimación: score bajo (< 20) pero se envió un ROS;
// - posible sobreestimación: score alto (≥ 20) pero se envió un NO-ROS;
// - riesgo alto sin decisión de reporte.
//
// Son señales para revisión humana, no conclusiones automáticas. También se
// resume la cobertura del análisis de IA, las versiones usadas y el tiempo de
// cierre, para detectar deriva del modelo o cuellos de botella.

import { calculateInherentRisk } from './calculations';
import { estadoVencimiento } from './obligaciones';

export const UMBRAL_ROS = 20;

export const NIVELES_RIESGO = [
  { id: 'bajo', etiqueta: 'Bajo', min: 0, max: 8 },
  { id: 'medio', etiqueta: 'Medio', min: 9, max: 14 },
  { id: 'medio_alto', etiqueta: 'Medio-Alto', min: 15, max: 19 },
  { id: 'alto', etiqueta: 'Alto', min: 20, max: 25 }
];

const MS_DIA = 24 * 60 * 60 * 1000;
const ESTADOS_CERRADOS = ['aprobado', 'reportado_uafe'];
const ESTADOS_ENVIADOS = ['enviado', 'acuse_recibido'];

const aNumero = (valor) => {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
};

const redondear = (valor, decimales = 1) => {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
};

const promedio = (valores) => (valores.length === 0
  ? 0
  : valores.reduce((total, valor) => total + valor, 0) / valores.length);

const mediana = (valores) => {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0
    ? (ordenados[mitad - 1] + ordenados[mitad]) / 2
    : ordenados[mitad];
};

const aFecha = (valor) => {
  if (!valor) return null;
  const fecha = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

/**
 * Score inherente del caso. Se prefiere el valor guardado y, si falta, se
 * recalcula a partir de las evaluaciones.
 */
export const scoreDeCaso = (caso) => {
  const guardado = aNumero(caso?.inherentScore);
  if (guardado !== null) return guardado;
  if (caso?.evaluaciones && Object.keys(caso.evaluaciones).length > 0) {
    return calculateInherentRisk(caso.evaluaciones).inherente;
  }
  return null;
};

export const nivelDeScore = (score) => {
  const valor = aNumero(score);
  if (valor === null) return null;
  return NIVELES_RIESGO.find(nivel => valor >= nivel.min && valor <= nivel.max) || null;
};

/**
 * Estado del reporte ROS/NO-ROS del caso. `reportado_uafe` se toma como ROS
 * enviado cuando no hay un reporte explícito.
 */
export const estadoReporteRos = (caso) => {
  const datos = caso?.datos || {};
  const ros = datos.reportes?.ros || {};

  if (ESTADOS_ENVIADOS.includes(ros.estado)) {
    return ros.tipo === 'NO-ROS' ? 'no_ros' : 'ros';
  }
  if (ros.estado === 'no_aplica') return 'no_aplica';
  if (datos.estado === 'reportado_uafe') return 'ros';
  return 'pendiente';
};

const resumenCaso = (caso) => ({
  id: caso?.id || null,
  cliente: caso?.datos?.cliente || 'Sin nombre',
  acto: caso?.datos?.acto || '—',
  score: scoreDeCaso(caso)
});

const diasEntre = (desde, hasta) => {
  const inicio = aFecha(desde);
  const fin = aFecha(hasta);
  if (!inicio || !fin) return null;
  return Math.max(0, Math.round((fin - inicio) / MS_DIA));
};

/**
 * Calcula el tablero de calidad.
 *
 * @param {Array<object>} casos Historial completo (sin filtrar por fecha)
 * @param {{hoy?: string|Date, umbralRos?: number, muestraMinima?: number}} opciones
 */
export const calcularCalidadModelo = (casos = [], opciones = {}) => {
  const hoy = aFecha(opciones.hoy) || new Date();
  const umbralRos = opciones.umbralRos ?? UMBRAL_ROS;
  const muestraMinima = opciones.muestraMinima ?? 5;

  const lista = Array.isArray(casos) ? casos.filter(Boolean) : [];
  const conScore = lista
    .map(caso => ({ caso, score: scoreDeCaso(caso) }))
    .filter(item => item.score !== null);

  const distribucion = NIVELES_RIESGO.map(nivel => {
    const count = conScore.filter(item => item.score >= nivel.min && item.score <= nivel.max).length;
    return {
      ...nivel,
      count,
      porcentaje: conScore.length > 0 ? redondear((count / conScore.length) * 100) : 0
    };
  });

  const conAnalisisIA = lista.filter(caso => Boolean(caso.analysis && typeof caso.analysis === 'object'));
  const versiones = new Map();

  conAnalisisIA.forEach(caso => {
    const meta = caso.analysis?._meta;
    const clave = meta
      ? `${meta.modelo || 'modelo sin identificar'} · prompt ${meta.promptVersion || '—'} · contexto ${meta.contextoVersion || '—'}`
      : 'Sin metadata de versión';
    versiones.set(clave, (versiones.get(clave) || 0) + 1);
  });

  const posiblesSubestimaciones = [];
  const posiblesSobreestimaciones = [];
  const riesgoAltoSinDecision = [];
  let rosEnviados = 0;
  let noRosEnviados = 0;
  let rosVencidos = 0;

  lista.forEach(caso => {
    const score = scoreDeCaso(caso);
    const reporte = estadoReporteRos(caso);
    const resumen = { ...resumenCaso(caso), reporte };

    if (reporte === 'ros') rosEnviados += 1;
    if (reporte === 'no_ros') noRosEnviados += 1;

    if (score !== null && score < umbralRos && reporte === 'ros') {
      posiblesSubestimaciones.push({
        ...resumen,
        severidad: score <= 14 ? 'alta' : 'media',
        motivo: `Score ${score}/25 (por debajo de ${umbralRos}) pero el caso tiene ROS enviado.`
      });
    }

    if (score !== null && score >= umbralRos && reporte === 'no_ros') {
      posiblesSobreestimaciones.push({
        ...resumen,
        severidad: 'media',
        motivo: `Score ${score}/25 (≥ ${umbralRos}) pero se registró un NO-ROS.`
      });
    }

    const estadoCaso = caso.datos?.estado || 'borrador';
    if (
      score !== null
      && score >= umbralRos
      && reporte === 'pendiente'
      && ['en_revision', 'aprobado'].includes(estadoCaso)
    ) {
      riesgoAltoSinDecision.push({
        ...resumen,
        severidad: 'alta',
        motivo: `Score ${score}/25 sin decisión de ROS/NO-ROS registrada.`
      });
    }

    if (score !== null && score >= umbralRos && ['pendiente', 'preparado'].includes(caso.datos?.reportes?.ros?.estado)) {
      const vencimiento = estadoVencimiento(caso.datos?.reportes?.ros?.fechaLimite, hoy);
      if (['vencida', 'vence_hoy'].includes(vencimiento.estado)) rosVencidos += 1;
    }
  });

  const cerrados = lista.filter(caso => ESTADOS_CERRADOS.includes(caso.datos?.estado));
  const diasCierre = cerrados
    .map(caso => diasEntre(caso.createdAt, caso.updatedAt))
    .filter(dias => dias !== null);

  const alertas = [];
  if (conScore.length === 0) {
    alertas.push({
      tipo: 'sin_datos',
      severidad: 'baja',
      mensaje: 'Aún no hay casos evaluados: el tablero necesita al menos un score para mostrar métricas.'
    });
  } else if (conScore.length < muestraMinima) {
    alertas.push({
      tipo: 'muestra_insuficiente',
      severidad: 'baja',
      mensaje: `Solo hay ${conScore.length} caso(s) evaluado(s); con menos de ${muestraMinima} las tasas son indicativas.`
    });
  }

  if (posiblesSubestimaciones.length > 0) {
    alertas.push({
      tipo: 'posible_subestimacion',
      severidad: posiblesSubestimaciones.some(item => item.severidad === 'alta') ? 'alta' : 'media',
      mensaje: `${posiblesSubestimaciones.length} caso(s) con score bajo tienen ROS enviado: revise señales no capturadas o justificaciones cualitativas.`
    });
  }

  if (posiblesSobreestimaciones.length > 0) {
    alertas.push({
      tipo: 'posible_sobreestimacion',
      severidad: 'media',
      mensaje: `${posiblesSobreestimaciones.length} caso(s) con score alto registran NO-ROS: documente la justificación o recalibre los pesos.`
    });
  }

  if (riesgoAltoSinDecision.length > 0) {
    alertas.push({
      tipo: 'riesgo_alto_sin_decision',
      severidad: 'alta',
      mensaje: `${riesgoAltoSinDecision.length} caso(s) de riesgo alto no tienen decisión de ROS/NO-ROS.`
    });
  }

  if (rosVencidos > 0) {
    alertas.push({
      tipo: 'ros_vencido',
      severidad: 'alta',
      mensaje: `${rosVencidos} caso(s) de riesgo alto tienen el ROS vencido o vence hoy.`
    });
  }

  const coberturaIA = conScore.length > 0
    ? redondear((conAnalisisIA.length / conScore.length) * 100)
    : 0;

  if (conScore.length > 0 && coberturaIA < 50) {
    alertas.push({
      tipo: 'cobertura_ia',
      severidad: 'media',
      mensaje: `Solo el ${coberturaIA}% de los casos evaluados tiene dictamen de IA guardado.`
    });
  }

  return {
    totalCasos: lista.length,
    casosEvaluados: conScore.length,
    promedioScore: conScore.length > 0
      ? redondear(promedio(conScore.map(item => item.score)), 0)
      : 0,
    distribucion,
    coberturaIA,
    conAnalisisIA: conAnalisisIA.length,
    versiones: [...versiones.entries()]
      .map(([version, count]) => ({ version, count }))
      .sort((a, b) => b.count - a.count),
    reportes: {
      rosEnviados,
      noRosEnviados,
      rosVencidos
    },
    calibracion: {
      posiblesSubestimaciones,
      posiblesSobreestimaciones,
      riesgoAltoSinDecision,
      tasaSubestimacion: conScore.length > 0
        ? redondear((posiblesSubestimaciones.length / conScore.length) * 100)
        : 0,
      tasaSobreestimacion: conScore.length > 0
        ? redondear((posiblesSobreestimaciones.length / conScore.length) * 100)
        : 0
    },
    tiempos: {
      muestra: diasCierre.length,
      promedioDias: diasCierre.length > 0 ? redondear(promedio(diasCierre), 0) : null,
      medianaDias: diasCierre.length > 0 ? redondear(mediana(diasCierre), 0) : null
    },
    alertas,
    muestraSuficiente: conScore.length >= muestraMinima
  };
};

/**
 * Une los casos que requieren revisión humana, sin duplicados, priorizando
 * las señales de severidad alta.
 */
export const casosParaRevisar = (metricas = {}) => {
  const mapa = new Map();
  const grupos = [
    ...(metricas.calibracion?.posiblesSubestimaciones || []),
    ...(metricas.calibracion?.posiblesSobreestimaciones || []),
    ...(metricas.calibracion?.riesgoAltoSinDecision || [])
  ];

  grupos.forEach(item => {
    if (!item?.id || mapa.has(item.id)) return;
    mapa.set(item.id, item);
  });

  return [...mapa.values()].sort((a, b) => {
    const peso = { alta: 0, media: 1, baja: 2 };
    return (peso[a.severidad] ?? 3) - (peso[b.severidad] ?? 3);
  });
};

/**
 * Resumen legible para la UI o un reporte.
 */
export const describirCalidad = (metricas = {}) => {
  if (!metricas.casosEvaluados) {
    return 'Sin casos evaluados: no hay métricas de calidad todavía.';
  }

  const base = `${metricas.casosEvaluados} caso(s) evaluado(s); score promedio ${metricas.promedioScore}/25; `
    + `cobertura de IA ${metricas.coberturaIA}%`;

  if (!metricas.muestraSuficiente) {
    return `${base}; la muestra es demasiado pequeña para sacar conclusiones.`;
  }

  return `${base}; ${metricas.calibracion.posiblesSubestimaciones.length} posible(s) subestimación(es) `
    + `y ${metricas.calibracion.posiblesSobreestimaciones.length} posible(s) sobreestimación(es) para revisar.`;
};
