// Ficha de revisión de coincidencias en listas restrictivas.
//
// Un resultado `posible` o `coincidencia` no es una conclusión: exige que una
// persona revise el caso, documente el fundamento y decida si se descarta
// (falso positivo) o se confirma. La app no descarta coincidencias sola.

export const ESTADOS_CON_COINCIDENCIA = ['posible', 'coincidencia'];

export const DECISIONES_REVISION = [
  { valor: 'descartado', etiqueta: 'Falso positivo (descartado)' },
  { valor: 'confirmado', etiqueta: 'Coincidencia confirmada' }
];

export const ETIQUETAS_LISTA = {
  ofac: 'OFAC',
  onu: 'ONU',
  uk: 'UK',
  uafe: 'PEP / UAFE'
};

export const requiereRevision = (verificacion) =>
  ESTADOS_CON_COINCIDENCIA.includes(verificacion?.estado);

export const estaRevisada = (verificacion) => {
  if (!requiereRevision(verificacion)) return true;
  return validarRevision(verificacion?.revision || {}).valida;
};

export const validarRevision = (revision = {}) => {
  const faltantes = [];

  if (!DECISIONES_REVISION.some(d => d.valor === revision.decision)) {
    faltantes.push('decisión de la revisión');
  }
  if (!String(revision.revisor || '').trim()) {
    faltantes.push('responsable de la revisión');
  }
  if (!String(revision.fecha || '').trim()) {
    faltantes.push('fecha de la revisión');
  }
  if (String(revision.justificacion || '').trim().length < 20) {
    faltantes.push('justificación de al menos 20 caracteres');
  }

  return { valida: faltantes.length === 0, faltantes };
};

/**
 * Resume el estado de las revisiones de todas las listas.
 */
export const resumenRevisiones = (verificaciones = {}) => {
  const items = Object.entries(verificaciones || {})
    .filter(([, verificacion]) => requiereRevision(verificacion));

  const pendientes = items.filter(([, verificacion]) => !estaRevisada(verificacion));
  const revisadas = items.filter(([, verificacion]) => estaRevisada(verificacion));
  const confirmadas = revisadas.filter(([, verificacion]) => verificacion.revision?.decision === 'confirmado');
  const descartadas = revisadas.filter(([, verificacion]) => verificacion.revision?.decision === 'descartado');

  return {
    total: items.length,
    pendientes,
    confirmadas,
    descartadas,
    completa: pendientes.length === 0
  };
};

/**
 * Indica si todas las listas se consultaron contra una fuente real.
 */
export const todasLasListasVerificadas = (verificaciones = {}) => {
  const valores = Object.values(verificaciones || {});
  const estadosConFuente = ['no_encontrado', 'posible', 'coincidencia'];
  return valores.length > 0
    && valores.every(verificacion => estadosConFuente.includes(verificacion?.estado));
};

/**
 * Devuelve las coincidencias con su ficha de revisión, para exportaciones y
 * audit trail.
 */
export const detallesRevisiones = (verificaciones = {}) =>
  Object.entries(verificaciones || {})
    .filter(([, verificacion]) => requiereRevision(verificacion))
    .map(([tipo, verificacion]) => ({
      tipo,
      estado: verificacion.estado,
      decision: verificacion.revision?.decision || null,
      revisor: verificacion.revision?.revisor || null,
      fecha: verificacion.revision?.fecha || null,
      justificacion: verificacion.revision?.justificacion || null,
      revisada: estaRevisada(verificacion)
    }));

/**
 * Describe las revisiones en una línea legible.
 */
export const describirRevisiones = (verificaciones = {}) => {
  const detalles = detallesRevisiones(verificaciones);
  if (detalles.length === 0) return 'Sin coincidencias que revisar.';

  return detalles.map(detalle => {
    const nombre = ETIQUETAS_LISTA[detalle.tipo] || detalle.tipo.toUpperCase();
    if (!detalle.revisada) return `${nombre}: revisión pendiente (${detalle.estado})`;
    return `${nombre}: ${detalle.decision} — ${detalle.revisor} (${detalle.fecha}) — ${detalle.justificacion}`;
  }).join(' | ');
};
