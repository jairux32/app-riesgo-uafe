// Perfil transaccional del cliente y detección de desviaciones.
//
// El perfil se construye con las operaciones históricas del mismo cliente
// (cédula/RUC; si no hay, nombre normalizado). No es un score: es una
// comparación contra el comportamiento habitual para que el notario pueda
// documentar o justificar una operación atípica (enfoque basado en riesgo).
//
// La app no concluye que haya lavado: solo señala desviaciones verificables.

export const UMBRALES_PERFIL = {
  minimoOperaciones: 2,
  multiploPromedio: 2,
  multiploMaximo: 1.5,
  multiploPromedioAlto: 3,
  multiploMaximoAlto: 2,
  ventanaFrecuenciaDias: 30,
  minimoOperacionesVentana: 3,
  multiploFrecuencia: 2
};

const normalizar = (valor) => String(valor || '').trim().toLowerCase();

const numero = (valor) => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
};

const promedio = (valores) =>
  valores.length === 0 ? 0 : valores.reduce((a, b) => a + b, 0) / valores.length;

const mediana = (valores) => {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0
    ? (ordenados[mitad - 1] + ordenados[mitad]) / 2
    : ordenados[mitad];
};

const desviacionEstandar = (valores) => {
  if (valores.length < 2) return 0;
  const media = promedio(valores);
  const varianza = valores.reduce((acc, valor) => acc + (valor - media) ** 2, 0) / valores.length;
  return Math.sqrt(varianza);
};

const fechaDeCaso = (caso) => {
  const candidata = caso?.datos?.fechaTransaccion
    || caso?.createdAt
    || caso?.datos?.fecha;
  const fecha = candidata ? new Date(candidata) : null;
  return fecha && !Number.isNaN(fecha.getTime()) ? fecha : null;
};

/**
 * Filtra las operaciones históricas del cliente.
 *
 * @param {Array<object>} casos
 * @param {{cedula?: string, cliente?: string, excluirCaseId?: string}} opciones
 */
export const casosDelCliente = (casos = [], opciones = {}) => {
  const cedula = String(opciones.cedula || '').trim();
  const nombre = normalizar(opciones.cliente);

  return (Array.isArray(casos) ? casos : []).filter(caso => {
    if (!caso || (opciones.excluirCaseId && caso.id === opciones.excluirCaseId)) return false;
    const datos = caso.datos || {};
    if (cedula) return String(datos.cedula || '').trim() === cedula;
    return Boolean(nombre) && normalizar(datos.cliente) === nombre;
  });
};

const contarValores = (valores) => {
  const mapa = new Map();
  valores.forEach(valor => {
    const clave = normalizar(valor);
    if (!clave || clave === 'n/a') return;
    const actual = mapa.get(clave) || { valor: String(valor).trim(), veces: 0 };
    actual.veces += 1;
    mapa.set(clave, actual);
  });
  return [...mapa.values()].sort((a, b) => b.veces - a.veces);
};

/**
 * Construye el perfil con las operaciones previas del cliente.
 *
 * @param {Array<object>} casos Historial completo (se filtra por cliente)
 * @param {{cedula?: string, cliente?: string, excluirCaseId?: string}} opciones
 */
export const construirPerfilTransaccional = (casos = [], opciones = {}) => {
  const historicos = casosDelCliente(casos, opciones);
  const montos = historicos
    .map(caso => numero(caso.datos?.valor))
    .filter(monto => monto > 0);
  const fechas = historicos.map(fechaDeCaso).filter(Boolean).sort((a, b) => a - b);

  const primera = fechas[0] || null;
  const ultima = fechas[fechas.length - 1] || null;
  const mesesCubiertos = primera && ultima
    ? Math.max(1, (ultima.getFullYear() - primera.getFullYear()) * 12 + (ultima.getMonth() - primera.getMonth()) + 1)
    : 1;

  return {
    suficiente: historicos.length >= UMBRALES_PERFIL.minimoOperaciones,
    totalOperaciones: historicos.length,
    operacionesConMonto: montos.length,
    montoPromedio: Math.round(promedio(montos)),
    montoMediana: Math.round(mediana(montos)),
    montoMaximo: montos.length ? Math.max(...montos) : 0,
    montoMinimo: montos.length ? Math.min(...montos) : 0,
    desviacionEstandar: Math.round(desviacionEstandar(montos)),
    actos: contarValores(historicos.map(caso => caso.datos?.acto)),
    mediosPago: contarValores(historicos.map(caso => caso.datos?.medioPago)),
    origenesFondos: contarValores(historicos.map(caso => caso.datos?.origen)),
    operacionesPorMes: Math.round((historicos.length / mesesCubiertos) * 100) / 100,
    mesesCubiertos,
    primeraOperacion: primera ? primera.toISOString() : null,
    ultimaOperacion: ultima ? ultima.toISOString() : null,
    fechas
  };
};

const contieneNormalizado = (coleccion = [], valor) => {
  const buscado = normalizar(valor);
  return Boolean(buscado)
    && buscado !== 'n/a'
    && coleccion.some(item => normalizar(item?.valor) === buscado);
};

const dentroDeVentana = (fecha, ahora, dias) => {
  const diferencia = ahora.getTime() - fecha.getTime();
  return diferencia >= 0 && diferencia <= dias * 24 * 60 * 60 * 1000;
};

