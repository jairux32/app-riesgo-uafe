// Observabilidad del cliente.
//
// El objetivo es saber que algo falló sin llevarse datos del caso a un tercero.
// Por eso:
//
// 1. Todo texto pasa por `redactar`: correos, identificaciones, tokens y
//    claves se sustituyen antes de registrar o enviar nada.
// 2. El contexto es una lista blanca de claves técnicas (etapa, código HTTP,
//    versión del prompt, etc.). Un objeto libre podría arrastrar el nombre del
//    cliente o el prompt completo, así que se descarta lo que no esté listado.
// 3. El envío remoto es opcional: sin `VITE_LOG_ENDPOINT` los eventos quedan
//    solo en la consola del navegador y en una cola en memoria.
// 4. Se deduplican y se limitan por ventana: un bucle de render no debe
//    inundar Cloud Logging ni la cuota del proyecto.
//
// El backend (`logClientError`) vuelve a validar todo: el cliente nunca es
// confiable, aunque sea el nuestro.

export const NIVELES = ['error', 'warn', 'info'];

// Claves de contexto admitidas. Son datos técnicos, no del cliente.
export const CLAVES_CONTEXTO_PERMITIDAS = [
  'etapa',
  'operacion',
  'accion',
  'codigo',
  'codigoHttp',
  'duracionMs',
  'modelo',
  'promptVersion',
  'contextoVersion',
  'tipo',
  'total',
  'intentos',
  'online',
  'paso',
  'proveedor',
  'motivo',
  'recurso',
  'sincronizados',
  'pendientes',
  'caseId',
  'nivelRiesgo'
];

export const MAX_MENSAJE = 500;
export const MAX_STACK = 2000;
export const MAX_TEXTO_CONTEXTO = 200;
export const MAX_CONTEXTO_CHARS = 1500;
export const MAX_EVENTOS_POR_MINUTO = 20;
export const VENTANA_MS = 60_000;
export const VENTANA_DEDUPE_MS = 5_000;
export const MAX_COLA = 50;

/**
 * Sustituye datos personales o secretos que puedan aparecer en un mensaje de
 * error, una URL o un stack. No pretende ser exhaustivo: es una barrera más,
 * junto con la lista blanca de contexto.
 */
export const redactar = (valor) => {
  const texto = typeof valor === 'string' ? valor : String(valor ?? '');
  return texto
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [token]')
    .replace(/(api[_-]?key|token|password|contrase(?:n|ñ)a|clave)\s*[:=]\s*[^\s,;]+/gi, '$1=[oculto]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[correo]')
    // Cédula (10), RUC (13) y cualquier secuencia numérica de ese largo.
    .replace(/\b\d{10,13}\b/g, '[identificacion]');
};

const truncar = (texto, maximo) => (
  texto.length > maximo ? `${texto.slice(0, maximo)}…` : texto
);

/**
 * Normaliza cualquier valor lanzado a un objeto serializable. Los `throw` de
 * JavaScript no tienen por qué ser `Error`.
 */
export const describirError = (error) => {
  if (error === null || error === undefined) {
    return { nombre: null, mensaje: 'Error desconocido', stack: null };
  }

  if (typeof error === 'string') {
    return {
      nombre: null,
      mensaje: truncar(redactar(error), MAX_MENSAJE),
      stack: null
    };
  }

  const nombre = typeof error.name === 'string' ? truncar(redactar(error.name), 80) : null;
  const mensaje = truncar(redactar(error.message || String(error)), MAX_MENSAJE);
  const stack = typeof error.stack === 'string'
    ? truncar(redactar(error.stack), MAX_STACK)
    : null;

  return { nombre, mensaje, stack };
};

const valorDeContexto = (valor) => {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (typeof valor === 'boolean') return valor;
  if (typeof valor === 'string') return truncar(redactar(valor), MAX_TEXTO_CONTEXTO);
  if (Array.isArray(valor)) {
    return valor
      .slice(0, 10)
      .map(item => (typeof item === 'string' || typeof item === 'number' ? valorDeContexto(item) : null))
      .filter(item => item !== null);
  }
  return null;
};

