import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { autoEvaluateRisk, parseUAFEExcel } from '../utils/excelParser';
import { FACTORES_SENALES_UAFE, SENALES_ALERTA_UAFE, SENALES_SIN_AUTOEVALUACION } from '../data/constants';

const totalSenales = FACTORES_SENALES_UAFE.flatMap(f => f.subcriterios).length;

const base = {
  valor: 1000,
  actividad: 'comercio',
  acto: 'compraventa de vehículo',
  origen: '',
  medioPago: '',
  observaciones: ''
};

const activas = (datos, contexto) => Object.entries(autoEvaluateRisk(datos, contexto))
  .filter(([, evaluacion]) => evaluacion.prob === 1)
  .map(([id]) => id)
  .sort();

describe('autoEvaluateRisk', () => {
  it('inicializa todas las señales del catálogo como no presentes', () => {
    const evaluaciones = autoEvaluateRisk(base);

    expect(Object.keys(evaluaciones)).toHaveLength(totalSenales);
    expect(Object.values(evaluaciones).every(e => e.prob === 0 && e.imp === 1)).toBe(true);
  });

  it('activa las señales de identidad a partir de las observaciones', () => {
    const observaciones = [
      'Se niega a proporcionar información',
      'información inconsistente y contradictoria',
      'teléfono no verificable',
      'actitud nerviosa y evasiva',
      'domicilio virtual',
      'Se niega a entregar estados financieros'
    ].join('. ');

    expect(activas({ ...base, observaciones })).toEqual(
      expect.arrayContaining(['SA01', 'SA02', 'SA03', 'SA05', 'SA17', 'SA19'])
    );
  });

  it('activa SA11 solo si la columna de actividad existe y viene vacía', () => {
    const juridica = { ...base, tipoPersona: 'juridica', actividad: '' };

    expect(activas(juridica, { tieneActividad: true })).toContain('SA11');
    expect(activas(juridica, { tieneActividad: false })).not.toContain('SA11');
    expect(activas({ ...juridica, tipoPersona: 'natural' }, { tieneActividad: true })).not.toContain('SA11');
  });

  it('activa SA10, SA12, SA07 y SA08 por datos estructurados', () => {
    const datos = {
      ...base,
      apoderado: true,
      esPep: true,
      reportesPrevios: true,
      acto: 'constitución de sociedad',
      valor: 60000
    };

    expect(activas(datos)).toEqual(expect.arrayContaining(['SA07', 'SA08', 'SA10', 'SA12']));
  });

  it('detecta efectivo en sectores electrónicos e instrumentos negociables', () => {
    const datos = {
      ...base,
      usoEfectivo: true,
      valor: 15000,
      actividad: 'servicios profesionales de salud',
      acto: 'compra de pagaré'
    };
    const resultado = activas(datos);

    expect(resultado).toEqual(expect.arrayContaining(['SA31', 'SA33', 'SA36']));
  });

  it('detecta jurisdicciones, paraísos fiscales y terceros', () => {
    const datos = {
      ...base,
      origen: 'transferencia desde paraíso fiscal, país sancionado, jurisdicción de alto riesgo',
      medioPago: 'pago por un tercero',
      observaciones: 'contraparte no identificada. múltiples monedas'
    };
    const resultado = activas(datos);

    expect(resultado).toEqual(
      expect.arrayContaining(['SA28', 'SA29', 'SA30', 'SA41', 'SA42', 'SA48'])
    );
  });

  it('aplica las reglas de bienes raíces solo a actos inmobiliarios', () => {
    const inmueble = {
      ...base,
      acto: 'compraventa de inmueble',
      usoEfectivo: true,
      apoderado: true,
      reportesPrevios: true,
      valor: 120000
    };
    const resultado = activas(inmueble);

    expect(resultado).toEqual(
      expect.arrayContaining(['SA71', 'SA72', 'SA73', 'SA75'])
    );

    const noInmueble = activas({ ...base, valor: 120000 });
    expect(noInmueble).not.toContain('SA73');
  });

  it('activa SA78 y SA74 con permuta y reventa rápida', () => {
    const resultado = activas({
      ...base,
      acto: 'permuta de inmueble',
      observaciones: 'reventa inmediata del inmueble'
    });

    expect(resultado).toEqual(expect.arrayContaining(['SA78', 'SA74']));
  });

  it('activa todas las señales de activos virtuales aplicables', () => {
    const datos = {
      ...base,
      usoActivosVirtuales: true,
      usoEfectivo: true,
      valor: 150000,
      origen: 'exchange no regulado',
      observaciones: 'operación desde IP de país de alto riesgo'
    };
    const resultado = activas(datos);

    expect(resultado).toEqual(
      expect.arrayContaining(['SA91', 'SA92', 'SA97', 'SA99', 'SA100'])
    );
  });

  it('adjunta el motivo de cada sugerencia', () => {
    const evaluaciones = autoEvaluateRisk({ ...base, esPep: true });
    expect(evaluaciones.SA07.motivo).toMatch(/PEP/i);
  });

  it('declara explícitamente las señales que no puede deducir', () => {
    expect(SENALES_SIN_AUTOEVALUACION).toHaveLength(20);
    expect(new Set(SENALES_SIN_AUTOEVALUACION).size).toBe(20);

    const codigos = new Set(SENALES_ALERTA_UAFE.map(s => s.codigo));
    for (const id of SENALES_SIN_AUTOEVALUACION) {
      expect(codigos.has(id)).toBe(true);
    }
  });

  it('nunca activa automáticamente una señal marcada como manual', () => {
    const ricos = {
      ...base,
      esPep: true,
      apoderado: true,
      reportesPrevios: true,
      usoEfectivo: true,
      usoActivosVirtuales: true,
      valor: 200000,
      actividad: 'construcción',
      acto: 'compraventa de inmueble',
      origen: 'paraíso fiscal, país sancionado, exchange no regulado',
      medioPago: 'efectivo, pago por un tercero',
      observaciones: [
        'se niega a proporcionar información', 'información inconsistente',
        'teléfono no verificable', 'actitud nerviosa', 'domicilio virtual',
        'se niega a entregar estados financieros', 'contraparte no identificada',
        'múltiples monedas', 'reventa inmediata', 'segunda hipoteca',
        'ip de país de alto riesgo'
      ].join('. ')
    };

    const evaluaciones = autoEvaluateRisk(ricos, { tieneActividad: true });
    for (const id of SENALES_SIN_AUTOEVALUACION) {
      expect(evaluaciones[id].prob).toBe(0);
    }
  });
});

