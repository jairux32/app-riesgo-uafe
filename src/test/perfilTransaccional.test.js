import { describe, it, expect } from 'vitest';
import {
  UMBRALES_PERFIL,
  casosDelCliente,
  construirPerfilTransaccional,
  evaluarDesviaciones,
  describirPerfil,
  describirDesviaciones
} from '../utils/perfilTransaccional';
import { generarAlertas } from '../utils/alertasInteligentes';

const AHORA = new Date('2026-10-26T12:00:00.000Z');
const diasAtras = (dias) => new Date(AHORA.getTime() - dias * 24 * 60 * 60 * 1000).toISOString();

const caso = (id, extra = {}, createdAt = diasAtras(60)) => ({
  id,
  createdAt,
  datos: {
    cedula: '1713175071',
    cliente: 'Ana Pérez',
    valor: 1000,
    acto: 'Compraventa inmueble',
    medioPago: 'Transferencia',
    origen: 'Ahorro',
    ...extra
  }
});

describe('casosDelCliente', () => {
  it('filtra por cédula y excluye el caso en curso', () => {
    const casos = [
      caso('1'),
      caso('2'),
      caso('3', { cedula: '0999999999' })
    ];

    expect(casosDelCliente(casos, { cedula: '1713175071' }).map(c => c.id)).toEqual(['1', '2']);
    expect(casosDelCliente(casos, { cedula: '1713175071', excluirCaseId: '1' }).map(c => c.id)).toEqual(['2']);
  });

  it('usa el nombre cuando no hay cédula', () => {
    const casos = [caso('1', { cliente: 'ANA PEREZ' }), caso('2', { cliente: 'Otro' })];
    expect(casosDelCliente(casos, { cliente: 'ana perez' }).map(c => c.id)).toEqual(['1']);
  });
});

describe('construirPerfilTransaccional', () => {
  it('no considera suficiente una sola operación previa', () => {
    const perfil = construirPerfilTransaccional([caso('1')], { cedula: '1713175071' });
    expect(perfil.suficiente).toBe(false);
    expect(perfil.totalOperaciones).toBe(1);
    expect(UMBRALES_PERFIL.minimoOperaciones).toBe(2);
  });

  it('calcula estadísticas de monto y frecuencia', () => {
    const perfil = construirPerfilTransaccional([
      caso('1', { valor: 1000 }, diasAtras(90)),
      caso('2', { valor: 2000 }, diasAtras(60)),
      caso('3', { valor: 6000 }, diasAtras(30))
    ], { cedula: '1713175071' });

    expect(perfil.suficiente).toBe(true);
    expect(perfil.montoPromedio).toBe(3000);
    expect(perfil.montoMediana).toBe(2000);
    expect(perfil.montoMaximo).toBe(6000);
    expect(perfil.montoMinimo).toBe(1000);
    expect(perfil.operacionesConMonto).toBe(3);
    expect(perfil.operacionesPorMes).toBe(1);
  });

  it('cuenta actos, medios de pago y orígenes', () => {
    const perfil = construirPerfilTransaccional([
      caso('1', { acto: 'Compraventa inmueble' }),
      caso('2', { acto: 'Compraventa inmueble' }),
      caso('3', { acto: 'Poder especial' })
    ], { cedula: '1713175071' });

    expect(perfil.actos[0]).toEqual({ valor: 'Compraventa inmueble', veces: 2 });
    expect(perfil.mediosPago[0].veces).toBe(3);
    expect(perfil.origenesFondos[0].veces).toBe(3);
  });
});

