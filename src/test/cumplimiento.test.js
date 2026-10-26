import { describe, it, expect } from 'vitest';
import {
  evaluarCumplimientoInstitucional,
  getEstadoCumplimientoStyle,
  describirVencimiento
} from '../utils/cumplimiento';

const PERFIL_COMPLETO = {
  codigoSISLAFT: 'UAFE-12345',
  oficialCumplimiento: 'Ana Pérez',
  fechaDesignacionOC: '2025-03-01',
  manualAprobado: true,
  manualFecha: '2025-02-15',
  ebrFecha: '2026-05-01',
  capacitacionFecha: '2026-04-10'
};

describe('evaluarCumplimientoInstitucional', () => {
  it('marca todos los requisitos como pendientes con un perfil vacío', () => {
    const result = evaluarCumplimientoInstitucional({}, { hoy: '2026-10-26' });

    expect(result.cumple).toBe(false);
    expect(result.requiereAtencion).toBe(true);
    expect(result.pendientes).toHaveLength(5);
    expect(result.items.every(item => item.estado === 'pendiente')).toBe(true);
  });

  it('considera cumplido un perfil con todos los requisitos vigentes', () => {
    const result = evaluarCumplimientoInstitucional(PERFIL_COMPLETO, { hoy: '2026-10-26' });

    expect(result.cumple).toBe(true);
    expect(result.pendientes).toHaveLength(0);
    expect(result.requiereAtencion).toBe(false);
  });

  it('marca la EBR como vencida después de 12 meses', () => {
    const result = evaluarCumplimientoInstitucional(
      { ...PERFIL_COMPLETO, ebrFecha: '2025-09-01' },
      { hoy: '2026-10-26' }
    );

    const ebr = result.items.find(item => item.clave === 'ebr');
    expect(ebr.estado).toBe('vencido');
    expect(ebr.dias).toBeLessThan(0);
    expect(result.vencidos.some(item => item.clave === 'ebr')).toBe(true);
  });

  it('marca la capacitación como por vencer dentro de 30 días', () => {
    const result = evaluarCumplimientoInstitucional(
      { ...PERFIL_COMPLETO, capacitacionFecha: '2025-11-15' },
      { hoy: '2026-10-26' }
    );

    const capacitacion = result.items.find(item => item.clave === 'capacitacion');
    expect(capacitacion.estado).toBe('por_vencer');
    expect(capacitacion.dias).toBeLessThanOrEqual(30);
    expect(result.porVencer).toHaveLength(1);
  });

  it('exige la fecha de designación del oficial de cumplimiento', () => {
    const result = evaluarCumplimientoInstitucional(
      { ...PERFIL_COMPLETO, fechaDesignacionOC: '' },
      { hoy: '2026-10-26' }
    );

    const oc = result.items.find(item => item.clave === 'oficialCumplimiento');
    expect(oc.estado).toBe('pendiente');
    expect(result.cumple).toBe(false);
  });

  it('exige que el manual esté aprobado y con fecha', () => {
    const sinFecha = evaluarCumplimientoInstitucional(
      { ...PERFIL_COMPLETO, manualFecha: '' },
      { hoy: '2026-10-26' }
    );
    const sinAprobacion = evaluarCumplimientoInstitucional(
      { ...PERFIL_COMPLETO, manualAprobado: false },
      { hoy: '2026-10-26' }
    );

    expect(sinFecha.items.find(i => i.clave === 'manualPrevencion').estado).toBe('pendiente');
    expect(sinAprobacion.items.find(i => i.clave === 'manualPrevencion').estado).toBe('pendiente');
  });

  it('acepta un umbral de aviso personalizado', () => {
    const result = evaluarCumplimientoInstitucional(
      { ...PERFIL_COMPLETO, ebrFecha: '2025-12-01' },
      { hoy: '2026-10-26', diasPorVencer: 60 }
    );

    expect(result.items.find(i => i.clave === 'ebr').estado).toBe('por_vencer');
  });
});

describe('helpers de presentación', () => {
  it('devuelve etiqueta y color por estado', () => {
    expect(getEstadoCumplimientoStyle('vencido').etiqueta).toBe('Vencido');
    expect(getEstadoCumplimientoStyle('vigente').color).toBe('var(--verde)');
    expect(getEstadoCumplimientoStyle('desconocido').etiqueta).toBe('desconocido');
  });

  it('describe el vencimiento en lenguaje natural', () => {
    expect(describirVencimiento({ estado: 'vencido', dias: -5 })).toBe('Vencido hace 5 día(s)');
    expect(describirVencimiento({ estado: 'por_vencer', dias: 10 })).toBe('Vence en 10 día(s)');
    expect(describirVencimiento({ estado: 'vigente', vence: '2027-01-01' })).toBe('Vigente hasta 2027-01-01');
    expect(describirVencimiento({ estado: 'completo' })).toBe('Registrado');
    expect(describirVencimiento({ estado: 'pendiente' })).toBe('Pendiente de registrar');
  });
});
