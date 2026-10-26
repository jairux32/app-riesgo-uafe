import { describe, it, expect } from 'vitest';
import {
  requiereRevision,
  estaRevisada,
  validarRevision,
  resumenRevisiones,
  todasLasListasVerificadas,
  detallesRevisiones,
  describirRevisiones
} from '../utils/revisionCoincidencias';
import { validarDDC } from '../utils/validators';
import { DDC_INICIAL } from '../data/constants';

const revisionValida = {
  decision: 'descartado',
  revisor: 'Ana Pérez',
  fecha: '2026-10-26',
  justificacion: 'Se contrastó cédula y fecha de nacimiento: es un homónimo.'
};

const verificacion = (extra = {}) => ({
  estado: 'posible',
  fecha: '2026-10-26T10:00:00.000Z',
  resultado: 'Posible coincidencia (75%)',
  coincidencias: [{ nombre: 'JUAN PEREZ', confianza: 75 }],
  versionLista: 'OFAC 2026-10',
  revision: null,
  ...extra
});

describe('requiereRevision / estaRevisada', () => {
  it('solo exige revisión para posible y coincidencia', () => {
    expect(requiereRevision({ estado: 'posible' })).toBe(true);
    expect(requiereRevision({ estado: 'coincidencia' })).toBe(true);
    expect(requiereRevision({ estado: 'no_encontrado' })).toBe(false);
    expect(requiereRevision({ estado: 'no_configurado' })).toBe(false);
    expect(estaRevisada({ estado: 'no_encontrado' })).toBe(true);
  });

  it('considera revisada una ficha completa', () => {
    expect(estaRevisada(verificacion({ revision: revisionValida }))).toBe(true);
  });

  it('no considera revisada una ficha sin justificación', () => {
    const sinJustificacion = { ...revisionValida, justificacion: '' };
    expect(estaRevisada(verificacion({ revision: sinJustificacion }))).toBe(false);
  });

  it('no considera revisada una ficha con justificación insuficiente o sin fecha', () => {
    expect(estaRevisada(verificacion({ revision: { ...revisionValida, justificacion: 'corta' } }))).toBe(false);
    expect(estaRevisada(verificacion({ revision: { ...revisionValida, fecha: '' } }))).toBe(false);
  });
});

describe('validarRevision', () => {
  it('acepta una ficha completa', () => {
    expect(validarRevision(revisionValida)).toEqual({ valida: true, faltantes: [] });
  });

  it('rechaza decisiones desconocidas y justificaciones cortas', () => {
    const resultado = validarRevision({
      decision: 'otra',
      revisor: '',
      fecha: '',
      justificacion: 'corta'
    });

    expect(resultado.valida).toBe(false);
    expect(resultado.faltantes.join(' ')).toMatch(/decisión/);
    expect(resultado.faltantes.join(' ')).toMatch(/responsable/);
    expect(resultado.faltantes.join(' ')).toMatch(/fecha/);
    expect(resultado.faltantes.join(' ')).toMatch(/20 caracteres/);
  });
});

describe('resumenRevisiones', () => {
  it('marca pendiente una coincidencia sin ficha', () => {
    const resultado = resumenRevisiones({ ofac: verificacion() });

    expect(resultado.total).toBe(1);
    expect(resultado.pendientes).toHaveLength(1);
    expect(resultado.completa).toBe(false);
  });

  it('marca completa cuando todas las coincidencias tienen ficha', () => {
    const resultado = resumenRevisiones({
      ofac: verificacion({ revision: revisionValida })
    });

    expect(resultado.completa).toBe(true);
    expect(resultado.descartadas).toHaveLength(1);
    expect(resultado.confirmadas).toHaveLength(0);
  });

  it('cuenta las coincidencias confirmadas', () => {
    const resultado = resumenRevisiones({
      onu: verificacion({ estado: 'coincidencia', revision: { ...revisionValida, decision: 'confirmado' } })
    });

    expect(resultado.confirmadas).toHaveLength(1);
    expect(resultado.descartadas).toHaveLength(0);
  });

  it('no cuenta como confirmada una ficha incompleta', () => {
    const resultado = resumenRevisiones({
      uk: verificacion({
        estado: 'coincidencia',
        revision: { decision: 'confirmado', revisor: '', fecha: '', justificacion: '' }
      })
    });

    expect(resultado.pendientes).toHaveLength(1);
    expect(resultado.confirmadas).toHaveLength(0);
    expect(resultado.completa).toBe(false);
  });

  it('ignora las listas sin coincidencias', () => {
    const resultado = resumenRevisiones({
      ofac: verificacion({ estado: 'no_encontrado' }),
      onu: verificacion({ estado: 'no_configurado' })
    });

    expect(resultado.total).toBe(0);
    expect(resultado.completa).toBe(true);
  });
});

describe('todasLasListasVerificadas', () => {
  it('exige que todas las listas tengan fuente', () => {
    expect(todasLasListasVerificadas({
      ofac: verificacion({ estado: 'no_encontrado' }),
      onu: verificacion({ estado: 'no_encontrado' })
    })).toBe(true);

    expect(todasLasListasVerificadas({
      ofac: verificacion({ estado: 'no_encontrado' }),
      onu: verificacion({ estado: 'no_configurado' })
    })).toBe(false);

    expect(todasLasListasVerificadas({})).toBe(false);
  });
});

describe('detalles y descripción de revisiones', () => {
  it('exporta los campos de la ficha', () => {
    const detalles = detallesRevisiones({
      ofac: verificacion({ revision: revisionValida })
    });

    expect(detalles[0]).toMatchObject({
      tipo: 'ofac',
      decision: 'descartado',
      revisor: 'Ana Pérez',
      justificacion: revisionValida.justificacion
    });
  });

  it('describe pendientes y revisadas', () => {
    expect(describirRevisiones({}))
      .toBe('Sin coincidencias que revisar.');

    const pendiente = describirRevisiones({ ofac: verificacion() });
    expect(pendiente).toContain('OFAC: revisión pendiente');

    const revisada = describirRevisiones({
      uk: verificacion({ revision: revisionValida })
    });
    expect(revisada).toContain('UK: descartado');
    expect(revisada).toContain('Ana Pérez');
  });
});

describe('validarDDC con coincidencias', () => {
  const base = {
    tipoPersona: 'natural',
    ddc: { ...DDC_INICIAL, identificacion: true, proposito: true, origenFondos: true, listas: true }
  };

  it('bloquea la DDC si hay una coincidencia sin revisar', () => {
    const resultado = validarDDC({ ...base, verificaciones: { ofac: verificacion() } });

    expect(resultado.completa).toBe(false);
    expect(resultado.faltantes).toContain('revisión documentada de las coincidencias en listas');
  });

  it('permite continuar si la coincidencia fue descartada', () => {
    const resultado = validarDDC({
      ...base,
      verificaciones: { ofac: verificacion({ revision: revisionValida }) }
    });

    expect(resultado.completa).toBe(true);
  });

  it('advierte cuando la coincidencia se confirma', () => {
    const resultado = validarDDC({
      ...base,
      verificaciones: {
        ofac: verificacion({ revision: { ...revisionValida, decision: 'confirmado' } })
      }
    });

    expect(resultado.completa).toBe(true);
    expect(resultado.advertencias.join(' ')).toMatch(/ROS/);
  });
});
