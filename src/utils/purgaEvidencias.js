// Mantenimiento del almacenamiento local de evidencias.
//
// Los archivos de evidencia viven solo en IndexedDB: no se suben a la nube.
// Cuando un caso se elimina o se quita una evidencia, el registro desaparece
// del caso pero el archivo puede quedar huérfano en el dispositivo, ocupando
// espacio y conservando PII más tiempo del necesario.
//
// Este módulo detecta esos archivos huérfanos y, con confirmación explícita,
// los borra. Se aplican dos salvaguardas:
//
// 1. Solo se considera huérfano lo que no está referenciado por ningún caso
//    (incluidos los borradores pendientes) ni por una capacitación del perfil.
// 2. Se respeta un periodo de gracia: un archivo recién guardado puede
//    pertenecer a un caso que todavía no se ha guardado, así que no se toca.
//
// Aun así es una acción destructiva sobre datos locales: la app muestra la
// vista previa y exige confirmación antes de borrar.

import { listarEvidenciasLocales, eliminarArchivoEvidencia } from './evidenciasDB';

const MS_DIA = 24 * 60 * 60 * 1000;

// Días que debe tener un archivo sin referencia antes de poder borrarse.
export const DIAS_GRACIA_PURGA = 7;

const aFecha = (valor) => {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

const agregarIds = (destino, lista) => {
  (Array.isArray(lista) ? lista : []).forEach(item => {
    if (item?.id) destino.add(String(item.id));
  });
};

/**
 * Reúne los ids de evidencia que siguen vigentes:
 * - `caso.datos.evidencias[].id` de cada caso (incluye borradores pendientes),
 * - `perfil.capacitaciones[].id` de las jornadas de capacitación.
 *
 * Es imprescindible pasar el historial completo del usuario: si se entrega una
 * lista filtrada, los archivos de los casos excluidos se verían como huérfanos.
 */
export const idsEvidenciasReferenciadas = (casos = [], perfil = {}) => {
  const ids = new Set();

  (Array.isArray(casos) ? casos : []).forEach(caso => {
    agregarIds(ids, caso?.datos?.evidencias);
  });
  agregarIds(ids, perfil?.capacitaciones);

  return ids;
};

/**
 * Compara los archivos locales con los ids referenciados y devuelve los
 * huérfanos que ya superaron el periodo de gracia.
 *
 * @param {{
 *   registros?: Array<{id: string, guardadoEn?: string, tamano?: number}>,
 *   referenciadas?: Set<string>,
 *   hoy?: string|Date,
 *   diasGracia?: number
 * }} opciones
 */
export const calcularEvidenciasHuerfanas = (opciones = {}) => {
  const registros = Array.isArray(opciones.registros) ? opciones.registros : [];
  const referenciadas = opciones.referenciadas instanceof Set
    ? opciones.referenciadas
    : new Set(Array.isArray(opciones.referenciadas) ? opciones.referenciadas.map(String) : []);
  const hoy = aFecha(opciones.hoy) || new Date();
  const diasGracia = Number.isFinite(Number(opciones.diasGracia))
    ? Math.max(0, Number(opciones.diasGracia))
    : DIAS_GRACIA_PURGA;

  const huerfanas = [];
  const enGracia = [];
  const vistos = new Set();

  registros.forEach(registro => {
    const id = String(registro?.id || '').trim();
    if (!id || vistos.has(id) || referenciadas.has(id)) return;
    vistos.add(id);

    const guardadoEn = aFecha(registro?.guardadoEn);
    const dias = guardadoEn ? Math.floor((hoy - guardadoEn) / MS_DIA) : null;
    const item = {
      id,
      guardadoEn: guardadoEn ? guardadoEn.toISOString() : null,
      tamano: Number(registro?.tamano) || 0,
      // Sin fecha no se puede demostrar que sea reciente, pero tampoco lo
      // contrario: se informa y se deja pasar la purga.
      sinFecha: !guardadoEn,
      diasSinUso: dias
    };

    if (guardadoEn && dias < diasGracia) enGracia.push(item);
    else huerfanas.push(item);
  });

  huerfanas.sort((a, b) => String(a.guardadoEn).localeCompare(String(b.guardadoEn)));

  return {
    huerfanas,
    enGracia,
    tamanoHuerfanas: huerfanas.reduce((total, item) => total + item.tamano, 0),
    diasGracia
  };
};

/**
 * Ejecuta la purga. Con `confirmar: false` (por defecto) solo informa lo que
 * borraría; no toca nada.
 *
 * Las dependencias se pueden inyectar para probar el flujo sin IndexedDB.
 *
 * @param {{
 *   casos?: Array<object>,
 *   perfil?: object,
 *   casosPendientes?: Array<object>,
 *   hoy?: string|Date,
 *   diasGracia?: number,
 *   confirmar?: boolean,
 *   listar?: () => Promise<Array<object>>,
 *   eliminar?: (id: string) => Promise<void>
 * }} opciones
 */
export const purgarEvidenciasHuerfanas = async (opciones = {}) => {
  const listar = opciones.listar || listarEvidenciasLocales;
  const eliminar = opciones.eliminar || eliminarArchivoEvidencia;
  const confirmar = opciones.confirmar === true;

  const referenciadas = idsEvidenciasReferenciadas(
    [...(opciones.casos || []), ...(opciones.casosPendientes || [])],
    opciones.perfil || {}
  );

  let registros;
  try {
    registros = await listar();
  } catch (err) {
    return {
      error: `No se pudo leer el almacenamiento local: ${err.message}`,
      revisadas: 0,
      huerfanas: [],
      enGracia: [],
      eliminadas: [],
      fallidas: [],
      confirmado: false
    };
  }

  const analisis = calcularEvidenciasHuerfanas({
    registros,
    referenciadas,
    hoy: opciones.hoy,
    diasGracia: opciones.diasGracia
  });

  const resultado = {
    revisadas: (registros || []).length,
    referenciadas: referenciadas.size,
    huerfanas: analisis.huerfanas,
    enGracia: analisis.enGracia,
    tamanoHuerfanas: analisis.tamanoHuerfanas,
    diasGracia: analisis.diasGracia,
    eliminadas: [],
    fallidas: [],
    confirmado: confirmar
  };

  if (!confirmar) return resultado;

  for (const item of analisis.huerfanas) {
    try {
      await eliminar(item.id);
      resultado.eliminadas.push(item.id);
    } catch (err) {
      resultado.fallidas.push({ id: item.id, error: err.message });
    }
  }

  return resultado;
};

/**
 * Describe el resultado para la UI o un registro de mantenimiento.
 */
export const describirPurga = (resultado = {}) => {
  if (resultado.error) return resultado.error;
  if (resultado.revisadas === 0) return 'No hay archivos de evidencia guardados en este dispositivo.';

  const total = resultado.huerfanas?.length || 0;
  if (total === 0) {
    return `Los ${resultado.revisadas} archivo(s) locales están referenciados por algún caso o capacitación.`;
  }

  if (!resultado.confirmado) {
    return `${total} archivo(s) sin referencia (${Math.round((resultado.tamanoHuerfanas || 0) / 1024)} KB) `
      + `pueden eliminarse; se conservan ${resultado.enGracia?.length || 0} dentro del periodo de gracia.`;
  }

  const eliminadas = resultado.eliminadas?.length || 0;
  const fallidas = resultado.fallidas?.length || 0;
  return `Se eliminaron ${eliminadas} archivo(s) huérfano(s)`
    + (fallidas > 0 ? `; ${fallidas} no se pudieron borrar.` : '.');
};
