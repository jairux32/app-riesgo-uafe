import { describe, it, expect } from 'vitest';
import {
  UMBRAL_ROS,
  NIVELES_RIESGO,
  scoreDeCaso,
  nivelDeScore,
  estadoReporteRos,
  calcularCalidadModelo,
  casosParaRevisar,
  describirCalidad
} from '../utils/calidadModelo';

const caso = (id, extra = {}) => ({
  id,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-11T10:00:00.000Z',
  inherentScore: 10,
  datos: {
    cliente: `Cliente ${id}`,
    acto: 'Compraventa',
    estado: 'en_revision',
    reportes: {},
    ...(extra.datos || {})
  },
  ...extra
});

const conRos = (id, score = 22, estado = 'enviado') => caso(id, {
  inherentScore: score,
  datos: {
    estado: 'reportado_uafe',
    reportes: { ros: { tipo: 'ROS', estado } }
  }
});

const conNoRos = (id, score = 22, estado = 'enviado') => caso(id, {
  inherentScore: score,
  datos: {
    estado: 'aprobado',
    reportes: { ros: { tipo: 'NO-ROS', estado } }
  }
});

describe('scoreDeCaso', () => {
  it('prefiere el score guardado', () => {
    expect(scoreDeCaso({ inherentScore: 17 })).toBe(17);
    expect(scoreDeCaso({ inherentScore: 0 })).toBe(0);
  });

  it('recalcula el score desde las evaluaciones si falta el guardado', () => {
    expect(scoreDeCaso({ evaluaciones: {} })).toBeNull();
    expect(scoreDeCaso({ evaluaciones: { SA01: { prob: 1, imp: 5 } } })).toBeGreaterThan(0);
  });

  it('devuelve null sin información', () => {
    expect(scoreDeCaso({})).toBeNull();
    expect(scoreDeCaso(null)).toBeNull();
  });
});

describe('nivelDeScore', () => {
  it('respeta los límites de cada nivel', () => {
    expect(nivelDeScore(0).id).toBe('bajo');
    expect(nivelDeScore(8).id).toBe('bajo');
    expect(nivelDeScore(9).id).toBe('medio');
    expect(nivelDeScore(14).id).toBe('medio');
    expect(nivelDeScore(15).id).toBe('medio_alto');
    expect(nivelDeScore(19).id).toBe('medio_alto');
    expect(nivelDeScore(20).id).toBe('alto');
    expect(nivelDeScore(25).id).toBe('alto');
    expect(nivelDeScore(null)).toBeNull();
    expect(NIVELES_RIESGO).toHaveLength(4);
    expect(UMBRAL_ROS).toBe(20);
  });
});

describe('estadoReporteRos', () => {
  it('reconoce ROS y NO-ROS enviados o con acuse', () => {
    expect(estadoReporteRos(conRos('1'))).toBe('ros');
    expect(estadoReporteRos(conRos('2', 22, 'acuse_recibido'))).toBe('ros');
    expect(estadoReporteRos(conNoRos('3'))).toBe('no_ros');
  });

  it('trata no_aplica y pendiente', () => {
    expect(estadoReporteRos(caso('1', { datos: { reportes: { ros: { estado: 'no_aplica' } } } }))).toBe('no_aplica');
    expect(estadoReporteRos(caso('2'))).toBe('pendiente');
  });

  it('usa el estado del caso reportado_uafe cuando no hay reporte explícito', () => {
    expect(estadoReporteRos(caso('1', { datos: { estado: 'reportado_uafe' } }))).toBe('ros');
  });
});

