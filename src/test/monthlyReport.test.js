import { describe, it, expect } from 'vitest';
import {
  claveMesLocal,
  construirResumenMensual,
  NIVELES_REPORTE,
  nivelDeScore,
  scoreDeCaso
} from '../utils/monthlyReport';

const AHORA = new Date(2026, 9, 15, 12); // 15 de octubre de 2026, hora local

const caso = (id, extra = {}) => ({
  id,
  createdAt: new Date(2026, 9, 10, 12).toISOString(),
  inherentScore: 10,
  datos: {
    cliente: `Cliente ${id}`,
    acto: 'Compraventa',
    valor: '5000',
    reportes: {},
    ...(extra.datos || {})
  },
  ...extra
});

describe('claveMesLocal', () => {
  it('usa la fecha local del navegador', () => {
    expect(claveMesLocal(new Date(2026, 0, 1, 0, 30))).toBe('2026-01');
    expect(claveMesLocal(new Date(2026, 9, 31, 23, 30))).toBe('2026-10');
  });

  it('devuelve null con una fecha inválida', () => {
    expect(claveMesLocal('no-es-fecha')).toBeNull();
    expect(claveMesLocal(null)).toBeNull();
  });
});

describe('nivelDeScore', () => {
  it('respeta los cortes del motor: ALTO empieza en 20', () => {
    expect(nivelDeScore(8)).toBe('bajo');
    expect(nivelDeScore(9)).toBe('medio');
    expect(nivelDeScore(14)).toBe('medio');
    expect(nivelDeScore(15)).toBe('medio_alto');
    expect(nivelDeScore(19)).toBe('medio_alto');
    expect(nivelDeScore(20)).toBe('alto');
    expect(nivelDeScore(25)).toBe('alto');
    expect(nivelDeScore(null)).toBeNull();
  });

  it('declara los cuatro niveles del catálogo', () => {
    expect(NIVELES_REPORTE.map(nivel => nivel.id)).toEqual(['bajo', 'medio', 'medio_alto', 'alto']);
  });
});

describe('scoreDeCaso', () => {
  it('prefiere el score guardado', () => {
    expect(scoreDeCaso({ inherentScore: 17 })).toBe(17);
  });

  it('recalcula desde las evaluaciones si no hay score guardado', () => {
    const score = scoreDeCaso({ evaluaciones: { SA01: { prob: 1, imp: 5 } } });
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(25);
  });

  it('distingue un caso sin evaluar de un riesgo 0', () => {
    expect(scoreDeCaso({})).toBeNull();
    expect(scoreDeCaso({ inherentScore: 0 })).toBe(0);
  });
});

describe('construirResumenMensual', () => {
  it('solo incluye los casos del mes local de referencia', () => {
    const resumen = construirResumenMensual([
      caso('octubre', { createdAt: new Date(2026, 9, 5, 12).toISOString() }),
      caso('septiembre', { createdAt: new Date(2026, 8, 30, 12).toISOString() }),
      caso('noviembre', { createdAt: new Date(2026, 10, 1, 12).toISOString() }),
      caso('sin-fecha', { createdAt: undefined })
    ], { ahora: AHORA });

    expect(resumen.total).toBe(1);
    expect(resumen.periodo).toEqual({ clave: '2026-10', etiqueta: 'octubre de 2026' });
    expect(resumen.casos.map(c => c.id)).toEqual(['octubre']);
  });

  it('calcula distribución, promedio y casos sin evaluar', () => {
    const resumen = construirResumenMensual([
      caso('bajo', { inherentScore: 5 }),
      caso('medio', { inherentScore: 10 }),
      caso('medio-alto', { inherentScore: 17 }),
      caso('alto', { inherentScore: 22 }),
      caso('borrador', { inherentScore: null, evaluaciones: {} })
    ], { ahora: AHORA });

    expect(resumen.total).toBe(5);
    expect(resumen.evaluados).toBe(4);
    expect(resumen.sinEvaluar).toBe(1);
    expect(resumen.niveles).toEqual({ bajo: 1, medio: 1, medio_alto: 1, alto: 1 });
    expect(resumen.promedioScore).toBe(13.5);
    expect(resumen.casos.find(c => c.id === 'borrador').score).toBeNull();
  });

  it('no cuenta el tramo 15-19 como riesgo alto', () => {
    const resumen = construirResumenMensual([
      caso('diecinueve', { inherentScore: 19 }),
      caso('veinte', { inherentScore: 20 })
    ], { ahora: AHORA });

    expect(resumen.niveles.medio_alto).toBe(1);
    expect(resumen.niveles.alto).toBe(1);
  });

  it('resume RESU/NO-RESU y ROS/NO-ROS con estados y vencimientos', () => {
    const resumen = construirResumenMensual([
      caso('uno', {
        datos: {
          reportes: {
            resu: { tipo: 'RESU', estado: 'enviado' },
            ros: { tipo: 'ROS', estado: 'pendiente', fechaLimite: '2026-10-01' }
          }
        }
      }),
      caso('dos', {
        datos: {
          reportes: {
            resu: { tipo: 'NO-RESU', estado: 'pendiente', fechaLimite: '2026-11-10' },
            ros: { tipo: 'NO-ROS', estado: 'acuse_recibido' }
          }
        }
      })
    ], { ahora: AHORA });

    expect(resumen.obligaciones.resu).toEqual({
      reportar: 1,
      noReportar: 1,
      pendientes: 1,
      enviados: 1,
      noAplica: 0,
      vencidos: 0
    });
    expect(resumen.obligaciones.ros).toEqual({
      reportar: 1,
      noReportar: 1,
      pendientes: 1,
      enviados: 1,
      noAplica: 0,
      vencidos: 1
    });
  });

  it('no cuenta como vencida una obligación ya enviada', () => {
    const resumen = construirResumenMensual([
      caso('uno', {
        datos: {
          reportes: {
            resu: { tipo: 'RESU', estado: 'enviado', fechaLimite: '2026-09-30' },
            ros: { tipo: 'ROS', estado: 'acuse_recibido', fechaLimite: '2026-09-30' }
          }
        }
      })
    ], { ahora: AHORA });

    expect(resumen.obligaciones.resu.vencidos).toBe(0);
    expect(resumen.obligaciones.ros.vencidos).toBe(0);
  });

  it('usa el plazo sugerido cuando el caso aún no tiene seguimiento', () => {
    const resumen = construirResumenMensual([
      caso('sugerido', { datos: { valor: '50000', medioPago: 'transferencia' } })
    ], { ahora: AHORA });

    expect(resumen.obligaciones.resu.reportar).toBe(1);
    expect(resumen.obligaciones.resu.noReportar).toBe(0);
    expect(resumen.obligaciones.resu.pendientes).toBe(1);
    expect(resumen.obligaciones.ros.noReportar).toBe(1);
  });

  it('devuelve un resumen vacío sin casos en el periodo', () => {
    const resumen = construirResumenMensual([], { ahora: AHORA });

    expect(resumen.total).toBe(0);
    expect(resumen.evaluados).toBe(0);
    expect(resumen.promedioScore).toBe(0);
    expect(resumen.niveles).toEqual({ bajo: 0, medio: 0, medio_alto: 0, alto: 0 });
    expect(resumen.casos).toEqual([]);
    expect(resumen.obligaciones.resu.pendientes).toBe(0);
  });
});