describe('evaluarDesviaciones', () => {
  const perfil = construirPerfilTransaccional([
    caso('1', { valor: 1000 }),
    caso('2', { valor: 2000 })
  ], { cedula: '1713175071' });

  it('devuelve sin_perfil cuando no hay historial suficiente', () => {
    const evaluacion = evaluarDesviaciones({ valor: 99999 }, { suficiente: false });
    expect(evaluacion.nivel).toBe('sin_perfil');
    expect(evaluacion.alertas).toHaveLength(0);
  });

  it('no alerta una operación habitual', () => {
    const evaluacion = evaluarDesviaciones(caso('actual').datos, perfil, { ahora: AHORA });
    expect(evaluacion.nivel).toBe('normal');
    expect(evaluacion.alertas).toHaveLength(0);
  });

  it('marca un monto que duplica el promedio como desviación media', () => {
    const evaluacion = evaluarDesviaciones(caso('actual', { valor: 3500 }).datos, perfil, { ahora: AHORA });
    const alerta = evaluacion.alertas.find(a => a.codigo === 'monto_atipico');

    expect(alerta.severidad).toBe('media');
    expect(evaluacion.nivel).toBe('observar');
  });

  it('marca como alta una operación que triplica el promedio', () => {
    const evaluacion = evaluarDesviaciones(caso('actual', { valor: 6000 }).datos, perfil, { ahora: AHORA });
    const alerta = evaluacion.alertas.find(a => a.codigo === 'monto_atipico');

    expect(alerta.severidad).toBe('alta');
    expect(evaluacion.nivel).toBe('atipico');
  });

  it('detecta un acto no habitual', () => {
    const evaluacion = evaluarDesviaciones(
      caso('actual', { acto: 'Fideicomiso' }).datos,
      perfil,
      { ahora: AHORA }
    );

    expect(evaluacion.alertas.map(a => a.codigo)).toContain('acto_no_habitual');
  });

  it('no alerta medio de pago u origen vacíos', () => {
    const evaluacion = evaluarDesviaciones(
      caso('actual', { medioPago: '', origen: '' }).datos,
      perfil,
      { ahora: AHORA }
    );

    expect(evaluacion.alertas.map(a => a.codigo)).not.toContain('medio_pago_no_habitual');
    expect(evaluacion.alertas.map(a => a.codigo)).not.toContain('origen_no_habitual');
  });

  it('detecta una frecuencia atípica en la ventana de 30 días', () => {
    const conFrecuencia = construirPerfilTransaccional([
      caso('1', { valor: 1000 }, diasAtras(100)),
      caso('2', { valor: 1000 }, diasAtras(70)),
      caso('3', { valor: 1000 }, diasAtras(20)),
      caso('4', { valor: 1000 }, diasAtras(10))
    ], { cedula: '1713175071' });

    const evaluacion = evaluarDesviaciones(caso('actual').datos, conFrecuencia, { ahora: AHORA });

    expect(evaluacion.alertas.map(a => a.codigo)).toContain('frecuencia_atipica');
  });
});

describe('descripciones', () => {
  it('describe el perfil suficiente', () => {
    const perfil = construirPerfilTransaccional([
      caso('1', { valor: 1000 }),
      caso('2', { valor: 3000 })
    ], { cedula: '1713175071' });

    const texto = describirPerfil(perfil);
    expect(texto).toContain('2 operaciones previas');
    expect(texto).toContain('promedio USD 2.000');
    expect(texto).toContain('máximo USD 3.000');
  });

  it('explica por qué no hay perfil', () => {
    expect(describirPerfil({ suficiente: false, totalOperaciones: 0 })).toMatch(/Sin operaciones/);
    expect(describirPerfil({ suficiente: false, totalOperaciones: 1 })).toMatch(/no alcanza/);
  });

  it('resume las desviaciones', () => {
    const evaluacion = {
      suficiente: true,
      nivel: 'observar',
      alertas: [{ codigo: 'x', severidad: 'media', mensaje: 'Monto atípico.' }]
    };

    expect(describirDesviaciones(evaluacion)).toBe('Monto atípico.');
    expect(describirDesviaciones({ suficiente: true, nivel: 'normal', alertas: [] }))
      .toMatch(/dentro del perfil/);
  });
});

describe('integración con alertas del portfolio', () => {
  it('genera una alerta de desviación de perfil', () => {
    const historial = [
      caso('1', { valor: 1000 }, diasAtras(90)),
      caso('2', { valor: 1000 }, diasAtras(60)),
      caso('3', { valor: 5000, acto: 'Fideicomiso' }, diasAtras(1))
    ];

    const alertas = generarAlertas(historial).filter(a => a.tipo === 'desviacion_perfil');

    expect(alertas).toHaveLength(1);
    expect(alertas[0].casoId).toBe('3');
    expect(alertas[0].prioridad).toBe('alta');
    expect(alertas[0].desviaciones.length).toBeGreaterThan(0);
  });
});
