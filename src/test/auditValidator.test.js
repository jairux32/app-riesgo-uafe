import { describe, it, expect } from 'vitest';
import { validarContraEsquema, validarRespuestaAuditoria } from '../utils/auditValidator';

const esquema = {
  type: 'object',
  required: ['nombre', 'nivel', 'score'],
  properties: {
    nombre: { type: 'string', maxLength: 10 },
    nivel: { type: 'string', enum: ['BAJO', 'ALTO'] },
    score: { type: 'number', minimum: 0, maximum: 25 },
    codigo: { type: 'string', pattern: '^SA\\d{2,3}$' },
    senales: {
      type: 'array',
      items: {
        type: 'object',
        required: ['codigo'],
        properties: { codigo: { type: 'string' } }
      }
    }
  }
};

describe('validarContraEsquema', () => {
  it('acepta un objeto que cumple el esquema', () => {
    const errores = validarContraEsquema(
      { nombre: 'Caso', nivel: 'ALTO', score: 20, codigo: 'SA01', senales: [{ codigo: 'SA01' }] },
      esquema
    );
    expect(errores).toEqual([]);
  });

  it('detecta campos requeridos ausentes', () => {
    const errores = validarContraEsquema({ nivel: 'ALTO' }, esquema);
    expect(errores.some(e => e.includes('nombre: campo requerido'))).toBe(true);
    expect(errores.some(e => e.includes('score: campo requerido'))).toBe(true);
  });

  it('rechaza valores fuera del enum', () => {
    const errores = validarContraEsquema({ nombre: 'Caso', nivel: 'MEDIO', score: 10 }, esquema);
    expect(errores.some(e => e.includes('fuera de BAJO | ALTO'))).toBe(true);
  });

  it('valida límites numéricos', () => {
    expect(validarContraEsquema({ nombre: 'Caso', nivel: 'ALTO', score: 30 }, esquema).length)
      .toBeGreaterThan(0);
    expect(validarContraEsquema({ nombre: 'Caso', nivel: 'ALTO', score: '20' }, esquema).length)
      .toBeGreaterThan(0);
  });

  it('valida longitud y patrón de texto', () => {
    expect(validarContraEsquema({ nombre: 'Nombre demasiado largo', nivel: 'ALTO', score: 1 }, esquema).length)
      .toBeGreaterThan(0);
    expect(validarContraEsquema({ nombre: 'Caso', nivel: 'ALTO', score: 1, codigo: 'XX1' }, esquema).length)
      .toBeGreaterThan(0);
  });

  it('valida los elementos de un arreglo y su ruta', () => {
    const errores = validarContraEsquema(
      { nombre: 'Caso', nivel: 'ALTO', score: 1, senales: [{ codigo: 'SA01' }, {}] },
      esquema
    );
    expect(errores.some(e => e.includes('senales[1].codigo: campo requerido'))).toBe(true);
  });
});

describe('validarRespuestaAuditoria', () => {
  it('marca como inválida una respuesta vacía y enumera las secciones faltantes', () => {
    const { valido, errores } = validarRespuestaAuditoria({});
    expect(valido).toBe(false);
    expect(errores.some(e => e.includes('dictamen: campo requerido'))).toBe(true);
    expect(errores.some(e => e.includes('fundamento_legal: campo requerido'))).toBe(true);
    expect(errores.some(e => e.includes('recomendacion_final: campo requerido'))).toBe(true);
  });

  it('marca como inválida una respuesta que no es objeto', () => {
    expect(validarRespuestaAuditoria(null).valido).toBe(false);
    expect(validarRespuestaAuditoria('texto').valido).toBe(false);
  });
});
