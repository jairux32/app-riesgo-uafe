import { describe, it, expect } from 'vitest';
import {
  TIPOS_EVIDENCIA,
  EVIDENCIAS_MINIMAS,
  hashBytes,
  hashArchivo,
  crearRegistroEvidencia,
  validarEvidencia,
  verificarIntegridad,
  resumenEvidencias,
  formatearTamano,
  describirEvidencias,
  filasEvidencias,
  etiquetaTipoEvidencia
} from '../utils/evidencias';

const HASH_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

const archivo = (contenido = 'abc', nombre = 'documento.pdf') =>
  new File([contenido], nombre, { type: 'application/pdf' });

describe('hashBytes / hashArchivo', () => {
  it('calcula el SHA-256 conocido de "abc"', async () => {
    const hash = await hashBytes(new TextEncoder().encode('abc'));
    expect(hash).toBe(HASH_ABC);
  });

  it('calcula el hash de un File', async () => {
    await expect(hashArchivo(archivo())).resolves.toBe(HASH_ABC);
  });

  it('rechaza objetos que no se pueden leer', async () => {
    await expect(hashArchivo({})).rejects.toThrow(/no se puede leer/);
  });
});

describe('crearRegistroEvidencia', () => {
  it('registra nombre, tipo, tamaño y hash sin incluir el archivo', async () => {
    const registro = await crearRegistroEvidencia(archivo(), {
      tipo: 'identificacion',
      descripcion: '  cédula anverso  ',
      responsable: 'Ana Pérez'
    });

    expect(registro).toMatchObject({
      nombre: 'documento.pdf',
      tipo: 'identificacion',
      descripcion: 'cédula anverso',
      mime: 'application/pdf',
      tamano: 3,
      hash: HASH_ABC,
      algoritmo: 'SHA-256',
      responsable: 'Ana Pérez'
    });
    expect(registro.id).toBeTruthy();
    expect(registro.blob).toBeUndefined();
  });

  it('normaliza un tipo desconocido a "otro"', async () => {
    const registro = await crearRegistroEvidencia(archivo(), { tipo: 'inexistente' });
    expect(registro.tipo).toBe('otro');
  });
});

describe('validarEvidencia', () => {
  const valida = {
    nombre: 'documento.pdf',
    tipo: 'identificacion',
    tamano: 3,
    hash: HASH_ABC
  };

  it('acepta un registro completo', () => {
    expect(validarEvidencia(valida)).toEqual({ valida: true, faltantes: [] });
  });

  it('rechaza hash mal formado, tipo desconocido y tamaño cero', () => {
    const resultado = validarEvidencia({
      nombre: '',
      tipo: 'otro-invalido',
      tamano: 0,
      hash: '123'
    });

    expect(resultado.valida).toBe(false);
    expect(resultado.faltantes.join(' ')).toMatch(/nombre/);
    expect(resultado.faltantes.join(' ')).toMatch(/tipo/);
    expect(resultado.faltantes.join(' ')).toMatch(/hash/);
    expect(resultado.faltantes.join(' ')).toMatch(/tamaño/);
  });
});

describe('verificarIntegridad', () => {
  it('confirma que el archivo coincide con el hash', async () => {
    const resultado = await verificarIntegridad(archivo(), HASH_ABC);
    expect(resultado.integra).toBe(true);
  });

  it('detecta un archivo alterado', async () => {
    const resultado = await verificarIntegridad(archivo('otro contenido'), HASH_ABC);
    expect(resultado.integra).toBe(false);
    expect(resultado.hashActual).not.toBe(HASH_ABC);
  });
});

describe('resumenEvidencias', () => {
  const registro = (tipo) => ({ nombre: 'doc.pdf', tipo, tamano: 3, hash: HASH_ABC });

  it('marca completa la persona natural con su identificación', () => {
    const resultado = resumenEvidencias([registro('identificacion')], { tipoPersona: 'natural' });
    expect(resultado.completa).toBe(true);
    expect(resultado.faltantes).toHaveLength(0);
  });

  it('detecta las evidencias mínimas faltantes de una persona jurídica', () => {
    const resultado = resumenEvidencias([registro('identificacion')], { tipoPersona: 'juridica' });

    expect(resultado.completa).toBe(false);
    expect(resultado.faltantes).toEqual(['ruc', 'representante', 'cadenaPropiedad']);
    expect(EVIDENCIAS_MINIMAS.juridica).toContain('cadenaPropiedad');
  });

  it('reporta registros inválidos y no duplica tipos', () => {
    const resultado = resumenEvidencias([
      registro('identificacion'),
      registro('identificacion'),
      { nombre: 'x', tipo: 'identificacion', tamano: 0, hash: 'malo' }
    ]);

    expect(resultado.total).toBe(3);
    expect(resultado.tiposPresentes).toEqual(['identificacion']);
    expect(resultado.invalidas).toHaveLength(1);
    expect(resultado.completa).toBe(false);
  });

  it('acepta una lista vacía sin romperse', () => {
    const resultado = resumenEvidencias();
    expect(resultado.total).toBe(0);
    expect(resultado.completa).toBe(false);
  });
});

describe('formatearTamano y etiquetas', () => {
  it('formatea bytes, KB y MB', () => {
    expect(formatearTamano(512)).toBe('512 B');
    expect(formatearTamano(2048)).toBe('2.0 KB');
    expect(formatearTamano(3 * 1024 * 1024)).toBe('3.0 MB');
  });

  it('devuelve la etiqueta del tipo conocido', () => {
    expect(etiquetaTipoEvidencia('identificacion')).toBe('Identificación del cliente');
    expect(etiquetaTipoEvidencia('desconocido')).toBe('desconocido');
    expect(TIPOS_EVIDENCIA.map(t => t.valor)).toContain('cadenaPropiedad');
  });
});

describe('describirEvidencias y filasEvidencias', () => {
  const evidencia = {
    nombre: 'cedula.pdf',
    tipo: 'identificacion',
    tamano: 2048,
    hash: HASH_ABC,
    cargadaEn: '2026-10-26T10:00:00.000Z'
  };

  it('describe el archivo con su hash completo', () => {
    const texto = describirEvidencias([evidencia]);
    expect(texto).toContain('Identificación del cliente: cedula.pdf');
    expect(texto).toContain('2.0 KB');
    expect(texto).toContain(HASH_ABC);
  });

  it('permite abreviar el hash para el prompt', () => {
    const texto = describirEvidencias([evidencia], { hashCompleto: false });
    expect(texto).toContain(`${HASH_ABC.slice(0, 16)}…`);
    expect(texto).not.toContain(HASH_ABC);
  });

  it('indica cuando no hay evidencias', () => {
    expect(describirEvidencias([])).toBe('Sin evidencias documentales cargadas.');
    expect(describirEvidencias()).toBe('Sin evidencias documentales cargadas.');
  });

  it('genera filas para Excel', () => {
    const [fila] = filasEvidencias([evidencia]);
    expect(fila).toMatchObject({
      tipo: 'Identificación del cliente',
      nombre: 'cedula.pdf',
      tamano: '2.0 KB',
      hash: HASH_ABC
    });
  });
});
