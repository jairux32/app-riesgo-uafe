import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { exportToExcel, exportMultipleToExcel } from '../utils/excelExport';

const datos = {
  notaria: 'Notaría Primera de Quito',
  notario: 'Notario de Prueba',
  cliente: 'Ana Pérez',
  cedula: '1710034065',
  acto: 'Poder especial',
  valor: 5000,
  origen: 'Ahorros',
  medioPago: 'Transferencia',
  actividad: 'Comercio',
  tipoPersona: 'natural',
  ddc: {
    identificacion: true,
    proposito: true,
    origenFondos: true,
    listasNoDisponibles: true
  },
  verificaciones: {
    uk: { estado: 'no_configurado' }
  },
  evidencias: [],
  cadenaPropiedad: [],
  reportes: {}
};

const scores = { inherente: 6, nivel: 'BAJO', diligencia: 'SIMPLIFICADA' };
const factoresResult = [
  { nombre: 'Identidad', peso: 0.5, promedio: 1.2, ponderado: 0.6 }
];
const controlesResult = {
  residual: 3,
  nivelResidual: 'BAJO',
  efectividadPromedio: 0.5,
  lista: []
};
const analisis = {
  dictamen: 'NO_ELEVAR',
  _meta: {
    modelo: 'llama-3.3-70b-versatile',
    promptVersion: '2026-10-26.1',
    contextoVersion: '2026-10-23',
    generadoEn: '2026-10-26T10:00:00.000Z'
  }
};

let descarga = null;

const interceptarDescarga = () => {
  descarga = null;
  URL.createObjectURL = vi.fn((blob) => {
    descarga = blob;
    return 'blob:prueba';
  });
  URL.revokeObjectURL = vi.fn();
  HTMLAnchorElement.prototype.click = vi.fn();
};

const cargarDescarga = async () => {
  expect(descarga).toBeTruthy();
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await descarga.arrayBuffer());
  return libro;
};

describe('exportToExcel', () => {
  beforeEach(interceptarDescarga);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('genera las hojas del dictamen con los datos del caso', async () => {
    await exportToExcel(datos, scores, factoresResult, controlesResult, analisis);
    const libro = await cargarDescarga();

    expect(libro.worksheets.map(hoja => hoja.name)).toEqual([
      'PORTADA',
      'DATOS CLIENTE',
      'ESCALAS',
      'MATRIZ RIESGO',
      'MAPA DE CALOR',
      'CONTROLES',
      'REPORTE EJECUTIVO'
    ]);

    const portada = libro.getWorksheet('PORTADA');
    expect(portada.getCell('B9').value).toBe('Ana Pérez');
    expect(portada.getCell('B16').value).toBe('6/25');
    expect(portada.getCell('C16').value).toBe('BAJO');

    const ficha = libro.getWorksheet('DATOS CLIENTE');
    expect(ficha.getCell('B7').value).toBe('1710034065');
    expect(ficha.getCell('B23').value).toBe('SIN FUENTE CONFIGURADA');
  });

  it('incluye la trazabilidad del dictamen cuando hay metadatos', async () => {
    await exportToExcel(datos, scores, factoresResult, controlesResult, analisis);
    const libro = await cargarDescarga();
    const reporte = libro.getWorksheet('REPORTE EJECUTIVO');

    expect(reporte.getCell('A11').value).toBe('TRAZABILIDAD DEL DICTAMEN');
    expect(reporte.getCell('B12').value).toBe('llama-3.3-70b-versatile');
    expect(reporte.getCell('B13').value).toBe('2026-10-26.1');
    expect(reporte.getCell('B14').value).toBe('2026-10-23');
  });

  it('omite la trazabilidad si el dictamen es texto plano', async () => {
    await exportToExcel(datos, scores, factoresResult, controlesResult, 'dictamen manual');
    const libro = await cargarDescarga();
    const reporte = libro.getWorksheet('REPORTE EJECUTIVO');

    expect(reporte.getCell('A11').value).toBe('ANALISIS JURIDICO-NORMATIVO (GEMINI IA)');
    expect(reporte.getCell('A12').value).toBe('dictamen manual');
  });

  it('agrega una fila por cada evidencia con su hash', async () => {
    await exportToExcel({
      ...datos,
      evidencias: [{
        tipo: 'identificacion',
        nombre: 'cedula.pdf',
        hash: 'a'.repeat(64),
        tamano: 2048
      }]
    }, scores, factoresResult, controlesResult, analisis);

    const libro = await cargarDescarga();
    const ficha = libro.getWorksheet('DATOS CLIENTE');
    const fila = ficha.getRow(28);

    expect(fila.getCell(1).value).toContain('cedula.pdf');
    expect(fila.getCell(2).value).toBe(`SHA-256 ${'a'.repeat(64)}`);
  });
});

describe('exportMultipleToExcel', () => {
  beforeEach(interceptarDescarga);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resume varios casos en una hoja', async () => {
    await exportMultipleToExcel([
      {
        datos: { cliente: 'Ana Pérez', cedula: '1710034065', acto: 'Poder especial', valor: 5000 },
        evaluaciones: {},
        createdAt: '2026-10-05T10:00:00.000Z'
      },
      {
        datos: { cliente: 'Constructora Andes', cedula: '1790012345001', acto: 'Compraventa', valor: 90000, esPep: true },
        evaluaciones: {},
        createdAt: '2026-10-06T10:00:00.000Z'
      }
    ]);

    const libro = await cargarDescarga();
    expect(libro.worksheets.map(hoja => hoja.name)).toEqual(['Resumen de Casos']);

    const hoja = libro.getWorksheet('Resumen de Casos');
    expect(hoja.getCell('A1').value).toBe('#');
    expect(hoja.getCell('B2').value).toBe('Ana Pérez');
    expect(hoja.getCell('B3').value).toBe('Constructora Andes');
    expect(hoja.getCell('I3').value).toBe('Si');
  });
});
