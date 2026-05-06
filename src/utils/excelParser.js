import * as XLSX from 'xlsx';
import { FACTORES_RIESGO } from '../data/constants';

/**
 * Asigna valores de riesgo basados en los datos del caso
 */
const autoEvaluateRisk = (datos) => {
  const evaluaciones = {};
  const valor = parseFloat(datos.valor) || 0;
  const actividad = (datos.actividad || '').toLowerCase();
  const acto = (datos.acto || '').toLowerCase();

  FACTORES_RIESGO.forEach(factor => {
    factor.subcriterios.forEach(sub => {
      let prob = 1;
      let imp = 1;

      // Reglas para Factor CLIENTE
      if (sub.id === 'c1' && datos.esPep) { prob = 5; imp = 5; }
      if (sub.id === 'c2' && (actividad.includes('offshore') || actividad.includes('paraíso'))) { prob = 5; imp = 4; }
      if (sub.id === 'c3' && datos.apoderado) { prob = 4; imp = 3; }
      if (sub.id === 'c4' && (actividad.includes('construcción') || actividad.includes('minería') || actividad.includes('exportación'))) { prob = 4; imp = 4; }

      // Reglas para Factor PRODUCTO
      if (sub.id === 'p1' && valor > 100000) { prob = 5; imp = 5; }
      if (sub.id === 'p2' && (acto.includes('constitución') || acto.includes('fideicomiso') || acto.includes('poder'))) { prob = 4; imp = 4; }
      if (sub.id === 'p3' && valor > 50000) { prob = 3; imp = 3; }

      // Reglas para Factor CUMPLIMIENTO
      if (sub.id === 'cu1' && datos.reportesPrevios) { prob = 5; imp = 5; }

      // Valor neutro por defecto para el resto
      if (prob === 1 && imp === 1) {
        prob = 2; imp = 2;
      }

      evaluaciones[sub.id] = { prob, imp };
    });
  });

  return evaluaciones;
};

/**
 * Procesa un archivo Excel y extrae la información de los casos
 */
export const parseUAFEExcel = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        
        const headerIndex = rows.findIndex(row => 
          row.some(cell => cell === 'NES' || cell === 'ESTADO CIVIL' || cell === 'SISTEMA')
        );

        if (headerIndex === -1) throw new Error('No se encontraron cabeceras válidas.');

        const headers = rows[headerIndex];
        const dataRows = rows.slice(headerIndex + 1);

        const colMap = {
          cedula: headers.indexOf('IDI'),
          cliente: headers.indexOf('NRI'),
          acto: headers.indexOf('TTR'),
          valor: headers.indexOf('VAM'),
          origen: headers.indexOf('ORIGEN DE LOS FONDOS'),
          medioPago: headers.indexOf('FP'),
          actividad: headers.indexOf('ACTIV ECONOMICA'),
          esPep: headers.indexOf('PEPS'),
          apoderado: headers.indexOf('CON PODER'),
          observaciones: headers.indexOf('NOTAS'),
        };

        const cases = dataRows
          .filter(row => row.length > 0 && row[colMap.cedula])
          .map(row => {
            const datos = {
              notaria: '', notario: '',
              cliente: row[colMap.cliente] || '',
              cedula: row[colMap.cedula] || '',
              acto: row[colMap.acto] || 'Otro',
              valor: parseFloat(row[colMap.valor]) || 0,
              origen: row[colMap.origen] || '',
              medioPago: row[colMap.medioPago] || '',
              actividad: row[colMap.actividad] || '',
              esPep: String(row[colMap.esPep]).toUpperCase() === 'SI',
              detallePep: row[colMap.observaciones] || '',
              apoderado: String(row[colMap.apoderado]).toUpperCase() === 'SI',
              ofac: false, onu: false, pepUafe: String(row[colMap.esPep]).toUpperCase() === 'SI',
              reportesPrevios: false,
              observaciones: row[colMap.observaciones] || '',
            };

            return {
              datos,
              evaluaciones: autoEvaluateRisk(datos),
              controlesEval: {}
            };
          });

        resolve(cases);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};
