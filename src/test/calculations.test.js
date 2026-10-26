import { describe, it, expect } from 'vitest';
import { calculateInherentRisk, calculateResidualRisk } from '../utils/calculations';
import { FACTORES_SENALES_UAFE } from '../data/constants';

const evaluarTodasLasSenales = (prob, imp) => {
  const evaluaciones = {};
  FACTORES_SENALES_UAFE.forEach(factor => {
    factor.subcriterios.forEach(sub => {
      evaluaciones[sub.id] = { prob, imp };
    });
  });
  return evaluaciones;
};

describe('calculateInherentRisk', () => {
  it('devuelve riesgo BAJO para evaluaciones minimas', () => {
    const evaluaciones = {};
    const result = calculateInherentRisk(evaluaciones);
    expect(result.inherente).toBe(0);
    expect(result.nivel).toBe('BAJO');
  });

  it('detecta el sistema de senales UAFE (SA*)', () => {
    const evaluaciones = {
      SA01: { prob: 1, imp: 1 },
      SA02: { prob: 1, imp: 1 },
      SA05: { prob: 1, imp: 1 },
    };
    const result = calculateInherentRisk(evaluaciones);
    expect(result.inherente).toBeGreaterThanOrEqual(0);
    expect(result.factores.length).toBeGreaterThan(0);
  });

  it('devuelve riesgo ALTO para evaluaciones maximas en sistema antiguo', () => {
    const evaluaciones = {
      c1: { prob: 5, imp: 5 },
      c2: { prob: 5, imp: 5 },
      c3: { prob: 5, imp: 5 },
      c4: { prob: 5, imp: 5 },
      p1: { prob: 5, imp: 5 },
      p2: { prob: 5, imp: 5 },
      p3: { prob: 5, imp: 5 },
      d1: { prob: 5, imp: 5 },
      d2: { prob: 5, imp: 5 },
      z1: { prob: 5, imp: 5 },
      z2: { prob: 5, imp: 5 },
      cu1: { prob: 5, imp: 5 },
    };
    const result = calculateInherentRisk(evaluaciones);
    expect(result.inherente).toBeGreaterThanOrEqual(15);
    expect(result.nivel).toMatch(/ALTO|MEDIO-ALTO/);
  });

  it('calcula scores correctamente con evaluaciones mixtas', () => {
    const evaluaciones = {
      c1: { prob: 3, imp: 3 },
      c2: { prob: 2, imp: 2 },
      p1: { prob: 4, imp: 3 },
      p2: { prob: 2, imp: 2 },
    };
    const result = calculateInherentRisk(evaluaciones);
    expect(result.inherente).toBeGreaterThan(0);
    expect(result.inherente).toBeLessThanOrEqual(25);
  });

  it('alcanza 25 (ALTO) con todas las señales presentes y gravedad máxima', () => {
    const result = calculateInherentRisk(evaluarTodasLasSenales(1, 5));
    expect(result.inherente).toBe(25);
    expect(result.nivel).toBe('ALTO');
  });

  it('alcanza 15 (MEDIO-ALTO) con todas las señales presentes y gravedad moderada', () => {
    const result = calculateInherentRisk(evaluarTodasLasSenales(1, 3));
    expect(result.inherente).toBe(15);
    expect(result.nivel).toBe('MEDIO-ALTO');
  });

  it('una señal crítica aislada no se reduce a cero', () => {
    const result = calculateInherentRisk({ SA01: { prob: 1, imp: 5 } });
    expect(result.inherente).toBeGreaterThan(0);
  });

  it('informa la cobertura de evaluación', () => {
    const result = calculateInherentRisk({ SA01: { prob: 1, imp: 5 } });
    expect(result.cobertura.evaluadas).toBe(1);
    expect(result.cobertura.total).toBeGreaterThan(1);
    expect(result.cobertura.porcentaje).toBeLessThan(100);
  });
});

describe('calculateResidualRisk', () => {
  it('reduce el riesgo con controles efectivos', () => {
    const inherentScore = 20;
    const controlesEval = {
      control1: { existe: true, efectividad: 3 },
      control2: { existe: true, efectividad: 3 },
      control3: { existe: true, efectividad: 3 },
    };
    const result = calculateResidualRisk(inherentScore, controlesEval);
    expect(result.residual).toBeLessThan(inherentScore);
    // Solo 3 controles de 10 -> efectividad global 0,3
    expect(Number(result.efectividadPromedio)).toBeCloseTo(0.3, 2);
  });

  it('mantiene el riesgo sin controles', () => {
    const inherentScore = 15;
    const controlesEval = {};
    const result = calculateResidualRisk(inherentScore, controlesEval);
    expect(result.residual).toBe(inherentScore);
    expect(Number(result.efectividadPromedio)).toBe(0);
  });

  it('reduce significativamente con controles maximos', () => {
    const inherentScore = 25;
    const controlesEval = {};
    for (let i = 0; i < 12; i++) {
      controlesEval[`c${i}`] = { existe: true, efectividad: 3 };
    }
    const result = calculateResidualRisk(inherentScore, controlesEval);
    expect(result.residual).toBeLessThan(inherentScore);
    expect(result.residual).toBeGreaterThanOrEqual(0);
  });
});
