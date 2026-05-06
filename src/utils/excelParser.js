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
 * Encuentra la columna más cercana a un patrón usando búsqueda fuzzy
 */
const findColumnIndex = (headers, patterns) => {
  const headerStrs = headers.map(h => String(h).toLowerCase().trim());
  
  for (const pattern of patterns) {
    const exact = headerStrs.indexOf(pattern.toLowerCase());
    if (exact !== -1) return exact;
    
    // Búsqueda parcial
    const partial = headerStrs.findIndex(h => h.includes(pattern.toLowerCase()));
    if (partial !== -1) return partial;
    
    // Búsqueda de palabras individuales
    for (let i = 0; i < headerStrs.length; i++) {
      const words = pattern.toLowerCase().split(/\s+/);
      if (words.some(w => headerStrs[i].includes(w))) return i;
    }
  }
  return -1;
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
        
        // Detectar fila de encabezados de forma inteligente
        let headerIndex = -1;
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
          const row = rows[i];
          if (row.some(cell => 
            /cedula|idi|identificaci|rif|pasaporte/i.test(String(cell)) ||
            /nombre|cliente|razon social|contribuyente/i.test(String(cell)) ||
            /valor|monto|vam|cantidad/i.test(String(cell))
          )) {
            headerIndex = i;
            break;
          }
        }

        if (headerIndex === -1) throw new Error('No se encontraron cabeceras válidas en las primeras 10 filas.');

        const headers = rows[headerIndex];
        const dataRows = rows.slice(headerIndex + 1);

        // Mapeo inteligente con múltiples patrones por campo
        const colMap = {
          cedula: findColumnIndex(headers, ['IDI', 'CEDULA', 'IDENTIFICACION', 'RUC', 'PASAPORTE', 'NRO IDENTIFICACION', 'DOCUMENTO']),
          cliente: findColumnIndex(headers, ['NRI', 'NOMBRE', 'CLIENTE', 'RAZON SOCIAL', 'CONTRIBUYENTE', 'TITULAR', 'BENEFICIARIO']),
          acto: findColumnIndex(headers, ['TTR', 'ACTO', 'TIPO ACTO', 'TRANSACCION', 'OPERACION', 'SERVICIO']),
          valor: findColumnIndex(headers, ['VAM', 'VALOR', 'MONTO', 'CANTIDAD', 'IMPORTE', 'MONTO OPERACION']),
          origen: findColumnIndex(headers, ['ORIGEN DE LOS FONDOS', 'ORIGEN', 'PROCEDENCIA', 'FUENTE']),
          medioPago: findColumnIndex(headers, ['FP', 'MEDIO PAGO', 'FORMA PAGO', 'PAGO', 'INSTRUMENTO']),
          actividad: findColumnIndex(headers, ['ACTIV ECONOMICA', 'ACTIVIDAD', 'GIRO', 'SECTOR', 'OCUPACION']),
          esPep: findColumnIndex(headers, ['PEPS', 'PEP', 'EXPUESTO', 'POLITICAMENTE']),
          apoderado: findColumnIndex(headers, ['CON PODER', 'APODERADO', 'REPRESENTANTE', 'MANDATARIO']),
          observaciones: findColumnIndex(headers, ['NOTAS', 'OBSERVACIONES', 'COMENTARIOS', 'DETALLE']),
        };

        // Reportar campos no encontrados
        const missingFields = Object.entries(colMap)
          .filter(([_, idx]) => idx === -1)
          .map(([name]) => name);
        
        if (missingFields.length > 0) {
          console.warn('Campos no encontrados en el Excel:', missingFields);
        }

        const cases = dataRows
          .filter(row => row.length > 0 && (row[colMap.cedula] || row[colMap.cliente]))
          .map(row => {
            const valorRaw = row[colMap.valor];
            const valorNum = typeof valorRaw === 'number' ? valorRaw : 
              parseFloat(String(valorRaw).replace(/[$,]/g, '')) || 0;
            
            const datos = {
              notaria: '', notario: '',
              cliente: String(row[colMap.cliente] || '').trim(),
              cedula: String(row[colMap.cedula] || '').trim(),
              acto: String(row[colMap.acto] || 'Otro').trim(),
              valor: valorNum,
              origen: String(row[colMap.origen] || '').trim(),
              medioPago: String(row[colMap.medioPago] || '').trim(),
              actividad: String(row[colMap.actividad] || '').trim(),
              esPep: /si|yes|true|1/i.test(String(row[colMap.esPep])),
              detallePep: String(row[colMap.observaciones] || '').trim(),
              apoderado: /si|yes|true|1/i.test(String(row[colMap.apoderado])),
              ofac: false, onu: false, pepUafe: /si|yes|true|1/i.test(String(row[colMap.esPep])),
              reportesPrevios: false,
              observaciones: String(row[colMap.observaciones] || '').trim(),
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