/**
 * Compara una operación con el perfil histórico.
 *
 * @param {object} datosActuales Datos del caso en curso
 * @param {object} perfil Resultado de construirPerfilTransaccional
 * @param {{ahora?: Date}} opciones
 * @returns {{suficiente: boolean, nivel: string, alertas: Array<{codigo:string,severidad:string,mensaje:string}>}}
 */
export const evaluarDesviaciones = (datosActuales = {}, perfil = {}, opciones = {}) => {
  if (!perfil?.suficiente) {
    return { suficiente: false, nivel: 'sin_perfil', alertas: [] };
  }

  const alertas = [];
  const monto = numero(datosActuales.valor);
  const { multiploPromedio, multiploMaximo, multiploPromedioAlto, multiploMaximoAlto } = UMBRALES_PERFIL;

  if (monto > 0 && perfil.montoPromedio > 0) {
    const ratioPromedio = monto / perfil.montoPromedio;
    const ratioMaximo = perfil.montoMaximo > 0 ? monto / perfil.montoMaximo : 0;

    const superaUmbralAlto = ratioPromedio >= multiploPromedioAlto || ratioMaximo >= multiploMaximoAlto;
    const superaUmbral = ratioPromedio >= multiploPromedio && ratioMaximo >= multiploMaximo;

    if (superaUmbralAlto || superaUmbral) {
      alertas.push({
        codigo: 'monto_atipico',
        severidad: superaUmbralAlto ? 'alta' : 'media',
        mensaje: `El monto (USD ${monto.toLocaleString('es-EC')}) supera el comportamiento habitual del cliente (promedio USD ${perfil.montoPromedio.toLocaleString('es-EC')}, máximo USD ${perfil.montoMaximo.toLocaleString('es-EC')}).`
      });
    }
  }

  const actoActual = String(datosActuales.acto || '').trim();
  if (actoActual && !contieneNormalizado(perfil.actos, actoActual)) {
    alertas.push({
      codigo: 'acto_no_habitual',
      severidad: 'media',
      mensaje: `El acto "${actoActual}" no aparece en las operaciones previas del cliente.`
    });
  }

  const medioActual = String(datosActuales.medioPago || '').trim();
  if (monto > 0 && medioActual && perfil.mediosPago.length > 0 && !contieneNormalizado(perfil.mediosPago, medioActual)) {
    alertas.push({
      codigo: 'medio_pago_no_habitual',
      severidad: 'media',
      mensaje: `El medio de pago "${medioActual}" no se usó en las operaciones previas del cliente.`
    });
  }

  const origenActual = String(datosActuales.origen || '').trim();
  if (monto > 0 && origenActual && perfil.origenesFondos.length > 0 && !contieneNormalizado(perfil.origenesFondos, origenActual)) {
    alertas.push({
      codigo: 'origen_no_habitual',
      severidad: 'media',
      mensaje: `El origen de fondos "${origenActual}" no se declaró en las operaciones previas del cliente.`
    });
  }

  const ahora = opciones.ahora instanceof Date ? opciones.ahora : new Date();
  const operacionesVentana = perfil.fechas.filter(fecha =>
    dentroDeVentana(fecha, ahora, UMBRALES_PERFIL.ventanaFrecuenciaDias)
  ).length + 1;
  const esperado = Math.max(1, Math.ceil(perfil.operacionesPorMes));

  if (
    operacionesVentana >= UMBRALES_PERFIL.minimoOperacionesVentana
    && operacionesVentana > esperado * UMBRALES_PERFIL.multiploFrecuencia
  ) {
    alertas.push({
      codigo: 'frecuencia_atipica',
      severidad: 'media',
      mensaje: `${operacionesVentana} operaciones en los últimos ${UMBRALES_PERFIL.ventanaFrecuenciaDias} días frente a un promedio de ${perfil.operacionesPorMes} por mes.`
    });
  }

  const nivel = alertas.some(a => a.severidad === 'alta')
    ? 'atipico'
    : alertas.length > 0
      ? 'observar'
      : 'normal';

  return { suficiente: true, nivel, alertas };
};

/**
 * Resumen legible del perfil para la UI.
 */
export const describirPerfil = (perfil = {}) => {
  if (!perfil?.suficiente) {
    return perfil?.totalOperaciones > 0
      ? `Solo hay ${perfil.totalOperaciones} operación(es) previa(s): no alcanza para establecer un perfil.`
      : 'Sin operaciones previas registradas para este cliente.';
  }

  const actos = perfil.actos.slice(0, 3).map(a => `${a.valor} (${a.veces})`).join(', ');
  return `${perfil.totalOperaciones} operaciones previas; promedio USD ${perfil.montoPromedio.toLocaleString('es-EC')}, máximo USD ${perfil.montoMaximo.toLocaleString('es-EC')}; ${perfil.operacionesPorMes}/mes${actos ? `; actos: ${actos}` : ''}.`;
};

export const describirDesviaciones = (evaluacion = {}) => {
  if (!evaluacion?.suficiente) return describirPerfil({ suficiente: false });
  if (evaluacion.nivel === 'normal') return 'La operación se mantiene dentro del perfil transaccional del cliente.';
  return evaluacion.alertas.map(alerta => alerta.mensaje).join(' | ');
};
