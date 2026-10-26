import { describe, it, expect } from 'vitest';
import { validarCedulaEcuatoriana, validarRUC, validarIdentificacion, validarMedioPago } from '../utils/validators';

describe('validarCedulaEcuatoriana', () => {
  it('rechaza cédulas con menos de 10 dígitos', () => {
    const result = validarCedulaEcuatoriana('123456789');
    expect(result.valido).toBe(false);
  });

  it('rechaza cédulas con más de 10 dígitos', () => {
    const result = validarCedulaEcuatoriana('12345678901');
    expect(result.valido).toBe(false);
  });

  it('rechaza cédulas con letras', () => {
    const result = validarCedulaEcuatoriana('abcdefghij');
    expect(result.valido).toBe(false);
  });

  it('rechaza cédulas con provincia inválida (>24)', () => {
    const result = validarCedulaEcuatoriana('2500000000');
    expect(result.valido).toBe(false);
  });

  it('rechaza cédulas con provincia 00', () => {
    const result = validarCedulaEcuatoriana('0000000000');
    expect(result.valido).toBe(false);
  });

  it('rechaza cédulas con tercer dígito > 6 (persona natural)', () => {
    const result = validarCedulaEcuatoriana('0170000000');
    expect(result.valido).toBe(false);
  });

  it('rechaza cédulas con código verificador incorrecto usando algoritmo módulo 10', () => {
    const result = validarCedulaEcuatoriana('1710034060');
    expect(result.valido).toBe(false);
  });

  it('valida una cédula ecuatoriana correcta', () => {
    // 1710034065 - dígito verificador real = 5 pero calculado da 0 para este ejemplo
    // Usamos una cédula de prueba válida
    const result = validarCedulaEcuatoriana('1713175071');
    expect(result.valido).toBe(true);
    expect(result.tipo).toBe('Cédula');
  });
});

describe('validarRUC', () => {
  it('rechaza RUC con menos de 13 dígitos', () => {
    const result = validarRUC('123456789012');
    expect(result.valido).toBe(false);
  });

  it('rechaza RUC con letras', () => {
    const result = validarRUC('abcdefghijklm');
    expect(result.valido).toBe(false);
  });

  it('rechaza RUC con código de establecimiento 000', () => {
    // 1713175071000 - últimos 3 dígitos son 000 (establecimiento inválido)
    const result = validarRUC('1713175071000');
    expect(result.valido).toBe(false);
  });
});

describe('validarIdentificacion', () => {
  it('detecta pasaporte para identificaciones alfanuméricas', () => {
    const result = validarIdentificacion('ABC123456');
    expect(result.tipo).toBe('Pasaporte');
    expect(result.valido).toBe(true);
  });

  it('detecta cédula para 10 dígitos numéricos', () => {
    const result = validarIdentificacion('1713175071');
    expect(result.tipo).toBe('Cédula');
  });

  it('detecta RUC para 13 digitos numericos', () => {
    const result = validarIdentificacion('1790011674001');
    expect(result.tipo).toContain('RUC');
    expect(result.valido).toBe(true);
  });

  it('rechaza identificaciones con formato inválido', () => {
    const result = validarIdentificacion('12');
    expect(result.valido).toBe(false);
  });

  it('rechaza pasaportes demasiado cortos', () => {
    const result = validarIdentificacion('AB');
    expect(result.valido).toBe(false);
  });

  it('rechaza pasaportes demasiado largos', () => {
    const result = validarIdentificacion('AB' + '1'.repeat(20));
    expect(result.valido).toBe(false);
  });
});

describe('validarMedioPago', () => {
  it('permite efectivo por debajo de 100 SBU', () => {
    const result = validarMedioPago(48000, 'Efectivo');
    expect(result.valido).toBe(true);
  });

  it('bloquea efectivo por encima de 100 SBU (48.200 con SBU 2026)', () => {
    const result = validarMedioPago(48201, 'Efectivo');
    expect(result.valido).toBe(false);
    expect(result.motivo).toBe('excede_efectivo');
  });

  it('permite transferencias de alto valor', () => {
    const result = validarMedioPago(250000, 'Transferencia');
    expect(result.valido).toBe(true);
  });

  it('exige medio de pago desde USD 10.000', () => {
    const result = validarMedioPago(12000, '');
    expect(result.valido).toBe(false);
    expect(result.motivo).toBe('medio_pago_requerido');
  });

  it('advierte sobre el efectivo en pagos mixtos de alto valor', () => {
    const result = validarMedioPago(30000, 'Mixto');
    expect(result.valido).toBe(true);
    expect(result.advertencia).toMatch(/100 SBU/);
  });

  it('acepta el límite parametrizado', () => {
    expect(validarMedioPago(1000, 'Efectivo', { limiteEfectivo: 500 }).valido).toBe(false);
  });
});
