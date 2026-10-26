import { UMBRAL_MEDIO_PAGO_USD } from '../data/constants';

const MS_DIA = 24 * 60 * 60 * 1000;

export const ESTADOS_REPORTE = [
  'pendiente',
  'preparado',
  'enviado',
  'acuse_recibido',
  'no_aplica'
];

const parseFechaLocal = (fecha) => {
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

const sumarDias = (fecha, dias) => {
  const resultado = new Date(fecha);
  resultado.setDate(resultado.getDate() + dias);
  return resultado;
};

const ultimoDiaMes = (fecha) => new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0, 12);

const diaDelMesSiguiente = (fecha, dia) =>
  new Date(fecha.getFullYear(), fecha.getMonth() + 1, dia, 12);

const conEstadoInicial = (reporte) => ({
  estado: 'pendiente',
  responsable: 'Oficial de Cumplimiento',
  fechaEnvio: '',
  acuse: '',
  notas: '',
  ...reporte
});

/**
 * Calcula los plazos sugeridos de los reportes ante SISLAFT.
 *
 * - RESU: operaciones ≥ USD 10.000, primeros 15 días del mes siguiente.
 * - NO-RESU: 10 días después del cierre mensual.
 * - ROS: 5 días desde el conocimiento, con 3 días de prórroga.
 * - NO-ROS: 10 días después del cierre mensual.
 *
 * Los plazos son sugerencias: el usuario puede ajustarlos en la UI y el
 * sistema conserva su decisión. Un score alto o un dictamen que amerita ROS
 * activan la sugerencia de ROS, pero no la declaran automáticamente.
 */
export const calcularObligaciones = (datos = {}, opciones = {}) => {
  const hoy = parseFechaLocal(opciones.hoy) || new Date();
  const fechaBase = parseFechaLocal(datos.fechaTransaccion) || hoy;
  const fechaConocimiento = parseFechaLocal(opciones.fechaConocimiento) || hoy;
  const valor = Number(datos.valor) || 0;
  const umbral = opciones.umbral ?? UMBRAL_MEDIO_PAGO_USD;
  const umbralRos = opciones.umbralRos ?? 20;
  const score = Number(opciones.scoreInherente) || 0;
  const ameritaRos = Boolean(opciones.analisis?.ros?.amerita_ros) || score >= umbralRos;

  const cierreMensual = ultimoDiaMes(fechaBase);
  const operacionReportable = valor >= umbral;

  const resu = operacionReportable
    ? conEstadoInicial({
      tipo: 'RESU',
      fechaLimite: aISO(diaDelMesSiguiente(fechaBase, 15)),
      descripcion: 'Operación ≥ USD 10.000: reportar dentro de los primeros 15 días del mes siguiente.',
      fundamento: 'Res. UAFE-DG-2026-0007'
    })
    : conEstadoInicial({
      tipo: 'NO-RESU',
      fechaLimite: aISO(sumarDias(cierreMensual, 10)),
      descripcion: 'Sin operaciones ≥ USD 10.000: presentar la constancia dentro de los 10 días posteriores al cierre mensual.',
      fundamento: 'Res. UAFE-DG-2026-0007'
    });

  const ros = ameritaRos
    ? conEstadoInicial({
      tipo: 'ROS',
      fechaLimite: aISO(sumarDias(fechaConocimiento, 5)),
      fechaLimiteProrroga: aISO(sumarDias(fechaConocimiento, 8)),
      descripcion: 'Operación sospechosa: reportar dentro de 5 días desde el conocimiento (3 días adicionales de prórroga).',
      fundamento: 'Ley LA/FT art. 62; Res. UAFE-DG-2026-0007'
    })
    : conEstadoInicial({
      tipo: 'NO-ROS',
      fechaLimite: aISO(sumarDias(cierreMensual, 10)),
      descripcion: 'Sin operaciones sospechosas: presentar la constancia dentro de los 10 días posteriores al cierre mensual.',
      fundamento: 'Res. UAFE-DG-2026-0007'
    });

  return { resu, ros };
};

/**
 * Combina las sugerencias calculadas con el seguimiento ya guardado.
 * El tipo, la descripción, el fundamento y la prórroga siempre reflejan los
 * datos actuales; la fecha límite solo se respeta si el usuario la editó.
 */
export const combinarReportes = (sugerencias, guardados = {}) => {
  const combinar = (clave) => {
    const guardado = guardados[clave] || {};
    return {
      ...sugerencias[clave],
      ...guardado,
      tipo: sugerencias[clave].tipo,
      descripcion: sugerencias[clave].descripcion,
      fundamento: sugerencias[clave].fundamento,
      fechaLimiteProrroga: sugerencias[clave].fechaLimiteProrroga,
      fechaLimite: guardado.fechaLimiteManual
        ? guardado.fechaLimite
        : sugerencias[clave].fechaLimite
    };
  };

  return { resu: combinar('resu'), ros: combinar('ros') };
};

/**
 * Devuelve el estado de vencimiento de una fecha límite en formato ISO.
 */
export const estadoVencimiento = (fechaLimite, hoy = new Date()) => {
  const limite = parseFechaLocal(fechaLimite);
  const base = parseFechaLocal(hoy) || new Date();

  if (!limite) {
    return { estado: 'sin_fecha', dias: null, etiqueta: 'Sin fecha' };
  }

  const dias = Math.ceil((limite - base) / MS_DIA);

  if (dias < 0) {
    return {
      estado: 'vencida',
      dias,
      etiqueta: `Vencida hace ${Math.abs(dias)} día(s)`
    };
  }
  if (dias === 0) {
    return { estado: 'vence_hoy', dias, etiqueta: 'Vence hoy' };
  }
  if (dias <= 3) {
    return { estado: 'por_vencer', dias, etiqueta: `Vence en ${dias} día(s)` };
  }

  return { estado: 'vigente', dias, etiqueta: `Vence en ${dias} días` };
};
