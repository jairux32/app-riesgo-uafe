import { FACTORES_SENALES_UAFE } from '../data/constants';

/**
 * Normaliza el valor de una celda de ExcelJS. Las celdas pueden traer fechas,
 * fórmulas, texto enriquecido o hipervínculos además de primitivos.
 */
const valorCelda = (valor) => {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? '' : valor.toISOString().slice(0, 10);
  }
  if (typeof valor !== 'object') return valor;

  if (Array.isArray(valor.richText)) return valor.richText.map(parte => parte.text).join('');
  if ('result' in valor) return valorCelda(valor.result);
  if ('text' in valor) return String(valor.text);
  return '';
};

/**
 * Lee la primera hoja como una matriz de filas. `getCell` recorre las celdas
 * reales de la fila, así no se generan huecos como con `row.values` (que es
 * un arreglo base 1).
 */
const leerFilas = async (file) => {
  // ExcelJS pesa más que el resto del parser: se carga solo al importar un
  // archivo, no en el arranque del wizard.
  const modulo = await import('exceljs');
  const ExcelJS = modulo.default || modulo;

  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new Error(
      'El archivo no es un Excel .xlsx válido. Si viene del formato antiguo .xls, '
      + 'ábralo y guárdelo como .xlsx antes de importarlo.'
    );
  }

  const hoja = workbook.worksheets[0];
  if (!hoja) throw new Error('El archivo no contiene hojas.');

  const filas = [];
  hoja.eachRow({ includeEmpty: false }, (row) => {
    const valores = [];
    for (let columna = 1; columna <= row.cellCount; columna += 1) {
      valores.push(valorCelda(row.getCell(columna).value));
    }
    filas.push(valores);
  });

  return filas;
};

/**
 * Asigna valores de riesgo basados en señales de alerta UAFE (sistema v2.4)
 * En el nuevo sistema: prob = 0|1 (presente/no presente), imp = gravedad 1-5
 *
 * `contexto` indica qué columnas existen realmente en el archivo importado:
 * así no se activan señales por un dato que simplemente no venía en el reporte.
 */
