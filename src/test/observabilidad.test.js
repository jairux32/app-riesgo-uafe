import { describe, it, expect, vi } from 'vitest';
import {
  redactar,
  describirError,
  limitarContexto,
  construirEvento,
  crearObservabilidad,
  crearEnvioRemoto,
  instalarManejadoresGlobales,
  MAX_MENSAJE,
  MAX_EVENTOS_POR_MINUTO,
  CLAVES_CONTEXTO_PERMITIDAS
} from '../utils/observabilidad';

describe('redactar', () => {
  it('oculta correos, identificaciones y tokens', () => {
    const texto = redactar(
      'Fallo con 1710034065 y RUC 1790012345001, correo ana@notaria.ec, '
      + 'Authorization: Bearer abc.def-123 y apiKey=secreta'
    );

    expect(texto).not.toContain('1710034065');
    expect(texto).not.toContain('1790012345001');
    expect(texto).not.toContain('ana@notaria.ec');
    expect(texto).not.toContain('abc.def-123');
    expect(texto).not.toContain('secreta');
    expect(texto).toContain('[identificacion]');
    expect(texto).toContain('[correo]');
    expect(texto).toContain('[token]');
  });

  it('tolera valores nulos y no strings', () => {
    expect(redactar(null)).toBe('');
    expect(redactar(undefined)).toBe('');
    expect(redactar(42)).toBe('42');
  });
});

describe('describirError', () => {
  it('extrae nombre, mensaje y stack de un Error', () => {
    const error = new TypeError('No se pudo leer el archivo');
    const descripcion = describirError(error);

    expect(descripcion.nombre).toBe('TypeError');
    expect(descripcion.mensaje).toBe('No se pudo leer el archivo');
    expect(descripcion.stack).toContain('TypeError');
  });

  it('acepta strings y valores vacíos', () => {
    expect(describirError('falló la red').mensaje).toBe('falló la red');
    expect(describirError(null).mensaje).toBe('Error desconocido');
    expect(describirError(undefined).nombre).toBeNull();
  });

  it('recorta mensajes largos', () => {
    const descripcion = describirError(new Error('x'.repeat(900)));
    expect(descripcion.mensaje.length).toBe(MAX_MENSAJE + 1);
    expect(descripcion.mensaje.endsWith('…')).toBe(true);
  });
});

describe('limitarContexto', () => {
  it('conserva solo las claves técnicas permitidas', () => {
    const contexto = limitarContexto({
      etapa: 'subida',
      codigoHttp: 500,
      cliente: 'Ana Pérez',
      cedula: '1710034065',
      prompt: 'datos del caso'
    });

    expect(contexto).toEqual({ etapa: 'subida', codigoHttp: 500 });
  });

  it('descarta objetos anidados y números no finitos', () => {
    const contexto = limitarContexto({
      etapa: { nombre: 'objeto' },
      duracionMs: Number.POSITIVE_INFINITY,
      total: 3
    });

    expect(contexto).toEqual({ total: 3 });
  });

  it('redacta y recorta los textos', () => {
    const contexto = limitarContexto({
      motivo: `falló con ana@notaria.ec ${'y'.repeat(400)}`
    });

    expect(contexto.motivo).not.toContain('ana@notaria.ec');
    expect(contexto.motivo.length).toBeLessThanOrEqual(201);
  });

  it('acota los arreglos a diez elementos primitivos', () => {
    const contexto = limitarContexto({ codigo: ['a', 'b', { x: 1 }, 'c'] });
    expect(contexto.codigo).toEqual(['a', 'b', 'c']);
  });

  it('ignora contextos inválidos', () => {
    expect(limitarContexto()).toEqual({});
    expect(limitarContexto(null)).toEqual({});
    expect(limitarContexto([])).toEqual({});
    expect(limitarContexto('texto')).toEqual({});
  });

  it('respeta el tamaño máximo del contexto', () => {
    const grande = {};
    CLAVES_CONTEXTO_PERMITIDAS.forEach((clave) => {
      grande[clave] = 'z'.repeat(200);
    });

    const contexto = limitarContexto(grande);
    expect(JSON.stringify(contexto).length).toBeLessThanOrEqual(1500);
    expect(Object.keys(contexto).length).toBeGreaterThan(0);
    expect(Object.keys(contexto).length).toBeLessThan(CLAVES_CONTEXTO_PERMITIDAS.length);
  });
});

