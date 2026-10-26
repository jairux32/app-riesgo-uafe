/**
 * Validación de identificación ecuatoriana (cédula/RUC/pasaporte)
 */

import { LIMITE_EFECTIVO_USD, UMBRAL_MEDIO_PAGO_USD } from '../data/constants';

/**
 * Controla el límite legal de efectivo (Ley Notarial art. 20.8) y la
 * obligación de identificar el medio de pago desde USD 10.000 (art. 19.m).
 *
 * @param {number|string} valor Monto de la operación en USD
 * @param {string} medioPago Medio declarado (Efectivo, Transferencia, Mixto...)
 * @param {{limiteEfectivo?: number}} opciones Permite parametrizar el SBU
 */
export const validarMedioPago = (valor, medioPago, opciones = {}) => {
  const limiteEfectivo = opciones.limiteEfectivo ?? LIMITE_EFECTIVO_USD;
  const monto = Number(valor) || 0;
  const medio = String(medioPago || '').trim();
  const medioNormalizado = medio.toLowerCase();

  if (medioNormalizado === 'efectivo' && monto > limiteEfectivo) {
    return {
      valido: false,
      motivo: 'excede_efectivo',
      mensaje: `El efectivo supera el límite legal de 100 SBU (USD ${limiteEfectivo.toLocaleString('es-EC')}). No se puede elevar la escritura con ese medio de pago.`
    };
  }

  if (monto >= UMBRAL_MEDIO_PAGO_USD && !medio) {
    return {
      valido: false,
      motivo: 'medio_pago_requerido',
      mensaje: 'Identifique el medio de pago: es obligatorio para operaciones desde USD 10.000 (Ley Notarial art. 19.m).'
    };
  }

  if (medioNormalizado === 'mixto' && monto >= UMBRAL_MEDIO_PAGO_USD) {
    return {
      valido: true,
      advertencia: 'En pagos mixtos, la porción en efectivo no puede superar 100 SBU. Documente el desglose y verifique que la parte en efectivo no exceda el límite.'
    };
  }

  return { valido: true, mensaje: '' };
};

/**
 * Valida cédula ecuatoriana (10 dígitos, módulo 10)
 */
export const validarCedulaEcuatoriana = (cedula) => {
  if (!cedula || cedula.length !== 10) return { valido: false, mensaje: 'La cédula debe tener 10 dígitos' };
  
  // Solo números
  if (!/^\d{10}$/.test(cedula)) return { valido: false, mensaje: 'La cédula solo debe contener números' };
  
  // Primeros 2 dígitos: provincia (01-24)
  const provincia = parseInt(cedula.substring(0, 2));
  if (provincia < 1 || provincia > 24) return { valido: false, mensaje: 'Código de provincia inválido (01-24)' };
  
  // Tercer dígito: debe ser 0-6 (persona natural)
  const tercero = parseInt(cedula.charAt(2));
  if (tercero > 6) return { valido: false, mensaje: 'Tercer dígito inválido para persona natural' };
  
  // Módulo 10
  const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let suma = 0;
  
  for (let i = 0; i < 9; i++) {
    let valor = parseInt(cedula.charAt(i)) * coeficientes[i];
    if (valor >= 10) valor -= 9;
    suma += valor;
  }
  
  const digitoVerificador = (10 - (suma % 10)) % 10;
  const ultimoDigito = parseInt(cedula.charAt(9));
  
  if (digitoVerificador !== ultimoDigito) {
    return { valido: false, mensaje: 'Dígito verificador inválido' };
  }
  
  return { valido: true, tipo: 'Cédula', mensaje: 'Cédula válida' };
};

/**
 * Valida RUC ecuatoriano (13 dígitos, módulo 11)
 */
export const validarRUC = (ruc) => {
  if (!ruc || ruc.length !== 13) return { valido: false, mensaje: 'El RUC debe tener 13 dígitos' };
  
  if (!/^\d{13}$/.test(ruc)) return { valido: false, mensaje: 'El RUC solo debe contener números' };
  
  const tipo = ruc.substring(2, 3);
  
  // Persona natural: empieza con 17 o 18, tercer dígito 0-6
  if (tipo === '9') {
    // Jurídica: módulo 11
    return validarRUCJuridica(ruc);
  }
  
  // Persona natural
  const cedulaValida = validarCedulaEcuatoriana(ruc.substring(0, 10));
  if (!cedulaValida.valido) return { valido: false, mensaje: 'Base de cédula inválida en el RUC' };
  
  // Últimos 3 dígitos: establecimiento (001-999)
  const establecimiento = parseInt(ruc.substring(10, 13));
  if (establecimiento < 1) return { valido: false, mensaje: 'Código de establecimiento inválido' };
  
  return { valido: true, tipo: 'RUC Persona Natural', mensaje: 'RUC válido' };
};

