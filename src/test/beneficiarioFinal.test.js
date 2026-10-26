import { describe, it, expect } from 'vitest';
import {
  UMBRAL_BENEFICIARIO_FINAL,
  calcularParticipacionEfectiva,
  evaluarCadenaPropiedad,
  describirCadenaPropiedad,
  filasCadenaPropiedad
} from '../utils/beneficiarioFinal';
import { validarDDC } from '../utils/validators';
import { DDC_INICIAL } from '../data/constants';

const nivel = (extra = {}) => ({
  nombre: 'Titular',
  identificacion: '1713175071',
  tipo: 'natural',
  porcentaje: '100',
  pais: 'ECU',
  ...extra
});

describe('calcularParticipacionEfectiva', () => {
  it('devuelve el porcentaje directo en el primer nivel', () => {
    const [primero] = calcularParticipacionEfectiva([nivel({ porcentaje: '60' })]);
    expect(primero.participacionEfectiva).toBe(60);
  });

  it('multiplica los porcentajes en cadenas indirectas', () => {
    const niveles = calcularParticipacionEfectiva([
      nivel({ porcentaje: '60' }),
      nivel({ porcentaje: '50', nombre: 'Sociedad intermedia', tipo: 'juridica' })
    ]);

    expect(niveles[0].participacionEfectiva).toBe(60);
    expect(niveles[1].participacionEfectiva).toBe(30);
  });

  it('calcula tres niveles con decimales', () => {
    const niveles = calcularParticipacionEfectiva([
      nivel({ porcentaje: '50' }),
      nivel({ porcentaje: '50' }),
      nivel({ porcentaje: '50' })
    ]);

    expect(niveles[2].participacionEfectiva).toBe(12.5);
  });

  it('marca como no calculables los porcentajes inválidos y los posteriores', () => {
    const niveles = calcularParticipacionEfectiva([
      nivel({ porcentaje: '0' }),
      nivel({ porcentaje: '50' })
    ]);

    expect(niveles[0].participacionEfectiva).toBeNull();
    expect(niveles[1].participacionEfectiva).toBeNull();
  });

  it('ignora valores no numéricos', () => {
    const [n] = calcularParticipacionEfectiva([nivel({ porcentaje: 'abc' })]);
    expect(n.participacionEfectiva).toBeNull();
  });
});

describe('evaluarCadenaPropiedad', () => {
  it('identifica como beneficiario final a la persona natural con 10% o más', () => {
    const resultado = evaluarCadenaPropiedad([
      nivel({ nombre: 'Sociedad A', tipo: 'juridica', porcentaje: '60' }),
      nivel({ nombre: 'Ana Pérez', porcentaje: '20' }),
      nivel({ nombre: 'Luis Pérez', porcentaje: '50' })
    ]);

    expect(resultado.beneficiarios.map(b => b.nombre)).toEqual(['Ana Pérez']);
    expect(resultado.beneficiarios[0].participacionEfectiva).toBe(12);
    expect(resultado.alcanzaUmbral).toBe(true);
  });

  it('no considera beneficiario a una persona jurídica aunque supere el umbral', () => {
    const resultado = evaluarCadenaPropiedad([nivel({ tipo: 'juridica', porcentaje: '100' })]);

    expect(resultado.beneficiarios).toHaveLength(0);
    expect(resultado.alcanzaUmbral).toBe(false);
  });

  it('marca incompletos los niveles sin identificación', () => {
    const resultado = evaluarCadenaPropiedad([nivel({ identificacion: '' })]);

    expect(resultado.incompletos).toHaveLength(1);
  });

  it('detecta una participación directa superior al 100%', () => {
    const resultado = evaluarCadenaPropiedad([nivel({ porcentaje: '130' })]);

    expect(resultado.totalDirecto).toBe(130);
  });

  it('permite ajustar el umbral', () => {
    const cadena = [nivel({ porcentaje: '8' })];

    expect(evaluarCadenaPropiedad(cadena).alcanzaUmbral).toBe(false);
    expect(evaluarCadenaPropiedad(cadena, { umbral: 5 }).alcanzaUmbral).toBe(true);
    expect(UMBRAL_BENEFICIARIO_FINAL).toBe(10);
  });
});

describe('describirCadenaPropiedad', () => {
  it('describe cada nivel con su participación efectiva', () => {
    const texto = describirCadenaPropiedad([
      nivel({ nombre: 'Sociedad A', tipo: 'juridica', porcentaje: '60' }),
      nivel({ nombre: 'Ana Pérez', porcentaje: '50' })
    ]);

    expect(texto).toContain('Nivel 1: Sociedad A');
    expect(texto).toContain('60% efectivo');
    expect(texto).toContain('Nivel 2: Ana Pérez');
    expect(texto).toContain('30% efectivo');
  });

  it('devuelve null cuando no hay cadena', () => {
    expect(describirCadenaPropiedad([])).toBeNull();
    expect(describirCadenaPropiedad()).toBeNull();
  });
});

describe('filasCadenaPropiedad', () => {
  it('devuelve filas listas para exportar', () => {
    const filas = filasCadenaPropiedad([nivel({ porcentaje: '60' })]);

    expect(filas[0]).toMatchObject({
      nivel: 1,
      nombre: 'Titular',
      tipo: 'Persona natural',
      porcentaje: '60%',
      participacionEfectiva: '60%'
    });
  });
});

describe('validarDDC con cadena de propiedad', () => {
  const base = {
    tipoPersona: 'juridica',
    ddc: {
      ...DDC_INICIAL,
      identificacion: true,
      proposito: true,
      origenFondos: true,
      listas: true,
      beneficiarioFinal: true
    },
    beneficiarioFinal: { nombre: 'Ana Pérez', cedula: '1713175071', porcentaje: '30' }
  };

  it('exige completar la cadena cuando se declaró', () => {
    const resultado = validarDDC({
      ...base,
      cadenaPropiedad: [nivel({ identificacion: '' })]
    });

    expect(resultado.completa).toBe(false);
    expect(resultado.faltantes).toContain(
      'cadena de propiedad completa (nombre, identificación y porcentaje en cada nivel)'
    );
  });

  it('advierte cuando nadie alcanza el 10%', () => {
    const resultado = validarDDC({
      ...base,
      cadenaPropiedad: [nivel({ porcentaje: '5' })]
    });

    expect(resultado.completa).toBe(true);
    expect(resultado.advertencias.join(' ')).toMatch(/10%/);
  });

  it('no altera la validación si no hay cadena', () => {
    const resultado = validarDDC(base);
    expect(resultado.completa).toBe(true);
    expect(resultado.advertencias).toHaveLength(0);
  });
});