const normalizar = (valor) => String(valor || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const ACTOS_INMUEBLE = /compraventa|donacion|hipoteca|particion|adjudicacion|usufructo|arrendamiento|promesa/;
const ACTOS_NO_INMUEBLE = /vehiculo|automotor|acciones|participaciones|maquinaria|bien mueble|empresa/;


const SECTORES_ELECTRONICOS = /salud|medic|educaci|tecnolog|informatic|consultor|profesional|financ|seguro|juridic/;
const JURISDICCIONES_RIESGO = /pais(es)? sancionad|jurisdiccion(es)? (de )?(alto riesgo|sancionad)|corea del norte|iran|siria|cuba|rusia/;

export const autoEvaluateRisk = (datos, contexto = {}) => {
  const evaluaciones = {};
  const valor = parseFloat(datos.valor) || 0;
  const actividad = normalizar(datos.actividad);
  const acto = normalizar(datos.acto);
  const origen = normalizar(datos.origen);
  const medioPago = normalizar(datos.medioPago);
  const observaciones = normalizar(datos.observaciones);
  const texto = `${origen} ${medioPago} ${observaciones}`;
  const esJuridica = datos.tipoPersona === 'juridica';
  const inmueble = ACTOS_INMUEBLE.test(acto) && !ACTOS_NO_INMUEBLE.test(acto);

  // Inicializar todas las señales como no detectadas (prob=0, gravedad=1)
  FACTORES_SENALES_UAFE.forEach(factor => {
    factor.subcriterios.forEach(sub => {
      evaluaciones[sub.id] = { prob: 0, imp: 1 };
    });
  });

  const activar = (id, imp, motivo) => {
    if (!evaluaciones[id]) return;
    evaluaciones[id] = { prob: 1, imp, motivo };
  };

  // ===== Identidad y comportamiento =====
  if (/se niega a (proporcionar|entregar)|no proporciona (informacion|document)|resiste/.test(observaciones)) {
    activar('SA01', 4, 'Observaciones indican resistencia a entregar información');
  }
  if (/inconsisten|contradictor/.test(observaciones)) {
    activar('SA02', 4, 'Observaciones registran información inconsistente');
  }
  if (/(direccion|telefono|domicilio) (fals|no verificable|imposible)/.test(observaciones)) {
    activar('SA03', 4, 'Domicilio o teléfono no verificable según observaciones');
  }
  if (/nervios|evasiv/.test(observaciones)) {
    activar('SA05', 3, 'Actitud evasiva registrada en observaciones');
  }
  if (datos.esPep) {
    activar('SA07', 5, 'Cliente PEP: exige debida diligencia reforzada');
  }
  if (datos.reportesPrevios) {
    activar('SA08', 5, 'Reportes previos ante la UAFE');
  }
  if (datos.apoderado) {
    activar('SA10', 3, 'Uso de apoderado para la operación');
  }

  // ===== Estructura corporativa =====
  if (acto.includes('constitucion') && valor > 50000) {
    activar('SA12', 4, 'Empresa recién constituida con alto volumen de operación');
  }
  if (esJuridica && contexto.tieneActividad !== false && !actividad) {
    activar('SA11', 3, 'Persona jurídica sin actividad económica declarada');
  }
  if (acto.includes('fideicomiso')) {
    activar('SA13', 4, 'Operación con fideicomiso');
  }
  if (/domicilio virtual|sede virtual|oficina virtual/.test(observaciones)) {
    activar('SA17', 4, 'Domicilio o sede virtual');
  }
  if (/se niega a (entregar|proporcionar) (estados financieros|documentacion contable)/.test(observaciones)) {
    activar('SA19', 4, 'Se negó a entregar estados financieros');
  }

  // ===== Patrones transaccionales =====
  if (actividad && acto && !inmueble &&
      (actividad.includes('construccion') || actividad.includes('mineria') || actividad.includes('exportacion'))) {
    activar('SA21', 4, 'Actividad declarada poco compatible con el acto notarial');
  }
  if (/alto riesgo|jurisdiccion de riesgo/.test(texto)) {
    activar('SA28', 4, 'Referencia a jurisdicción de alto riesgo');
  }
  if (/tercero|tercera persona|pago por (otro|otra)/.test(texto)) {
    activar('SA29', 3, 'Pago realizado por un tercero');
  }
  if (/contraparte (desconocid|no identificad)/.test(observaciones)) {
    activar('SA30', 3, 'Contraparte desconocida o no identificada');
  }
  if (valor > 10000 && valor <= 50000) {
    activar('SA23', 2, 'Monto entre USD 10.000 y 50.000 (posible fragmentación)');
  }
  if (datos.usoEfectivo && valor > 10000) {
    activar('SA31', 4, 'Efectivo significativo sin causa aparente');
  }
  if (datos.usoEfectivo && SECTORES_ELECTRONICOS.test(actividad)) {
    activar('SA33', 3, 'Uso dominante de efectivo en un sector electrónico');
  }
  if (/billetes? (mal estado|alta denominacion)|denominaciones altas/.test(observaciones)) {
    activar('SA34', 2, 'Billetes de alta denominación o en mal estado');
  }
  if (datos.usoEfectivo && /cheque|pagare|letra de cambio|titulo valor/.test(acto)) {
    activar('SA36', 4, 'Compra de instrumento negociable con efectivo');
  }

  // ===== Internacional y jurisdicción =====
  if (JURISDICCIONES_RIESGO.test(texto)) {
    activar('SA41', 5, 'País sancionado o no cooperante');
  }
  if (/paraiso|offshore|off-shore/.test(texto)) {
    activar('SA42', 5, 'Uso de paraíso fiscal sin razón comercial');
  }
  if (/multiples monedas|varias monedas/.test(observaciones)) {
    activar('SA48', 2, 'Uso de múltiples monedas');
  }

  // ===== Bienes raíces =====
  if (datos.apoderado && inmueble) {
    activar('SA71', 4, 'Compra de inmueble a nombre de terceros (apoderado)');
  }
  if (datos.usoEfectivo && inmueble && valor > 50000) {
    activar('SA72', 5, 'Pago en efectivo significativo por bienes raíces');
  }
  if (inmueble && valor > 100000) {
    activar('SA73', 3, 'Valor alto que puede no corresponder al precio de mercado');
  }
  if (/reventa (rapida|inmediata)|vendido (dias|meses) despues/.test(observaciones)) {
    activar('SA74', 3, 'Reventa rápida del inmueble');
  }
  if (datos.reportesPrevios && inmueble && valor > 50000) {
    activar('SA75', 4, 'Compras múltiples en corto período');
  }
  if (/permuta|canje|trueque/.test(acto)) {
    activar('SA78', 3, 'Esquema de permuta o canje');
  }
  if (/(segunda|tercera) hipoteca|cancelacion(es)? de hipoteca/.test(observaciones)) {
    activar('SA80', 2, 'Hipotecas o cancelaciones frecuentes sobre el mismo bien');
  }

  // ===== Activos virtuales =====
  if (datos.usoActivosVirtuales) {
    activar('SA91', 4, 'Uso intensivo de criptoactivos sin justificación comercial');
    if (/no regulad|sin regulacion|exchange|plataforma/.test(texto)) {
      activar('SA92', 3, 'Operación con plataforma no regulada');
    }
    if (datos.usoEfectivo) {
      activar('SA97', 4, 'Conversión inmediata de criptoactivos a efectivo');
    }
    if (/ip (de|en) (pais|jurisdiccion)|vpn/.test(observaciones)) {
      activar('SA99', 3, 'Operación desde IP de país de alto riesgo');
    }
    if (valor > 100000) {
      activar('SA100', 4, 'Volumen en criptoactivos no acorde al perfil');
    }
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
  const rows = await leerFilas(file);

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
        tipoPersona: String(row[colMap.cedula] || '').trim().length === 13 ? 'juridica' : 'natural',
        nacionalidad: 'ECU',
        esPep: /si|yes|true|1/i.test(String(row[colMap.esPep])),
        detallePep: String(row[colMap.observaciones] || '').trim(),
        apoderado: /si|yes|true|1/i.test(String(row[colMap.apoderado])),
        ofac: false, onu: false, pepUafe: /si|yes|true|1/i.test(String(row[colMap.esPep])),
        reportesPrevios: false,
        observaciones: String(row[colMap.observaciones] || '').trim(),
        usoEfectivo: /efectivo|cash/i.test(String(row[colMap.medioPago])),
        usoActivosVirtuales: /cripto|crypto|bitcoin|virtual/i.test(String(row[colMap.origen] || '')),
      };

      const contexto = {
        tieneActividad: colMap.actividad !== -1
      };

      return {
        datos,
        evaluaciones: autoEvaluateRisk(datos, contexto),
        controlesEval: {}
      };
    });

  return cases;
};