const validarRUCJuridica = (ruc) => {
  const coeficientes = [4, 3, 2, 7, 6, 5, 4, 3, 2];
  let suma = 0;
  
  for (let i = 0; i < 9; i++) {
    suma += parseInt(ruc.charAt(i)) * coeficientes[i];
  }
  
  const residuo = suma % 11;
  const digitoVerificador = residuo === 0 ? 0 : 11 - residuo;
  const digito9 = parseInt(ruc.charAt(9));
  
  if (digitoVerificador !== digito9) {
    return { valido: false, mensaje: 'Dígito verificador inválido para RUC jurídico' };
  }
  
  const establecimiento = parseInt(ruc.substring(10, 13));
  if (establecimiento < 1) return { valido: false, mensaje: 'Código de establecimiento inválido' };
  
  return { valido: true, tipo: 'RUC Jurídico', mensaje: 'RUC válido' };
};

/**
 * Detecta el tipo de identificación y valida
 */
export const validarIdentificacion = (identificacion) => {
  if (!identificacion || identificacion.trim().length === 0) {
    return { valido: false, mensaje: 'Identificación requerida', tipo: null };
  }
  
  const limpio = identificacion.trim();
  
  // Pasaporte: alfanumérico, longitud variable (no validamos formato específico)
  if (/^[A-Za-z0-9]{5,20}$/.test(limpio) && /[A-Za-z]/.test(limpio)) {
    return { valido: true, tipo: 'Pasaporte', mensaje: 'Pasaporte aceptado' };
  }
  
  // Solo números
  if (!/^\d+$/.test(limpio)) {
    return { valido: false, mensaje: 'Formato inválido. Use solo números para cédula/RUC o alfanumérico para pasaporte.', tipo: null };
  }
  
  // Cédula: 10 dígitos
  if (limpio.length === 10) {
    return validarCedulaEcuatoriana(limpio);
  }
  
  // RUC: 13 dígitos
  if (limpio.length === 13) {
    return validarRUC(limpio);
  }
  
  // Longitud inválida
  return { valido: false, mensaje: 'Longitud inválida. Cédula: 10 dígitos, RUC: 13 dígitos, Pasaporte: 5-20 caracteres.', tipo: null };
};

/**
 * Verifica que la debida diligencia del cliente esté completa (Ley LA/FT
 * art. 47). Para personas jurídicas exige además identificar al beneficiario
 * final y su porcentaje de participación (art. 92; Reglamento art. 31).
 *
 * No infiere verificaciones: `ddc` contiene atestaciones explícitas. La
 * verificación en listas solo se marca cuando el screening se ejecutó.
 *
 * @param {object} datos Datos del caso
 * @returns {{completa: boolean, faltantes: string[]}}
 */
export const validarDDC = (datos = {}) => {
  const ddc = datos.ddc || {};
  const beneficiario = datos.beneficiarioFinal || {};
  const esJuridica = datos.tipoPersona === 'juridica';
  const faltantes = [];

  if (!ddc.identificacion) faltantes.push('identidad del cliente verificada');
  if (!ddc.proposito) faltantes.push('propósito y naturaleza de la operación');
  if (!ddc.origenFondos) faltantes.push('origen y licitud de los fondos');
  if (!ddc.listas && !ddc.listasNoDisponibles) {
    faltantes.push('verificación en listas o constancia de fuente no disponible');
  }

  if (esJuridica) {
    if (!ddc.beneficiarioFinal) faltantes.push('beneficiario final verificado');
    if (!String(beneficiario.nombre || '').trim()) faltantes.push('nombre del beneficiario final');
    if (!String(beneficiario.cedula || '').trim()) faltantes.push('identificación del beneficiario final');

    const porcentaje = Number(beneficiario.porcentaje);
    if (!Number.isFinite(porcentaje) || porcentaje <= 0 || porcentaje > 100) {
      faltantes.push('porcentaje del beneficiario final (1-100)');
    }
  }

  return { completa: faltantes.length === 0, faltantes };
};
