import { FACTORES_RIESGO, CONTROLES_INTERNOS, NIVELES_RIESGO } from '../data/constants';
import { calculateInherentRisk } from './calculations';
import { validarDDC } from './validators';
import { filasCadenaPropiedad } from './beneficiarioFinal';
import { describirRevisiones } from './revisionCoincidencias';
import { filasEvidencias } from './evidencias';
import { calcularObligaciones, combinarReportes } from './obligaciones';

const TIPO_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// ExcelJS se carga al exportar: así no entra en el bundle inicial ni en el
// del wizard, que solo lo necesita cuando el usuario pide el archivo.
const cargarExcelJS = async () => {
  const modulo = await import('exceljs');
  return modulo.default || modulo;
};

const crearHoja = (workbook, nombre, filas, anchos = []) => {
  const hoja = workbook.addWorksheet(nombre);
  filas.forEach(fila => hoja.addRow(fila.length > 0 ? fila : ['']));
  anchos.forEach((ancho, indice) => {
    hoja.getColumn(indice + 1).width = ancho;
  });
  return hoja;
};

const aplicarEstilo = (hoja, fila, columna, { negrita, tamano, color, centrado } = {}) => {
  const celda = hoja.getCell(fila, columna);
  const font = {};
  if (negrita) font.bold = true;
  if (tamano) font.size = tamano;
  if (Object.keys(font).length > 0) celda.font = font;
  if (color) {
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${color}` } };
  }
  if (centrado) celda.alignment = { horizontal: 'center' };
};

const scoreColor = (score) =>
  score <= 8 ? '10B981' : score <= 14 ? 'F59E0B' : score <= 19 ? 'F97316' : 'EF4444';

const headerStyle = { negrita: true, tamano: 12, color: '1F6FEB' };
const subheaderStyle = { negrita: true, color: '112233' };

/**
 * Descarga el libro en el navegador. ExcelJS devuelve un buffer; se crea un
 * enlace temporal con `download` para que el navegador lo guarde con nombre.
 */
const descargarLibro = async (workbook, nombreArchivo) => {
  const contenido = await workbook.xlsx.writeBuffer();
  const blob = new Blob([contenido], { type: TIPO_MIME });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  // Se libera en el siguiente ciclo: revocar de inmediato puede cancelar la
  // descarga en algunos navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const exportToExcel = async (datos, scores, factoresResult, controlesResult, geminiAnalysis) => {
  const ExcelJS = await cargarExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistema de Análisis de Riesgo LA/FT';
  wb.created = new Date();

  const ddc = validarDDC(datos);
  const ddcTexto = ddc.completa
    ? `COMPLETA${ddc.advertencias?.length ? ` — advertencia: ${ddc.advertencias.join(' ')}` : ''}`
    : `INCOMPLETA — falta: ${ddc.faltantes.join(', ')}`;
  const beneficiario = datos.beneficiarioFinal || {};
  const beneficiarioTexto = datos.tipoPersona === 'juridica'
    ? `${beneficiario.nombre || 'N/A'} — ${beneficiario.cedula || 'N/A'} — ${beneficiario.porcentaje || 'N/A'}%${beneficiario.esPep ? ' — PEP' : ''}`
    : 'No aplica (persona natural)';
  const estadoVerificacion = (clave) => {
    const estado = datos.verificaciones?.[clave]?.estado;
    if (!estado || estado === 'pendiente') return 'PENDIENTE';
    if (estado === 'no_configurado') return 'SIN FUENTE CONFIGURADA';
    return String(estado).toUpperCase();
  };

  const obligaciones = calcularObligaciones(datos, {
    scoreInherente: scores.inherente,
    analisis: geminiAnalysis,
    fechaConocimiento: datos.reportes?.ros?.fechaConocimiento
  });
  const reportes = combinarReportes(obligaciones, datos.reportes);
  const reporteResu = reportes.resu;
  const reporteRos = reportes.ros;

  // ==================== 1. PORTADA ====================
  const ws1 = crearHoja(wb, 'PORTADA', [
    ['SISTEMA DE ANALISIS DE RIESGO LA/FD'],
    ['PARA EL SECTOR NOTARIAL ECUATORIANO'],
    [''],
    ['FECHA DE EVALUACION:', new Date().toLocaleDateString('es-EC', { dateStyle: 'full' })],
    [''],
    ['DATOS DEL CASO'],
    ['Notaria:', datos.notaria || 'N/A'],
    ['Notario/a:', datos.notario || 'N/A'],
    ['Cliente:', datos.cliente || 'N/A'],
    ['Identificacion:', datos.cedula || 'N/A'],
    ['Tipo de Acto:', datos.acto || 'N/A'],
    ['Valor (USD):', datos.valor || 'N/A'],
    [''],
    ['RESUMEN EJECUTIVO'],
    ['Indicador', 'Score', 'Nivel'],
    ['Riesgo Inherente', `${scores.inherente}/25`, scores.nivel],
    ['Riesgo Residual', `${controlesResult.residual}/25`, controlesResult.nivelResidual],
    ['Efectividad Controles:', `${Math.round(controlesResult.efectividadPromedio * 100)}%`],
    [''],
    ['Debida Diligencia Requerida:', scores.diligencia],
    ['Beneficiario Final:', beneficiarioTexto],
    ['Debida Diligencia (art. 47):', ddcTexto],
    ['Verificación en listas:', `OFAC: ${estadoVerificacion('ofac')} | ONU: ${estadoVerificacion('onu')} | UK: ${estadoVerificacion('uk')} | UAFE: ${estadoVerificacion('uafe')}`],
    ['Reporte SISLAFT - RESU/NO-RESU:', `${reporteResu.tipo} — ${reporteResu.fechaLimite} — ${reporteResu.estado}`],
    ['Reporte SISLAFT - ROS/NO-ROS:', `${reporteRos.tipo} — ${reporteRos.fechaLimite} — ${reporteRos.estado}`]
  ], [30, 25, 30]);

  aplicarEstilo(ws1, 1, 1, { negrita: true, tamano: 14, centrado: true });
  aplicarEstilo(ws1, 2, 1, { tamano: 11, centrado: true });
  [6, 14].forEach(fila => aplicarEstilo(ws1, fila, 1, headerStyle));
  [1, 2, 3].forEach(columna => aplicarEstilo(ws1, 15, columna, subheaderStyle));

  const r18c = scoreColor(scores.inherente);
  const r19c = scoreColor(controlesResult.residual);
  aplicarEstilo(ws1, 16, 2, { negrita: true, color: r18c, centrado: true });
  aplicarEstilo(ws1, 16, 3, { negrita: true, color: r18c, centrado: true });
  aplicarEstilo(ws1, 17, 2, { negrita: true, color: r19c, centrado: true });
  aplicarEstilo(ws1, 17, 3, { negrita: true, color: r19c, centrado: true });

  // ==================== 2. DATOS CLIENTE ====================
  const ws2 = crearHoja(wb, 'DATOS CLIENTE', [
    ['FICHA DE IDENTIFICACION DEL CLIENTE'], [''],
    ['CAMPO', 'VALOR'],
    ['Notaria', datos.notaria || 'N/A'],
    ['Notario/a', datos.notario || 'N/A'],
    ['Cliente / Razon Social', datos.cliente || 'N/A'],
    ['Identificacion', datos.cedula || 'N/A'],
    ['Tipo de Acto', datos.acto || 'N/A'],
    ['Valor', datos.valor || 'N/A'],
    ['Origen Fondos', datos.origen || 'N/A'],
    ['Medio de Pago', datos.medioPago || 'N/A'],
    ['Actividad', datos.actividad || 'N/A'],
    [''],
    ['BANDERAS DE RIESGO'],
    ['Es PEP?', datos.esPep ? 'SI' : 'NO'],
    ['Detalle PEP', datos.detallePep || 'N/A'],
    ['Actua por Apoderado?', datos.apoderado ? 'SI' : 'NO'],
    ['Reportes Previos UAFE?', datos.reportesPrevios ? 'SI' : 'NO'],
    [''],
    ['VERIFICACIONES'],
    ['OFAC', estadoVerificacion('ofac')],
    ['ONU', estadoVerificacion('onu')],
    ['UK', estadoVerificacion('uk')],
    ['PEP UAFE', estadoVerificacion('uafe')],
    ['Revisión de coincidencias', describirRevisiones(datos.verificaciones || {})],
    ['Perfil transaccional', datos.perfilTransaccionalEvaluacion
      ? `${datos.perfilTransaccionalEvaluacion.nivel || 'sin evaluar'}${(datos.perfilTransaccionalEvaluacion.alertas || []).length ? ` — ${(datos.perfilTransaccionalEvaluacion.alertas || []).map(a => a.mensaje).join(' ')}` : ''}`
      : 'No evaluado'],
    ['Evidencias documentales', `${(datos.evidencias || []).length} archivo(s) con hash SHA-256`],
    ...filasEvidencias(datos.evidencias || []).map(fila => [
      `${fila.tipo} — ${fila.nombre} (${fila.tamano})`,
      `SHA-256 ${fila.hash}`
    ]),
    [''],
    ['OBSERVACIONES', datos.observaciones || 'Ninguna'],
    [''],
    ['BENEFICIARIO FINAL Y DDC'],
    ['Beneficiario Final', beneficiarioTexto],
    ['Porcentaje de Participación', datos.tipoPersona === 'juridica' ? `${beneficiario.porcentaje || 'N/A'}%` : 'No aplica'],
    ['Beneficiario Final PEP', beneficiario.esPep ? `SI — ${beneficiario.detallePep || 'sin detalle'}` : 'NO'],
    ...(datos.tipoPersona === 'juridica' && (datos.cadenaPropiedad || []).length > 0
      ? [
          ['Cadena de propiedad (nivel, nombre, ID, tipo, % del nivel inferior, % efectivo)'],
          ...filasCadenaPropiedad(datos.cadenaPropiedad).map(fila => [
            `Nivel ${fila.nivel}`,
            `${fila.nombre} — ${fila.identificacion} — ${fila.tipo} — ${fila.porcentaje} — ${fila.participacionEfectiva}`
          ])
        ]
      : []),
    ['Debida Diligencia (art. 47)', ddcTexto]
  ], [30, 45]);

  aplicarEstilo(ws2, 1, 1, headerStyle);
  [3, 14, 20].forEach(fila => aplicarEstilo(ws2, fila, 1, subheaderStyle));

  // ==================== 3. ESCALAS ====================
  const ws3 = crearHoja(wb, 'ESCALAS', [
    ['ESCALA DE CALIFICACION DE RIESGO'], [''],
    ['NIVEL', 'RANGO', 'DILIGENCIA'],
    ...NIVELES_RIESGO.map(n => [n.nivel, `1 - ${n.max}`, n.diligencia])
  ], [18, 18, 50]);

  aplicarEstilo(ws3, 1, 1, headerStyle);
  aplicarEstilo(ws3, 3, 1, subheaderStyle);
  ['10B981', 'F59E0B', 'F97316', 'EF4444'].forEach((color, indice) => {
    aplicarEstilo(ws3, 4 + indice, 1, { negrita: true, color, centrado: true });
  });

  // ==================== 4. MATRIZ RIESGO ====================
  const ws4 = crearHoja(wb, 'MATRIZ RIESGO', [
    ['FACTOR', 'PESO', 'SCORE PROMEDIO', 'SCORE PONDERADO'],
    ...factoresResult.map(f => [f.nombre, `${(f.peso * 100).toFixed(0)}%`, f.promedio, f.ponderado]),
    ['', '', '', ''],
    ['DETALLE DE SUBCRITERIOS'],
    ['FACTOR', 'ID', 'PREGUNTA'],
    ...FACTORES_RIESGO.flatMap(factor =>
      factor.subcriterios.map(sub => [factor.nombre, sub.id, sub.pregunta])
    )
  ], [25, 12, 15, 18]);

  aplicarEstilo(ws4, 1, 1, headerStyle);
  aplicarEstilo(ws4, 2, 1, subheaderStyle);

  // ==================== 5. MAPA DE CALOR ====================
  const ws5 = crearHoja(wb, 'MAPA DE CALOR', [
    ['MAPA DE CALOR: PROBABILIDAD x IMPACTO'], [''],
    ['Probabilidad ->', '1', '2', '3', '4', '5'],
    ['Impacto 1', 'BAJO', 'BAJO', 'BAJO', 'BAJO', 'MEDIO'],
    ['Impacto 2', 'BAJO', 'BAJO', 'MEDIO', 'MEDIO', 'MEDIO'],
    ['Impacto 3', 'BAJO', 'MEDIO', 'MEDIO', 'MEDIO', 'MEDIO-ALTO'],
    ['Impacto 4', 'BAJO', 'MEDIO', 'MEDIO', 'MEDIO-ALTO', 'ALTO'],
    ['Impacto 5', 'MEDIO', 'MEDIO', 'MEDIO-ALTO', 'ALTO', 'ALTO'],
    [''], ['Leyenda:', '', '', '', '', ''],
    ['BAJO', '1-8 puntos', '', '', '', ''],
    ['MEDIO', '9-14 puntos', '', '', '', ''],
    ['MEDIO-ALTO', '15-19 puntos', '', '', '', ''],
    ['ALTO', '20-25 puntos', '', '', '', '']
  ], [20, 15, 15, 15, 15, 15]);

  aplicarEstilo(ws5, 1, 1, headerStyle);

  // ==================== 6. CONTROLES ====================
  const ws6 = crearHoja(wb, 'CONTROLES', [
    ['#', 'CONTROL', 'EXISTE', 'EFECTIVIDAD'],
    ...CONTROLES_INTERNOS.map((ctrl, i) => {
      const c = controlesResult.lista.find(x => x.id === ctrl.id);
      return [i + 1, ctrl.nombre, c?.existe ? 'SI' : 'NO', c?.existe ? `${c.efectividad}/3` : '-'];
    }),
    ['', '', '', ''],
    ['RESUMEN'],
    ['Controles Existentes:', controlesResult.lista.filter(x => x.existe).length],
    ['Efectividad Promedio:', `${Math.round(controlesResult.efectividadPromedio * 100)}%`]
  ], [5, 45, 12, 15]);

  aplicarEstilo(ws6, 1, 1, headerStyle);
  aplicarEstilo(ws6, 2, 1, subheaderStyle);

  // ==================== 7. REPORTE EJECUTIVO ====================
  const analysisText = typeof geminiAnalysis === 'string'
    ? geminiAnalysis
    : geminiAnalysis ? JSON.stringify(geminiAnalysis, null, 2) : '';
  const metaIA = typeof geminiAnalysis === 'object' ? geminiAnalysis?._meta : null;
  const execLines = analysisText ? analysisText.split('\n') : ['No se genero analisis de IA.'];
  const ws7 = crearHoja(wb, 'REPORTE EJECUTIVO', [
    ['REPORTE EJECUTIVO Y ANALISIS DE IA'], [''],
    ['RESUMEN DE SCORES'],
    ['Score Inherente:', scores.inherente, '/25'],
    ['Nivel:', scores.nivel],
    ['Diligencia:', scores.diligencia],
    ['Score Residual:', controlesResult.residual, '/25'],
    ['Nivel Residual:', controlesResult.nivelResidual],
    ['Efectividad:', `${Math.round(controlesResult.efectividadPromedio * 100)}%`],
    [''],
    ...(metaIA
      ? [
          ['TRAZABILIDAD DEL DICTAMEN'],
          ['Modelo:', metaIA.modelo || '—'],
          ['Version del prompt:', metaIA.promptVersion || '—'],
          ['Version del contexto legal:', metaIA.contextoVersion || '—'],
          ['Generado:', metaIA.generadoEn || '—'],
          ['']
        ]
      : []),
    ['ANALISIS JURIDICO-NORMATIVO (GEMINI IA)'],
    ...execLines.map(line => [line])
  ], [80]);

  aplicarEstilo(ws7, 1, 1, headerStyle);
  aplicarEstilo(ws7, 3, 1, subheaderStyle);
  aplicarEstilo(ws7, metaIA ? 17 : 11, 1, headerStyle);

  const fileName = `Reporte_Riesgo_${datos.cedula || 'Caso'}_${new Date().getTime()}.xlsx`;
  await descargarLibro(wb, fileName);
};

export const exportMultipleToExcel = async (cases) => {
  const ExcelJS = await cargarExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistema de Análisis de Riesgo LA/FT';
  wb.created = new Date();

  const data = cases.map((c, i) => {
    const riskScore = c.evaluaciones ? calculateInherentRisk(c.evaluaciones).inherente : 0;
    let nivel;
    if (riskScore <= 8) nivel = 'BAJO';
    else if (riskScore <= 14) nivel = 'MEDIO';
    else if (riskScore <= 19) nivel = 'MEDIO-ALTO';
    else nivel = 'ALTO';

    return {
      '#': i + 1,
      'Cliente': c.datos?.cliente || 'Sin nombre',
      'Cedula/RUC': c.datos?.cedula || '—',
      'Acto Notarial': c.datos?.acto || '—',
      'Valor (USD)': c.datos?.valor || 0,
      'Riesgo Inherente': riskScore,
      'Nivel': nivel,
      'Fecha': new Date(c.createdAt).toLocaleDateString('es-EC'),
      'PEP': c.datos?.esPep ? 'Si' : 'No',
      'Apoderado': c.datos?.apoderado ? 'Si' : 'No',
    };
  });

  const columnas = Object.keys(data[0] || {});
  const ws = crearHoja(wb, 'Resumen de Casos', [
    columnas,
    ...data.map(fila => columnas.map(columna => fila[columna]))
  ], [5, 30, 15, 25, 15, 15, 12, 12, 8, 10]);

  aplicarEstilo(ws, 1, 1, { negrita: true, tamano: 12, color: '1F6FEB' });

  const fileName = `Resumen_Casos_${cases.length}_${new Date().getTime()}.xlsx`;
  await descargarLibro(wb, fileName);
};
