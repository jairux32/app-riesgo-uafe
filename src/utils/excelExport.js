import { FACTORES_RIESGO, CONTROLES_INTERNOS, NIVELES_RIESGO } from '../data/constants';
import { calculateInherentRisk } from './calculations';
import { validarDDC } from './validators';
import { filasCadenaPropiedad } from './beneficiarioFinal';
import { describirRevisiones } from './revisionCoincidencias';
import { filasEvidencias } from './evidencias';
import { calcularObligaciones, combinarReportes } from './obligaciones';

const setCols = (ws, widths) => {
  ws['!cols'] = widths.map(w => ({ wch: w }));
};

const addStyle = (cell, style) => {
  if (cell) cell.s = style;
};

const scoreColor = (score) =>
  score <= 8 ? '10B981' : score <= 14 ? 'F59E0B' : score <= 19 ? 'F97316' : 'EF4444';

const headerStyle = { font: { bold: true, sz: 12 }, fill: { fgColor: { rgb: '1F6FEB' } } };
const subheaderStyle = { font: { bold: true }, fill: { fgColor: { rgb: '112233' } } };

export const exportToExcel = async (datos, scores, factoresResult, controlesResult, geminiAnalysis) => {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
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
  const ws1 = XLSX.utils.aoa_to_sheet([
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
  ]);

  setCols(ws1, [30, 25, 30]);
  addStyle(ws1['A1'], { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center' } });
  addStyle(ws1['A2'], { font: { sz: 11 }, alignment: { horizontal: 'center' } });
  ['A6', 'A14'].forEach(addr => addStyle(ws1[addr], { font: { bold: true, sz: 12 }, fill: { fgColor: { rgb: '1F6FEB' } } }));
  ['A15', 'B15', 'C15'].forEach(addr => addStyle(ws1[addr], { font: { bold: true }, fill: { fgColor: { rgb: '112233' } } }));

  const r18c = scoreColor(scores.inherente);
  const r19c = scoreColor(controlesResult.residual);
  addStyle(ws1['B16'], { font: { bold: true }, fill: { fgColor: { rgb: r18c } }, alignment: { horizontal: 'center' } });
  addStyle(ws1['C16'], { font: { bold: true }, fill: { fgColor: { rgb: r18c } }, alignment: { horizontal: 'center' } });
  addStyle(ws1['B17'], { font: { bold: true }, fill: { fgColor: { rgb: r19c } }, alignment: { horizontal: 'center' } });
  addStyle(ws1['C17'], { font: { bold: true }, fill: { fgColor: { rgb: r19c } }, alignment: { horizontal: 'center' } });

  XLSX.utils.book_append_sheet(wb, ws1, "PORTADA");

  // ==================== 2. DATOS CLIENTE ====================
  const ws2 = XLSX.utils.aoa_to_sheet([
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
  ]);

  setCols(ws2, [30, 45]);
  addStyle(ws2['A1'], headerStyle);
  [3, 14, 20].forEach(r => addStyle(ws2[`A${r}`], subheaderStyle));

  XLSX.utils.book_append_sheet(wb, ws2, "DATOS CLIENTE");

  // ==================== 3. ESCALAS ====================
  const ws3 = XLSX.utils.aoa_to_sheet([
    ['ESCALA DE CALIFICACION DE RIESGO'], [''],
    ['NIVEL', 'RANGO', 'DILIGENCIA'],
    ...NIVELES_RIESGO.map(n => [n.nivel, `1 - ${n.max}`, n.diligencia])
  ]);

  setCols(ws3, [18, 18, 50]);
  addStyle(ws3['A1'], headerStyle);
  addStyle(ws3['A3'], subheaderStyle);
  ['10B981', 'F59E0B', 'F97316', 'EF4444'].forEach((color, i) => {
    addStyle(ws3[`A${4 + i}`], { font: { bold: true }, fill: { fgColor: { rgb: color } }, alignment: { horizontal: 'center' } });
  });

  XLSX.utils.book_append_sheet(wb, ws3, "ESCALAS");

  // ==================== 4. MATRIZ RIESGO ====================
  const matrizData = [
    ['FACTOR', 'PESO', 'SCORE PROMEDIO', 'SCORE PONDERADO'],
    ...factoresResult.map(f => [f.nombre, `${(f.peso * 100).toFixed(0)}%`, f.promedio, f.ponderado]),
    ['', '', '', ''],
    ['DETALLE DE SUBCRITERIOS'],
    ['FACTOR', 'ID', 'PREGUNTA'],
    ...FACTORES_RIESGO.flatMap(factor =>
      factor.subcriterios.map(sub => [factor.nombre, sub.id, sub.pregunta])
    )
  ];

  const ws4 = XLSX.utils.aoa_to_sheet(matrizData);
  setCols(ws4, [25, 12, 15, 18]);
  addStyle(ws4['A1'], headerStyle);
  addStyle(ws4['A2'], subheaderStyle);

  XLSX.utils.book_append_sheet(wb, ws4, "MATRIZ RIESGO");

  // ==================== 5. MAPA DE CALOR ====================
  const ws5 = XLSX.utils.aoa_to_sheet([
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
  ]);

  setCols(ws5, [20, 15, 15, 15, 15, 15]);
  addStyle(ws5['A1'], headerStyle);

  XLSX.utils.book_append_sheet(wb, ws5, "MAPA DE CALOR");

  // ==================== 6. CONTROLES ====================
  const ctrlData = [
    ['#', 'CONTROL', 'EXISTE', 'EFECTIVIDAD'],
    ...CONTROLES_INTERNOS.map((ctrl, i) => {
      const c = controlesResult.lista.find(x => x.id === ctrl.id);
      return [i + 1, ctrl.nombre, c?.existe ? 'SI' : 'NO', c?.existe ? `${c.efectividad}/3` : '-'];
    }),
    ['', '', '', ''],
    ['RESUMEN'],
    ['Controles Existentes:', controlesResult.lista.filter(x => x.existe).length],
    ['Efectividad Promedio:', `${Math.round(controlesResult.efectividadPromedio * 100)}%`]
  ];

  const ws6 = XLSX.utils.aoa_to_sheet(ctrlData);
  setCols(ws6, [5, 45, 12, 15]);
  addStyle(ws6['A1'], headerStyle);
  addStyle(ws6['A2'], subheaderStyle);

  XLSX.utils.book_append_sheet(wb, ws6, "CONTROLES");

  // ==================== 7. REPORTE EJECUTIVO ====================
  const analysisText = typeof geminiAnalysis === 'string'
    ? geminiAnalysis
    : geminiAnalysis ? JSON.stringify(geminiAnalysis, null, 2) : '';
  const metaIA = typeof geminiAnalysis === 'object' ? geminiAnalysis?._meta : null;
  const execLines = analysisText ? analysisText.split('\n') : ['No se genero analisis de IA.'];
  const ws7 = XLSX.utils.aoa_to_sheet([
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
  ]);

  setCols(ws7, [80]);
  addStyle(ws7['A1'], headerStyle);
  addStyle(ws7['A3'], subheaderStyle);
  addStyle(ws7[`A${metaIA ? 17 : 11}`], headerStyle);

  XLSX.utils.book_append_sheet(wb, ws7, "REPORTE EJECUTIVO");

  const fileName = `Reporte_Riesgo_${datos.cedula || 'Caso'}_${new Date().getTime()}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

export const exportMultipleToExcel = async (cases) => {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

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

  const ws = XLSX.utils.json_to_sheet(data);
  const setCols = (ws, widths) => { ws['!cols'] = widths.map(w => ({ wch: w })); };
  setCols(ws, [5, 30, 15, 25, 15, 15, 12, 12, 8, 10]);

  const addStyle = (cell, style) => { if (cell) cell.s = style; };
  addStyle(ws['A1'], { font: { bold: true, sz: 12 }, fill: { fgColor: { rgb: '1F6FEB' } } });

  XLSX.utils.book_append_sheet(wb, ws, "Resumen de Casos");

  const fileName = `Resumen_Casos_${cases.length}_${new Date().getTime()}.xlsx`;
  XLSX.writeFile(wb, fileName);
};
