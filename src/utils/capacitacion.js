// Registro de la capacitación anual del personal de la notaría.
//
// La UAFE exige un programa anual de capacitación; este módulo conserva el
// detalle de cada jornada (tema, fecha, horas, participantes, facilitador y
// responsable) y el hash del certificado o lista de asistencia. La app no
// certifica la autenticidad del documento: solo prueba que no cambió.
//
// La referencia de horas es interna y configurable: no sustituye lo que
// disponga la UAFE en su momento.

import { hashArchivo } from './evidencias';

export const MODALIDADES_CAPACITACION = [
  { valor: 'presencial', etiqueta: 'Presencial' },
  { valor: 'virtual', etiqueta: 'Virtual' },
  { valor: 'mixta', etiqueta: 'Mixta' },
  { valor: 'autoestudio', etiqueta: 'Autoestudio' }
];

// Referencia interna para avisar cuando el programa anual es muy liviano.
// No es un mínimo legal: cada notaría define su plan y su carga horaria.
export const HORAS_RECOMENDADAS_ANUALES = 8;

const MS_DIA = 24 * 60 * 60 * 1000;
const DIAS_POR_VENCER = 30;
const HASH_HEX = /^[a-f0-9]{64}$/;

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

const idSeguro = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `cap_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

export const esModalidadValida = (modalidad) =>
  MODALIDADES_CAPACITACION.some(m => m.valor === modalidad);

export const etiquetaModalidad = (modalidad) =>
  MODALIDADES_CAPACITACION.find(m => m.valor === modalidad)?.etiqueta || modalidad || '—';

/**
 * Acepta una lista de nombres o un texto separado por saltos de línea, comas
 * o punto y coma, y devuelve los participantes sin vacíos ni duplicados.
 */
export const normalizarParticipantes = (participantes) => {
  const crudos = Array.isArray(participantes)
    ? participantes
    : String(participantes || '').split(/[\n,;]+/);

  const vistos = new Set();
  const resultado = [];

  crudos.forEach(nombre => {
    const limpio = String(nombre || '').trim();
    if (!limpio) return;
    const clave = limpio.toLowerCase();
    if (vistos.has(clave)) return;
    vistos.add(clave);
    resultado.push(limpio);
  });

  return resultado;
};

/**
 * Crea el registro que se persiste en `notary_profiles.capacitaciones`.
 * La evidencia se guarda como metadatos con hash; el archivo vive aparte.
 */
export const crearRegistroCapacitacion = (datos = {}) => {
  const horas = Number(datos.horas);
  const fecha = parseFecha(datos.fecha);

  return {
    id: datos.id || idSeguro(),
    tema: String(datos.tema || '').trim(),
    fecha: fecha ? aISO(fecha) : String(datos.fecha || '').trim(),
    horas: Number.isFinite(horas) && horas > 0 ? Math.round(horas * 100) / 100 : 0,
    modalidad: esModalidadValida(datos.modalidad) ? datos.modalidad : 'presencial',
    facilitador: String(datos.facilitador || '').trim(),
    participantes: normalizarParticipantes(datos.participantes),
    responsable: String(datos.responsable || '').trim(),
    evidencia: datos.evidencia && HASH_HEX.test(String(datos.evidencia.hash || ''))
      ? {
          nombre: String(datos.evidencia.nombre || 'certificado').trim(),
          hash: String(datos.evidencia.hash).toLowerCase(),
          tamano: Number(datos.evidencia.tamano) || 0,
          cargadaEn: datos.evidencia.cargadaEn || new Date().toISOString()
        }
      : null,
    creadoEn: datos.creadoEn || new Date().toISOString()
  };
};

/**
 * Valida un registro antes de guardarlo. El responsable es obligatorio para
 * poder atribuir el registro a una persona.
 */
export const validarRegistroCapacitacion = (registro = {}) => {
  const faltantes = [];

  if (!String(registro.tema || '').trim()) faltantes.push('tema de la capacitación');
  if (!parseFecha(registro.fecha)) faltantes.push('fecha válida');
  if (!(Number(registro.horas) > 0)) faltantes.push('horas mayores a cero');
  if (!esModalidadValida(registro.modalidad)) faltantes.push('modalidad');
  if (normalizarParticipantes(registro.participantes).length === 0) faltantes.push('participantes');
  if (!String(registro.responsable || '').trim()) faltantes.push('responsable del registro');

  if (registro.evidencia && !HASH_HEX.test(String(registro.evidencia.hash || ''))) {
    faltantes.push('hash SHA-256 de la evidencia');
  }

  return { valida: faltantes.length === 0, faltantes };
};

/**
 * Calcula la vigencia de la capacitación anual con el registro más reciente
 * y las horas acumuladas en los últimos 12 meses.
 *
 * El estado depende de la fecha (anual). El cumplimiento de horas se informa
 * aparte: no invalida por sí solo la capacitación, pero genera una alerta.
 */
export const evaluarVigenciaCapacitacion = (registros = [], opciones = {}) => {
  const hoy = parseFecha(opciones.hoy) || new Date();
  const horasMinimas = opciones.horasMinimas ?? HORAS_RECOMENDADAS_ANUALES;
  const diasPorVencer = opciones.diasPorVencer ?? DIAS_POR_VENCER;

  const lista = (Array.isArray(registros) ? registros : [])
    .map(registro => ({ registro, fecha: parseFecha(registro?.fecha) }))
    .filter(item => item.fecha);

  const pasadas = lista
    .filter(item => item.fecha <= hoy)
    .sort((a, b) => b.fecha - a.fecha);
  const programadas = lista.filter(item => item.fecha > hoy);

  const inicioVentana = new Date(hoy);
  inicioVentana.setFullYear(inicioVentana.getFullYear() - 1);

  const horasUltimos12Meses = pasadas
    .filter(item => item.fecha >= inicioVentana)
    .reduce((total, item) => total + (Number(item.registro?.horas) || 0), 0);

  const ultima = pasadas[0] || null;
  const participantesUltima = ultima
    ? normalizarParticipantes(ultima.registro?.participantes).length
    : 0;

  if (!ultima) {
    return {
      total: lista.length,
      programadas: programadas.length,
      ultimaFecha: null,
      ultimaTema: null,
      vence: null,
      dias: null,
      estado: 'pendiente',
      vigente: false,
      horasUltimos12Meses,
      horasMinimas,
      cumpleHoras: false,
      participantesUltima: 0
    };
  }

  const vence = new Date(ultima.fecha);
  vence.setFullYear(vence.getFullYear() + 1);
  const dias = Math.ceil((vence - hoy) / MS_DIA);

  const estado = dias < 0
    ? 'vencido'
    : dias <= diasPorVencer
      ? 'por_vencer'
      : 'vigente';

  return {
    total: lista.length,
    programadas: programadas.length,
    ultimaFecha: aISO(ultima.fecha),
    ultimaTema: ultima.registro?.tema || null,
    vence: aISO(vence),
    dias,
    estado,
    vigente: estado === 'vigente' || estado === 'por_vencer',
    horasUltimos12Meses: Math.round(horasUltimos12Meses * 100) / 100,
    horasMinimas,
    cumpleHoras: horasUltimos12Meses >= horasMinimas,
    participantesUltima
  };
};

/**
 * Devuelve la fecha más reciente de capacitación para el chequeo de
 * cumplimiento institucional. Considera el registro detallado y, como
 * respaldo, el campo simple `capacitacionFecha` de perfiles anteriores.
 */
export const fechaCapacitacionVigente = (capacitaciones = [], capacitacionFecha = '', opciones = {}) => {
  const hoy = parseFecha(opciones.hoy) || new Date();
  const fechas = (Array.isArray(capacitaciones) ? capacitaciones : [])
    .map(registro => parseFecha(registro?.fecha))
    .filter(fecha => fecha && fecha <= hoy);

  const legado = parseFecha(capacitacionFecha);
  if (legado && legado <= hoy) fechas.push(legado);

  if (fechas.length === 0) return '';
  return aISO(new Date(Math.max(...fechas.map(fecha => fecha.getTime()))));
};

/**
 * Explica el estado de la capacitación para la UI, exportaciones o auditoría.
 */
export const describirCapacitacion = (registros = [], opciones = {}) => {
  const resumen = evaluarVigenciaCapacitacion(registros, opciones);
  if (resumen.total === 0) return 'Sin registros de capacitación.';

  const base = `${resumen.total} capacitación(es) registrada(s); última ${resumen.ultimaFecha}`
    + (resumen.ultimaTema ? ` (${resumen.ultimaTema})` : '')
    + `; ${resumen.horasUltimos12Meses} h en los últimos 12 meses`
    + `; ${resumen.participantesUltima} participante(s) en la última jornada`;

  if (resumen.estado === 'vencido') return `${base}; la capacitación anual está vencida.`;
  if (resumen.estado === 'por_vencer') return `${base}; vence en ${resumen.dias} día(s).`;
  return `${base}; vigente hasta ${resumen.vence}.`;
};

/**
 * Filas planas para una futura exportación del expediente de capacitación.
 */
export const filasCapacitacion = (registros = []) =>
  (Array.isArray(registros) ? registros : []).map(registro => ({
    fecha: registro?.fecha || '—',
    tema: registro?.tema || '—',
    horas: Number(registro?.horas) || 0,
    modalidad: etiquetaModalidad(registro?.modalidad),
    facilitador: registro?.facilitador || '—',
    participantes: normalizarParticipantes(registro?.participantes).join(', ') || '—',
    responsable: registro?.responsable || '—',
    evidencia: registro?.evidencia?.nombre || '—',
    hash: registro?.evidencia?.hash || '—'
  }));

/**
 * Calcula el hash de un certificado o lista de asistencia antes de guardar
 * el registro. El archivo se almacena aparte (IndexedDB).
 */
export const crearEvidenciaCapacitacion = async (archivo) => {
  if (!archivo) return null;
  return {
    nombre: String(archivo.name || 'certificado').trim(),
    hash: await hashArchivo(archivo),
    tamano: Number(archivo.size) || 0,
    cargadaEn: new Date().toISOString()
  };
};
