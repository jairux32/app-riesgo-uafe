import * as XLSX from 'xlsx';
import { FACTORES_SENALES_UAFE } from '../data/constants';

/**
 * Asigna valores de riesgo basados en señales de alerta UAFE (sistema v2.4)
 * En el nuevo sistema: prob = 0|1 (presente/no presente), imp = gravedad 1-5
 */
const autoEvaluateRisk = (datos) => {
  const evaluaciones = {};
  const valor = parseFloat(datos.valor) || 0;
  const actividad = (datos.actividad || '').toLowerCase();
  const acto = (datos.acto || '').toLowerCase();

  // Inicializar todas las señales como no detectadas (prob=0, gravedad=1)
  FACTORES_SENALES_UAFE.forEach(factor => {
    factor.subcriterios.forEach(sub => {
      evaluaciones[sub.id] = { prob: 0, imp: 1 };
    });
  });

  // Reglas heurísticas → activar señales específicas con gravedad apropiada

  // SA07: Perfil económico no acorde a sus operaciones (PEP)
  if (datos.esPep) {
    evaluaciones.SA07 = { prob: 1, imp: 5 };
  }

  // SA08: Relación con antecedentes penales o notoriedad negativa (reportes previos)
  if (datos.reportesPrevios) {
    evaluaciones.SA08 = { prob: 1, imp: 5 };
  }

  // SA10: Uso frecuente de apoderados para operaciones simples
  if (datos.apoderado) {
    evaluaciones.SA10 = { prob: 1, imp: 3 };
  }

  // SA12: Empresa recién constituida con altos volúmenes de operación
  if ((acto.includes('constitución') || acto.includes('constitucion')) && valor > 50000) {
    evaluaciones.SA12 = { prob: 1, imp: 4 };
  }

  // SA13: Estructura accionaria compleja o poco transparente (fideicomiso)
  if (acto.includes('fideicomiso')) {
    evaluaciones.SA13 = { prob: 1, imp: 4 };
  }

  // SA21: Operaciones que no guardan relación con la actividad declarada
  if (actividad.includes('construcción') || actividad.includes('construccion') ||
      actividad.includes('minería') || actividad.includes('mineria') ||
      actividad.includes('exportación') || actividad.includes('exportacion')) {
    evaluaciones.SA21 = { prob: 1, imp: 4 };
  }

  // SA23: Fragmentación de operaciones para evitar reportes (valor mediano)
  if (valor > 10000 && valor <= 50000) {
    evaluaciones.SA23 = { prob: 1, imp: 2 };
  }

  // SA31: Depósitos significativos en efectivo sin causa aparente
  if (datos.usoEfectivo && valor > 10000) {
    evaluaciones.SA31 = { prob: 1, imp: 4 };
  }

  // SA42: Uso de paraísos fiscales sin razón comercial clara
  if (actividad.includes('offshore') || actividad.includes('paraíso') || actividad.includes('paraiso')) {
    evaluaciones.SA42 = { prob: 1, imp: 5 };
  }

  // SA71: Compra de inmuebles a nombre de terceros (apoderado + compraventa)
  if (datos.apoderado && acto.includes('compraventa')) {
    evaluaciones.SA71 = { prob: 1, imp: 4 };
  }

  // SA72: Pagos en efectivo significativos por bienes raíces
  if (datos.usoEfectivo && acto.includes('compraventa') && valor > 50000) {
    evaluaciones.SA72 = { prob: 1, imp: 5 };
  }

  // SA73: Precio de venta muy inferior o superior al de mercado (valor muy alto)
  if (valor > 100000) {
    evaluaciones.SA73 = { prob: 1, imp: 3 };
  }

  // SA75: Compras múltiples en un corto período de tiempo (reportes previos + valor alto)
  if (datos.reportesPrevios && valor > 50000) {
    evaluaciones.SA75 = { prob: 1, imp: 4 };
  }

  // SA91: Uso intensivo de criptomonedas sin justificación comercial
  if (datos.usoActivosVirtuales) {
    evaluaciones.SA91 = { prob: 1, imp: 4 };
  }

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
              usoEfectivo: /efectivo|cash/i.test(String(row[colMap.medioPago])),
              usoActivosVirtuales: /cripto|crypto|bitcoin|virtual/i.test(String(row[colMap.origen] || '')),
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