describe('construirEvento', () => {
  it('arma un evento con ruta sin parámetros', () => {
    const evento = construirEvento({
      origen: 'Sincronización Offline',
      error: new Error('falló ana@notaria.ec'),
      contexto: { etapa: 'subida', cliente: 'Ana' },
      ocurridoEn: '2026-10-26T10:00:00.000Z',
      ubicacion: { pathname: '/dashboard', search: '?token=abc' },
      agente: 'Mozilla/5.0',
      version: '1.2.3'
    });

    expect(evento.nivel).toBe('error');
    expect(evento.origen).toBe('sincronizacion_offline');
    expect(evento.mensaje).toContain('[correo]');
    expect(evento.contexto).toEqual({ etapa: 'subida' });
    expect(evento.ruta).toBe('/dashboard');
    expect(evento.version).toBe('1.2.3');
    expect(evento.ocurridoEn).toBe('2026-10-26T10:00:00.000Z');
  });

  it('normaliza niveles desconocidos y mensajes vacíos', () => {
    const evento = construirEvento({ nivel: 'fatal', mensaje: '' });
    expect(evento.nivel).toBe('error');
    expect(evento.mensaje).toBe('Error sin mensaje');
    expect(evento.origen).toBe('cliente');
    expect(evento.contexto).toEqual({});
  });
});

describe('crearObservabilidad', () => {
  const crearConsola = () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() });

  it('registra, escribe en consola y devuelve el evento', () => {
    const consola = crearConsola();
    const observabilidad = crearObservabilidad({ consola, ahora: () => 1_000 });

    const evento = observabilidad.registrar({
      origen: 'prueba',
      mensaje: 'algo falló',
      contexto: { paso: 1 }
    });

    expect(evento.mensaje).toBe('algo falló');
    expect(consola.error).toHaveBeenCalledWith('[observabilidad]', evento);
    expect(observabilidad.eventos()).toHaveLength(1);
  });

  it('usa warn e info según el nivel', () => {
    const consola = crearConsola();
    const observabilidad = crearObservabilidad({ consola, ahora: () => 1_000 });

    observabilidad.registrar({ nivel: 'warn', mensaje: 'aviso' });
    observabilidad.registrar({ nivel: 'info', mensaje: 'dato' });

    expect(consola.warn).toHaveBeenCalledTimes(1);
    expect(consola.info).toHaveBeenCalledTimes(1);
  });

  it('deduplica el mismo error dentro de la ventana', () => {
    const consola = crearConsola();
    let instante = 1_000;
    const observabilidad = crearObservabilidad({ consola, ahora: () => instante });

    observabilidad.registrar({ mensaje: 'repetido' });
    instante += 1_000;
    const segundo = observabilidad.registrar({ mensaje: 'repetido' });

    expect(segundo).toBeNull();
    expect(observabilidad.eventos()).toHaveLength(1);
    expect(observabilidad.estadisticas().duplicados).toBe(1);
  });

  it('vuelve a registrar el mismo mensaje pasado el dedupe', () => {
    const consola = crearConsola();
    let instante = 1_000;
    const observabilidad = crearObservabilidad({ consola, ahora: () => instante });

    observabilidad.registrar({ mensaje: 'repetido' });
    instante += 10_000;
    observabilidad.registrar({ mensaje: 'repetido' });

    expect(observabilidad.eventos()).toHaveLength(2);
  });

  it('limita la cantidad de eventos por ventana', () => {
    const consola = crearConsola();
    const observabilidad = crearObservabilidad({ consola, ahora: () => 1_000, maxPorVentana: 2 });

    observabilidad.registrar({ mensaje: 'uno' });
    observabilidad.registrar({ mensaje: 'dos' });
    const tercero = observabilidad.registrar({ mensaje: 'tres' });

    expect(tercero).toBeNull();
    expect(observabilidad.estadisticas().omitidos).toBe(1);
    expect(observabilidad.eventos()).toHaveLength(2);
  });

  it('envía al destino configurado y no propaga sus errores', async () => {
    const enviar = vi.fn().mockRejectedValue(new Error('sin red'));
    const observabilidad = crearObservabilidad({
      consola: crearConsola(),
      enviar,
      ahora: () => 1_000
    });

    observabilidad.registrar({ mensaje: 'fallo remoto' });
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar.mock.calls[0][0].mensaje).toBe('fallo remoto');
  });

  it('limpiar reinicia la cola y los contadores', () => {
    const observabilidad = crearObservabilidad({ consola: crearConsola(), ahora: () => 1_000 });
    observabilidad.registrar({ mensaje: 'x' });

    observabilidad.limpiar();

    expect(observabilidad.eventos()).toEqual([]);
    expect(observabilidad.estadisticas()).toMatchObject({ omitidos: 0, duplicados: 0 });
  });

  it('expone el máximo por defecto', () => {
    const observabilidad = crearObservabilidad({ consola: crearConsola() });
    expect(MAX_EVENTOS_POR_MINUTO).toBe(20);
    expect(observabilidad.estadisticas().enCola).toBe(0);
  });
});

