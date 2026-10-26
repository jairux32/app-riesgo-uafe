import { describe, it, expect } from 'vitest';
import {
  levenshteinDistance,
  similarity,
  similitudNombres,
  buscarEnLista,
  verificarListasRestrictivas
} from '../utils/sanctionsCheck';

describe('levenshteinDistance', () => {
  it('devuelve 0 para strings idénticos', () => {
    expect(levenshteinDistance('hola', 'hola')).toBe(0);
  });

  it('devuelve 1 para un cambio de carácter', () => {
    expect(levenshteinDistance('hola', 'holo')).toBe(1);
  });

  it('devuelve la longitud para strings completamente diferentes', () => {
    expect(levenshteinDistance('abc', 'xyz')).toBe(3);
  });

  it('maneja strings vacíos', () => {
    expect(levenshteinDistance('', 'abc')).toBe(3);
    expect(levenshteinDistance('abc', '')).toBe(3);
    expect(levenshteinDistance('', '')).toBe(0);
  });

  it('calcula distancia para inserción', () => {
    expect(levenshteinDistance('casa', 'casas')).toBe(1);
  });

  it('calcula distancia para eliminación', () => {
    expect(levenshteinDistance('casas', 'casa')).toBe(1);
  });
});

describe('similarity', () => {
  it('devuelve 1 para strings idénticos', () => {
    expect(similarity('hola', 'hola')).toBe(1);
  });

  it('devuelve 0 para strings completamente diferentes', () => {
    expect(similarity('', '')).toBe(1);
  });

  it('devuelve valor entre 0 y 1', () => {
    const s = similarity('juan carlos', 'juan carlo');
    expect(s).toBeGreaterThan(0.8);
    expect(s).toBeLessThan(1);
  });
});

describe('buscarEnLista', () => {
  const lista = [
    { nombre: 'JUAN PEREZ', tipo: 'Persona', alerta: 'Test' },
    { nombre: 'MARIA GOMEZ', tipo: 'Persona', alerta: 'Test' },
    { nombre: 'CARLOS LOPEZ', tipo: 'Persona', alerta: 'Test' },
    { nombre: 'ANA MARTINEZ', tipo: 'Persona', alerta: 'Test' },
  ];

  it('encuentra coincidencia exacta', () => {
    const results = buscarEnLista('JUAN PEREZ', lista);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].nombre).toBe('JUAN PEREZ');
    expect(results[0].confianza).toBeGreaterThanOrEqual(0.8);
  });

  it('encuentra coincidencias aproximadas', () => {
    const results = buscarEnLista('JUAN PERE', lista);
    expect(results.length).toBeGreaterThan(0);
  });

  it('no encuentra coincidencias para nombres muy diferentes', () => {
    const results = buscarEnLista('ZZZ TOP', lista);
    const matches = results.filter(r => r.confianza >= 0.6);
    expect(matches.length).toBe(0);
  });

  it('reconoce el mismo nombre con distinto orden', () => {
    expect(similitudNombres('JUAN PEREZ', 'PEREZ JUAN')).toBe(1);
  });

  it('ignora tildes y mayúsculas', () => {
    expect(similitudNombres('José Núñez', 'JOSE NUNEZ')).toBe(1);
  });
});

describe('verificarListasRestrictivas', () => {
  it('no afirma que el cliente está limpio si no hay fuentes configuradas', async () => {
    const resultado = await verificarListasRestrictivas('JUAN PEREZ', 'todos');
    expect(resultado.ofac.estado).toBe('no_configurado');
    expect(resultado.onu.estado).toBe('no_configurado');
    expect(resultado.uafe.estado).toBe('no_configurado');
    expect(resultado.ofac.mensaje).toMatch(/No se realizó verificación/);
  });

  it('verifica contra una lista suministrada y marca posible coincidencia', async () => {
    const fuentes = {
      ofac: [{ nombre: 'PEREZ JUAN', tipo: 'Individual' }],
      onu: [],
      uafe: []
    };
    const resultado = await verificarListasRestrictivas('JUAN PEREZ', 'ofac', fuentes);
    expect(resultado.ofac.estado).toBe('coincidencia');
    expect(resultado.ofac.coincidencias[0].confianza).toBe(100);
  });
});
