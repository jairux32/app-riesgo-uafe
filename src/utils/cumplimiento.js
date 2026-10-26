const MS_DIA = 24 * 60 * 60 * 1000;
const DIAS_POR_VENCER = 30;

const parseFecha = (fecha) => {
  if (!fecha) return null;
  if (fecha instanceof Date) return Number.isNaN(fecha.getTime()) ? null : fecha;

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fecha));
  if (!match) return null;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return Number.isNaN(date.getTime()) ? null : date;
};

const aISO = (fecha) => {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Estados posibles de un requisito institucional:
 * - completo: atestación registrada sin vencimiento periódico
 * - pendiente: no hay registro
 * - vigente / por_vencer / vencido: requisitos con vigencia anual
 */
export const ESTADOS_CUMPLIMIENTO = ['completo', 'pendiente', 'vigente', 'por_vencer', 'vencido'];

const ESTADOS_OK = ['completo', 'vigente'];

const ETIQUETAS_ESTADO = {
  completo: 'Registrado',
  pendiente: 'Pendiente',
  vigente: 'Vigente',
  por_vencer: 'Por vencer',
  vencido: 'Vencido',
};

const COLORES_ESTADO = {
  completo: 'var(--verde)',
  vigente: 'var(--verde)',
  pendiente: 'var(--rojo)',
  por_vencer: 'var(--naranja, #f97316)',
  vencido: 'var(--rojo)',
};

/**
 * Evalúa la vigencia de un requisito anual (EBR, capacitación) contando
 * 12 meses desde la fecha registrada.
 */
const evaluarAnual = (clave, etiqueta, fecha, fundamento, hoy, diasPorVencer) => {
  const registro = parseFecha(fecha);
  if (!registro) {
    return {
      clave,
      etiqueta,
      fundamento,
      fecha: null,
      vence: null,
      dias: null,
      estado: 'pendiente'
    };
  }

  const vence = new Date(registro);
  vence.setFullYear(vence.getFullYear() + 1);
  const dias = Math.ceil((vence - hoy) / MS_DIA);

  const estado = dias < 0
    ? 'vencido'
    : dias <= diasPorVencer
      ? 'por_vencer'
      : 'vigente';

  return { clave, etiqueta, fundamento, fecha: aISO(registro), vence: aISO(vence), dias, estado };
};

const evaluarAtestacion = (clave, etiqueta, valor, fundamento) => ({
  clave,
  etiqueta,
  fundamento,
  fecha: null,
  vence: null,
  dias: null,
  estado: valor ? 'completo' : 'pendiente'
});

/**
 * Evalúa el cumplimiento institucional de la notaría: código SISLAFT,
 * designación del oficial de cumplimiento, manual de prevención, EBR y
 * capacitación anual.
 *
 * No bloquea operaciones: solo informa y alerta. Los requisitos concretos
 * deben confirmarse en el portal de la UAFE antes de convertirlos en
 * validaciones duras.
 *
 * @param {object} perfil Perfil de la notaría guardado en `notary_profiles`
 * @param {{hoy?: string|Date, diasPorVencer?: number}} opciones
 */
export const evaluarCumplimientoInstitucional = (perfil = {}, opciones = {}) => {
  const hoy = parseFecha(opciones.hoy) || new Date();
  const diasPorVencer = opciones.diasPorVencer ?? DIAS_POR_VENCER;

  const items = [
    evaluarAtestacion(
      'codigoSISLAFT',
      'Código de registro SISLAFT',
      Boolean(String(perfil.codigoSISLAFT || '').trim()),
      'Ley LA/FT art. 30'
    ),
    evaluarAtestacion(
      'oficialCumplimiento',
      'Oficial de Cumplimiento designado',
      Boolean(String(perfil.oficialCumplimiento || '').trim() && perfil.fechaDesignacionOC),
      'Reglamento D.E. 298'
    ),
    evaluarAtestacion(
      'manualPrevencion',
      'Manual de prevención aprobado',
      Boolean(perfil.manualAprobado && perfil.manualFecha),
      'Ley LA/FT art. 33'
    ),
    evaluarAnual(
      'ebr',
      'Evaluación basada en riesgos (EBR)',
      perfil.ebrFecha,
      'Enfoque basado en riesgos',
      hoy,
      diasPorVencer
    ),
    evaluarAnual(
      'capacitacion',
      'Capacitación anual del personal',
      perfil.capacitacionFecha,
      'Programa anual de capacitación',
      hoy,
      diasPorVencer
    )
  ];

  const pendientes = items.filter(item => !ESTADOS_OK.includes(item.estado));
  const vencidos = items.filter(item => item.estado === 'vencido');
  const porVencer = items.filter(item => item.estado === 'por_vencer');

  return {
    items,
    cumple: pendientes.length === 0,
    pendientes,
    vencidos,
    porVencer,
    requiereAtencion: pendientes.length > 0
  };
};

export const getEstadoCumplimientoStyle = (estado) => ({
  etiqueta: ETIQUETAS_ESTADO[estado] || estado,
  color: COLORES_ESTADO[estado] || 'var(--txt2)'
});

export const describirVencimiento = (item) => {
  if (item.estado === 'vencido') return `Vencido hace ${Math.abs(item.dias)} día(s)`;
  if (item.estado === 'por_vencer') return `Vence en ${item.dias} día(s)`;
  if (item.estado === 'vigente') return `Vigente hasta ${item.vence}`;
  if (item.estado === 'completo') return 'Registrado';
  return 'Pendiente de registrar';
};