/**
 * Filtra el contexto por la lista blanca y acota su tamaño total. Se aplica
 * antes de cualquier registro para que un objeto accidental no arrastre PII.
 */
export const limitarContexto = (contexto = {}) => {
  if (!contexto || typeof contexto !== 'object' || Array.isArray(contexto)) return {};

  const resultado = {};
  let tamano = 0;

  for (const clave of CLAVES_CONTEXTO_PERMITIDAS) {
    if (!Object.prototype.hasOwnProperty.call(contexto, clave)) continue;

    const valor = valorDeContexto(contexto[clave]);
    if (valor === null) continue;

    const costo = JSON.stringify({ [clave]: valor }).length;
    if (tamano + costo > MAX_CONTEXTO_CHARS) break;

    resultado[clave] = valor;
    tamano += costo;
  }

  return resultado;
};

const slug = (valor, maximo = 40) => truncar(
  String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'desconocido',
  maximo
);

const rutaActual = (ubicacion) => {
  const pathname = ubicacion?.pathname;
  if (typeof pathname !== 'string') return null;
  // Solo la ruta: los parámetros pueden llevar tokens de recuperación.
  return truncar(pathname, 200);
};

/**
 * Construye el evento que se registra y, si hay endpoint, se envía. Es puro
 * salvo por los valores que recibe.
 */
export const construirEvento = ({
  nivel = 'error',
  origen,
  error,
  mensaje,
  contexto,
  idSesion = null,
  ocurridoEn = new Date().toISOString(),
  ubicacion = globalThis.location,
  agente = globalThis.navigator?.userAgent,
  version = null
} = {}) => {
  const descripcion = describirError(error);
  const texto = mensaje !== undefined
    ? truncar(redactar(mensaje), MAX_MENSAJE)
    : descripcion.mensaje;

  return {
    nivel: NIVELES.includes(nivel) ? nivel : 'error',
    origen: slug(origen || 'cliente'),
    mensaje: texto || 'Error sin mensaje',
    nombreError: descripcion.nombre,
    stack: descripcion.stack,
    contexto: limitarContexto(contexto),
    idSesion: idSesion ? truncar(String(idSesion), 64) : null,
    ocurridoEn,
    ruta: rutaActual(ubicacion),
    agente: agente ? truncar(redactar(agente), 120) : null,
    version: version ? truncar(redactar(version), 40) : null
  };
};

/**
 * Crea el registrador. Se inyectan el reloj, la consola y el envío para poder
 * probarlo sin red ni temporizadores reales.
 */
export const crearObservabilidad = ({
  enviar = null,
  ahora = () => Date.now(),
  consola = globalThis.console,
  maxPorVentana = MAX_EVENTOS_POR_MINUTO,
  ventanaMs = VENTANA_MS,
  idSesion = null,
  version = null
} = {}) => {
  const cola = [];
  const marcas = [];
  const recientes = new Map();
  let omitidos = 0;
  let duplicados = 0;

  const limpiarVentana = (instante) => {
    while (marcas.length > 0 && instante - marcas[0] > ventanaMs) marcas.shift();
    for (const [clave, marca] of recientes) {
      if (instante - marca > VENTANA_DEDUPE_MS) recientes.delete(clave);
    }
  };

  const registrar = (opciones = {}) => {
    const instante = ahora();
    limpiarVentana(instante);

    const evento = construirEvento({
      ...opciones,
      idSesion: opciones.idSesion ?? idSesion,
      ocurridoEn: new Date(instante).toISOString(),
      version: opciones.version ?? version
    });

    const clave = `${evento.origen}|${evento.nombreError || ''}|${evento.mensaje}`;
    if (recientes.has(clave)) {
      duplicados += 1;
      return null;
    }

    if (marcas.length >= maxPorVentana) {
      omitidos += 1;
      return null;
    }

    recientes.set(clave, instante);
    marcas.push(instante);

    cola.push(evento);
    if (cola.length > MAX_COLA) cola.shift();

    const metodo = evento.nivel === 'error' ? 'error' : evento.nivel === 'warn' ? 'warn' : 'info';
    consola?.[metodo]?.('[observabilidad]', evento);

    if (enviar) {
      Promise.resolve()
        .then(() => enviar(evento))
        .catch(() => {
          // Si falla el envío no se puede volver a reportar: sería un bucle.
        });
    }

    return evento;
  };

  return {
    registrar,
    eventos: () => [...cola],
    estadisticas: () => ({ omitidos, duplicados, enCola: cola.length }),
    limpiar: () => {
      cola.length = 0;
      marcas.length = 0;
      recientes.clear();
      omitidos = 0;
      duplicados = 0;
    }
  };
};