describe('calcularCalidadModelo', () => {
  it('devuelve ceros y una alerta con el historial vacío', () => {
    const metricas = calcularCalidadModelo([]);

    expect(metricas.totalCasos).toBe(0);
    expect(metricas.casosEvaluados).toBe(0);
    expect(metricas.alertas[0].tipo).toBe('sin_datos');
    expect(describirCalidad(metricas)).toMatch(/Sin casos evaluados/);
  });

  it('calcula distribución, promedio y muestra insuficiente', () => {
    const metricas = calcularCalidadModelo([
      caso('1', { inherentScore: 5 }),
      caso('2', { inherentScore: 12 }),
      caso('3', { inherentScore: 17 }),
      caso('4', { inherentScore: 22 })
    ], { hoy: '2026-10-26' });

    expect(metricas.casosEvaluados).toBe(4);
    expect(metricas.promedioScore).toBe(14);
    expect(metricas.distribucion.map(n => n.count)).toEqual([1, 1, 1, 1]);
    expect(metricas.muestraSuficiente).toBe(false);
    expect(metricas.alertas.map(a => a.tipo)).toContain('muestra_insuficiente');
  });

  it('marca una posible subestimación cuando hay ROS con score bajo', () => {
    const metricas = calcularCalidadModelo([
      conRos('1', 10),
      conRos('2', 18),
      caso('3', { inherentScore: 22 })
    ], { hoy: '2026-10-26' });

    const [alta, media] = metricas.calibracion.posiblesSubestimaciones;
    expect(alta.severidad).toBe('alta');
    expect(alta.score).toBe(10);
    expect(media.severidad).toBe('media');
    expect(metricas.calibracion.tasaSubestimacion).toBe(66.7);
    expect(metricas.alertas.map(a => a.tipo)).toContain('posible_subestimacion');
  });

  it('marca una posible sobreestimación cuando hay NO-ROS con score alto', () => {
    const metricas = calcularCalidadModelo([
      conNoRos('1', 22),
      caso('2', { inherentScore: 10 })
    ], { hoy: '2026-10-26' });

    expect(metricas.calibracion.posiblesSobreestimaciones).toHaveLength(1);
    expect(metricas.calibracion.posiblesSobreestimaciones[0].score).toBe(22);
    expect(metricas.calibracion.tasaSobreestimacion).toBe(50);
  });

  it('detecta riesgo alto sin decisión de reporte', () => {
    const metricas = calcularCalidadModelo([
      caso('1', { inherentScore: 24, datos: { estado: 'en_revision' } }),
      caso('2', { inherentScore: 24, datos: { estado: 'borrador' } })
    ], { hoy: '2026-10-26' });

    expect(metricas.calibracion.riesgoAltoSinDecision).toHaveLength(1);
    expect(metricas.calibracion.riesgoAltoSinDecision[0].id).toBe('1');
    expect(metricas.alertas.map(a => a.tipo)).toContain('riesgo_alto_sin_decision');
  });

  it('cuenta ROS vencidos de casos de riesgo alto', () => {
    const metricas = calcularCalidadModelo([
      caso('1', {
        inherentScore: 23,
        datos: {
          estado: 'aprobado',
          reportes: { ros: { tipo: 'ROS', estado: 'pendiente', fechaLimite: '2026-10-20' } }
        }
      })
    ], { hoy: '2026-10-26' });

    expect(metricas.reportes.rosVencidos).toBe(1);
    expect(metricas.alertas.map(a => a.tipo)).toContain('ros_vencido');
  });

  it('calcula el tiempo de cierre solo con casos cerrados', () => {
    const metricas = calcularCalidadModelo([
      caso('1', {
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-11T10:00:00.000Z',
        datos: { estado: 'aprobado' }
      }),
      caso('2', {
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-21T10:00:00.000Z',
        datos: { estado: 'reportado_uafe' }
      }),
      caso('3', {
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-25T10:00:00.000Z',
        datos: { estado: 'borrador' }
      })
    ], { hoy: '2026-10-26' });

    expect(metricas.tiempos.muestra).toBe(2);
    expect(metricas.tiempos.promedioDias).toBe(15);
    expect(metricas.tiempos.medianaDias).toBe(15);
  });

  it('agrupa las versiones del dictamen y calcula la cobertura de IA', () => {
    const metricas = calcularCalidadModelo([
      caso('1', {
        inherentScore: 10,
        analysis: { _meta: { modelo: 'llama-3.3-70b-versatile', promptVersion: '2.1', contextoVersion: '1.3' } }
      }),
      caso('2', {
        inherentScore: 12,
        analysis: { _meta: { modelo: 'llama-3.3-70b-versatile', promptVersion: '2.1', contextoVersion: '1.3' } }
      }),
      caso('3', { inherentScore: 14 }),
      caso('4', { inherentScore: 16 }),
      caso('5', { inherentScore: 18 })
    ], { hoy: '2026-10-26' });

    expect(metricas.conAnalisisIA).toBe(2);
    expect(metricas.coberturaIA).toBe(40);
    expect(metricas.versiones[0]).toEqual({
      version: 'llama-3.3-70b-versatile · prompt 2.1 · contexto 1.3',
      count: 2
    });
    expect(metricas.alertas.map(a => a.tipo)).toContain('cobertura_ia');
  });

  it('acepta un umbral de ROS personalizado', () => {
    const metricas = calcularCalidadModelo([
      conNoRos('1', 18)
    ], { hoy: '2026-10-26', umbralRos: 15 });

    expect(metricas.calibracion.posiblesSobreestimaciones).toHaveLength(1);
  });
});

describe('casosParaRevisar', () => {
  it('une los grupos sin duplicados y prioriza la severidad alta', () => {
    const metricas = {
      calibracion: {
        posiblesSubestimaciones: [
          { id: '1', severidad: 'media', cliente: 'A' },
          { id: '2', severidad: 'alta', cliente: 'B' }
        ],
        posiblesSobreestimaciones: [
          { id: '2', severidad: 'alta', cliente: 'B' },
          { id: '3', severidad: 'media', cliente: 'C' }
        ],
        riesgoAltoSinDecision: [
          { id: '4', severidad: 'alta', cliente: 'D' }
        ]
      }
    };

    const revision = casosParaRevisar(metricas);

    expect(revision.map(item => item.id)).toEqual(['2', '4', '1', '3']);
    expect(casosParaRevisar({})).toEqual([]);
  });
});

describe('describirCalidad', () => {
  it('resume las métricas cuando la muestra es suficiente', () => {
    const metricas = calcularCalidadModelo([
      caso('1', { inherentScore: 5 }),
      caso('2', { inherentScore: 10 }),
      caso('3', { inherentScore: 15 }),
      caso('4', { inherentScore: 20 }),
      caso('5', { inherentScore: 25 })
    ], { hoy: '2026-10-26' });

    const texto = describirCalidad(metricas);
    expect(texto).toContain('5 caso(s) evaluado(s)');
    expect(texto).toContain('score promedio 15/25');
    expect(texto).toContain('posible(s) subestimación(es)');
  });

  it('advierte cuando la muestra es pequeña', () => {
    const metricas = calcularCalidadModelo([caso('1', { inherentScore: 10 })], { hoy: '2026-10-26' });
    expect(describirCalidad(metricas)).toMatch(/demasiado pequeña/);
  });
});
