import { describe, it, expect } from 'vitest';
import { calcularObligaciones, combinarReportes, estadoVencimiento } from '../utils/obligaciones';

describe('calcularObligaciones', () => {
  it('sugiere RESU para operaciones desde USD 10.000 y NO-ROS sin sospecha', () => {
    const { resu, ros } = calcularObligaciones(
      { valor: 15000, fechaTransaccion: '2026-10-15' },
      { scoreInherente: 10, hoy: '2026-10-26' }
    );

    expect(resu.tipo).toBe('RESU');
    expect(resu.fechaLimite).toBe('2026-11-15');
    expect(ros.tipo).toBe('NO-ROS');
    expect(ros.fechaLimite).toBe('2026-11-10');
  });

  it('sugiere NO-RESU para operaciones bajo el umbral', () => {
    const { resu } = calcularObligaciones(
      { valor: 9999.99, fechaTransaccion: '2026-10-05' },
      { scoreInherente: 5, hoy: '2026-10-26' }
    );

    expect(resu.tipo).toBe('NO-RESU');
    expect(resu.fechaLimite).toBe('2026-11-10');
  });

  it('sugiere ROS por score alto, con plazo de 5 días y prórroga de 3', () => {
    const { ros } = calcularObligaciones(
      { valor: 5000, fechaTransaccion: '2026-10-15' },
      { scoreInherente: 20, hoy: '2026-10-26' }
    );

    expect(ros.tipo).toBe('ROS');
    expect(ros.fechaLimite).toBe('2026-10-31');
    expect(ros.fechaLimiteProrroga).toBe('2026-11-03');
  });

  it('calcula el ROS desde la fecha de conocimiento, no desde la transacción', () => {
    const { ros } = calcularObligaciones(
      { valor: 5000, fechaTransaccion: '2026-09-01' },
      { scoreInherente: 20, hoy: '2026-10-26', fechaConocimiento: '2026-10-26' }
    );

    expect(ros.fechaLimite).toBe('2026-10-31');
  });

  it('respeta el dictamen de la IA cuando amerita ROS', () => {
    const { ros } = calcularObligaciones(
      { valor: 5000, fechaTransaccion: '2026-10-15' },
      { scoreInherente: 2, hoy: '2026-10-26', analisis: { ros: { amerita_ros: true } } }
    );

    expect(ros.tipo).toBe('ROS');
  });

  it('cruza correctamente el cambio de año', () => {
    const { resu } = calcularObligaciones(
      { valor: 20000, fechaTransaccion: '2026-12-20' },
      { hoy: '2026-12-20' }
    );

    expect(resu.tipo).toBe('RESU');
    expect(resu.fechaLimite).toBe('2027-01-15');
  });

  it('usa valores por defecto de seguimiento sin marcarlos como enviados', () => {
    const { resu } = calcularObligaciones({ valor: 15000 });
    expect(resu.estado).toBe('pendiente');
    expect(resu.responsable).toBe('Oficial de Cumplimiento');
    expect(resu.fechaEnvio).toBe('');
    expect(resu.acuse).toBe('');
  });
});

describe('combinarReportes', () => {
  const sugerencias = calcularObligaciones(
    { valor: 5000, fechaTransaccion: '2026-10-15' },
    { scoreInherente: 20, hoy: '2026-10-26', fechaConocimiento: '2026-10-26' }
  );

  it('conserva el tipo actual aunque el seguimiento guardado diga otra cosa', () => {
    const { resu } = combinarReportes(sugerencias, {
      resu: { tipo: 'RESU', estado: 'enviado' }
    });

    expect(resu.tipo).toBe('NO-RESU');
    expect(resu.estado).toBe('enviado');
  });

  it('recalcula la fecha límite si el usuario no la editó', () => {
    const { ros } = combinarReportes(sugerencias, {
      ros: { fechaLimite: '2020-01-01', estado: 'pendiente' }
    });

    expect(ros.fechaLimite).toBe(sugerencias.ros.fechaLimite);
  });

  it('respeta la fecha límite editada manualmente', () => {
    const resultado = combinarReportes(sugerencias, {
      ros: { fechaLimite: '2026-11-30', fechaLimiteManual: true }
    });

    expect(resultado.ros.fechaLimite).toBe('2026-11-30');
  });

  it('mantiene el responsable y el acuse guardados', () => {
    const { resu } = combinarReportes(sugerencias, {
      resu: { responsable: 'Ana', acuse: 'SISLAFT-123' }
    });

    expect(resu.responsable).toBe('Ana');
    expect(resu.acuse).toBe('SISLAFT-123');
  });
});

describe('estadoVencimiento', () => {
  it('marca una fecha pasada como vencida', () => {
    const result = estadoVencimiento('2026-10-20', '2026-10-26');
    expect(result.estado).toBe('vencida');
    expect(result.dias).toBe(-6);
  });

  it('marca el mismo día como vence hoy', () => {
    expect(estadoVencimiento('2026-10-26', '2026-10-26').estado).toBe('vence_hoy');
  });

  it('marca los próximos 3 días como por vencer', () => {
    expect(estadoVencimiento('2026-10-28', '2026-10-26').estado).toBe('por_vencer');
  });

  it('marca fechas lejanas como vigentes', () => {
    expect(estadoVencimiento('2026-11-15', '2026-10-26').estado).toBe('vigente');
  });

  it('devuelve sin_fecha para valores inválidos', () => {
    expect(estadoVencimiento('', '2026-10-26').estado).toBe('sin_fecha');
    expect(estadoVencimiento('no-es-fecha', '2026-10-26').estado).toBe('sin_fecha');
  });
});