/**
 * Envío al endpoint propio (`logClientError`). Adjunta el ID token si hay
 * sesión, porque la Function lo usa para atribuir el error sin confiar en el
 * cuerpo. `keepalive` permite que el evento salga aunque la pestaña se cierre.
 */
export const crearEnvioRemoto = ({
  endpoint,
  obtenerToken,
  fetchImpl = globalThis.fetch
} = {}) => {
  if (!endpoint || typeof fetchImpl !== 'function') return null;

  return async (evento) => {
    const headers = { 'Content-Type': 'application/json' };

    if (obtenerToken) {
      try {
        const token = await obtenerToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      } catch {
        // Se envía sin token: la Function acepta el evento anónimo con límite.
      }
    }

    await fetchImpl(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(evento),
      keepalive: true
    });
  };
};

/**
 * Instancia compartida por la app. Sin configurar, solo escribe en consola.
 */
let observabilidad = crearObservabilidad();
let configurado = { endpoint: null };

export const configurarObservabilidad = ({ endpoint, obtenerToken, ...resto } = {}) => {
  const enviar = crearEnvioRemoto({ endpoint, obtenerToken });
  observabilidad = crearObservabilidad({ ...resto, enviar });
  configurado = { endpoint: endpoint || null };
  return observabilidad;
};

export const registrarEvento = (opciones) => observabilidad.registrar(opciones);
export const eventosRecientes = () => observabilidad.eventos();
export const estadoObservabilidad = () => ({ ...observabilidad.estadisticas(), ...configurado });
export const reiniciarObservabilidad = () => observabilidad.limpiar();

/**
 * Captura lo que se escapa de React: errores de scripts y promesas rechazadas
 * sin `catch`. Devuelve una función para desinstalar los manejadores.
 */
export const instalarManejadoresGlobales = ({
  ventana = globalThis,
  registrar = registrarEvento
} = {}) => {
  if (!ventana?.addEventListener) return () => {};

  const alFallar = (event) => {
    registrar({
      nivel: 'error',
      origen: 'global',
      error: event?.error || event?.message || 'Error de script',
      contexto: { etapa: 'window_error' }
    });
  };

  const alRechazar = (event) => {
    registrar({
      nivel: 'error',
      origen: 'global',
      error: event?.reason || 'Promesa rechazada sin manejo',
      contexto: { etapa: 'unhandled_rejection' }
    });
  };

  ventana.addEventListener('error', alFallar);
  ventana.addEventListener('unhandledrejection', alRechazar);

  return () => {
    ventana.removeEventListener('error', alFallar);
    ventana.removeEventListener('unhandledrejection', alRechazar);
  };
};

/**
 * Punto de entrada desde `main.jsx`: configura el envío (si hay endpoint) e
 * instala los manejadores globales.
 */
export const instalarObservabilidad = (opciones = {}) => {
  if (opciones.endpoint !== undefined || opciones.obtenerToken) {
    configurarObservabilidad(opciones);
  }
  return instalarManejadoresGlobales(opciones);
};