const construirArchivo = async (filas) => {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Reporte');
  filas.forEach(fila => hoja.addRow(fila));
  const buffer = await libro.xlsx.writeBuffer();
  return new File([buffer], 'reporte.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
};

describe('parseUAFEExcel', () => {
  it('extrae los casos y aplica la auto-evaluación', async () => {
    const archivo = await construirArchivo([
      ['IDI', 'NOMBRE', 'ACTO', 'VALOR', 'MEDIO PAGO', 'ACTIVIDAD', 'OBSERVACIONES'],
      ['1790012345001', 'CONSTRUCTORA ANDES S.A.', 'Compraventa de inmueble', 120000, 'Efectivo', 'construcción', 'información inconsistente'],
      ['1713175071', 'ANA PEREZ', 'Poder especial', 5000, 'Transferencia', 'comercio', '']
    ]);

    const casos = await parseUAFEExcel(archivo);

    expect(casos).toHaveLength(2);
    expect(casos[0].datos.tipoPersona).toBe('juridica');
    expect(casos[0].datos.valor).toBe(120000);
    expect(casos[0].datos.usoEfectivo).toBe(true);
    expect(casos[0].evaluaciones.SA72.prob).toBe(1);
    expect(casos[0].evaluaciones.SA02.prob).toBe(1);
    expect(casos[1].datos.tipoPersona).toBe('natural');
    expect(casos[1].evaluaciones.SA72.prob).toBe(0);
  });
});