describe('crearEnvioRemoto', () => {
  it('devuelve null sin endpoint o sin fetch', () => {
    expect(crearEnvioRemoto({})).toBeNull();
    expect(crearEnvioRemoto({ endpoint: 'https://x.test', fetchImpl: null })).toBeNull();
    expect(typeof crearEnvioRemoto({ endpoint: 'https://x.test', fetchImpl: vi.fn() })).toBe('function');
  });

  it('adjunta el token cuando hay sesión', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const enviar = crearEnvioRemoto({
      endpoint: 'https://x.test/log',
      obtenerToken: () => Promise.resolve('token-123'),
      fetchImpl
    });

    await enviar({ mensaje: 'x' });

    const [, opciones] = fetchImpl.mock.calls[0];
    expect(opciones.method).toBe('POST');
    expect(opciones.keepalive).toBe(true);
    expect(opciones.headers.Authorization).toBe('Bearer token-123');
  });

  it('envía sin token si no hay sesión o falla su lectura', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const enviar = crearEnvioRemoto({
      endpoint: 'https://x.test/log',
      obtenerToken: () => Promise.reject(new Error('sin sesión')),
      fetchImpl
    });

    await enviar({ mensaje: 'x' });

    const [, opciones] = fetchImpl.mock.calls[0];
    expect(opciones.headers.Authorization).toBeUndefined();
  });
});

describe('instalarManejadoresGlobales', () => {
  const crearVentana = () => {
    const manejadores = {};
    return {
      addEventListener: vi.fn((tipo, fn) => { manejadores[tipo] = fn; }),
      removeEventListener: vi.fn(),
      disparar: (tipo, evento) => manejadores[tipo](evento)
    };
  };

  it('reporta errores de script y promesas rechazadas', () => {
    const ventana = crearVentana();
    const registrar = vi.fn();
    instalarManejadoresGlobales({ ventana, registrar });

    ventana.disparar('error', { error: new Error('boom'), message: 'boom' });
    ventana.disparar('unhandledrejection', { reason: 'sin catch' });

    expect(registrar).toHaveBeenCalledTimes(2);
    expect(registrar.mock.calls[0][0]).toMatchObject({
      origen: 'global',
      contexto: { etapa: 'window_error' }
    });
    expect(registrar.mock.calls[1][0]).toMatchObject({
      origen: 'global',
      contexto: { etapa: 'unhandled_rejection' }
    });
  });

  it('usa el mensaje del evento si no hay Error', () => {
    const ventana = crearVentana();
    const registrar = vi.fn();
    instalarManejadoresGlobales({ ventana, registrar });

    ventana.disparar('error', { message: 'script roto' });

    expect(registrar.mock.calls[0][0].error).toBe('script roto');
  });

  it('devuelve una función que quita los manejadores', () => {
    const ventana = crearVentana();
    const desinstalar = instalarManejadoresGlobales({
      ventana,
      registrar: vi.fn()
    });

    desinstalar();

    expect(ventana.removeEventListener).toHaveBeenCalledTimes(2);
  });

  it('no falla si no hay ventana', () => {
    expect(() => instalarManejadoresGlobales({ ventana: null })()).not.toThrow();
  });
});
