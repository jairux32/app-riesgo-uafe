import { describe, it, expect } from 'vitest';
import { parsearArchivoLista, TIPOS_LISTA, getFuenteOficial } from '../utils/listasDB';

const archivo = (contenido, nombre, tipo = 'text/plain') =>
  new File([contenido], nombre, { type: tipo });

describe('parsearArchivoLista', () => {
  it('lee un CSV con columna Name', async () => {
    const csv = 'Name,Program\nJUAN PEREZ,SDGT\nANA GOMEZ,SDGT\n';
    const { entradas } = await parsearArchivoLista(archivo(csv, 'onu.csv'));

    expect(entradas).toHaveLength(2);
    expect(entradas[0].nombre).toBe('JUAN PEREZ');
  });

  it('lee un CSV de OFAC con columna SDN_Name', async () => {
    const csv = 'SDN_Name,SDN_Type\nPEDRO RAMIREZ,individual\n';
    const { entradas } = await parsearArchivoLista(archivo(csv, 'ofac.csv'));

    expect(entradas[0].nombre).toBe('PEDRO RAMIREZ');
  });

  it('une las partes Name 1..N de las listas del Reino Unido', async () => {
    const csv = 'Name 1,Name 2,Name 3\nMOHAMMED,AL,SAID\n';
    const { entradas } = await parsearArchivoLista(archivo(csv, 'uk.csv'));

    expect(entradas[0].nombre).toBe('MOHAMMED AL SAID');
  });

  it('acepta JSON con arreglo de strings', async () => {
    const json = JSON.stringify(['JUAN PEREZ', 'Ana Gómez']);
    const { entradas } = await parsearArchivoLista(archivo(json, 'lista.json', 'application/json'));

    expect(entradas).toHaveLength(2);
  });

  it('elimina duplicados ignorando mayúsculas y tildes', async () => {
    const json = JSON.stringify(['Ana Gómez', 'ANA GOMEZ', 'ana gomez']);
    const { entradas } = await parsearArchivoLista(archivo(json, 'lista.json', 'application/json'));

    expect(entradas).toHaveLength(1);
  });

  it('rechaza archivos sin una columna de nombres reconocible', async () => {
    const csv = 'Foo,Bar\n1,2\n';
    await expect(parsearArchivoLista(archivo(csv, 'raro.csv'))).rejects.toThrow(/columna de nombres/i);
  });
});

describe('metadatos de listas', () => {
  it('expone los tres tipos soportados con su fuente oficial', () => {
    expect(TIPOS_LISTA).toEqual(['ofac', 'onu', 'uk', 'uafe']);
    expect(getFuenteOficial('ofac')).toMatch(/ofac/i);
    expect(getFuenteOficial('uk')).toMatch(/gov\.uk/i);
    expect(getFuenteOficial('desconocida')).toBeNull();
  });
});
