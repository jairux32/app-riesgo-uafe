import { FACTORES_RIESGO, CONTROLES_INTERNOS, NIVELES_RIESGO } from '../data/constants';

const setCols = (ws, widths) => {
  ws['!cols'] = widths.map(w => ({ wch: w }));
};

const addStyle = (cell, style) => {
  if (cell) cell.s = style;
};

export const exportToExcel = async (datos, scores, factoresResult, controlesResult, geminiAnalysis) => {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

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
    ['Debida Diligencia Requerida:', scores.diligencia]
  ]);

  setCols(ws1, [30, 25, 30]);

  addStyle(ws1['A1'], { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center' } });
  addStyle(ws1['A2'], { font: { sz: 11 }, alignment: { horizontal: 'center' } });
  
  ['A6', 'A14'].forEach(addr => addStyle(ws1[addr], { font: { bold: true, sz: 12 }, fill: { fgColor: { rgb: '1F6FEB' } } }));
  ['A15', 'B15', 'C15'].forEach(addr => addStyle(ws1[addr], { font: { bold: true }, fill: { fgColor: { rgb: '112233' } } }));

  // Score colors
  const row18Color = scores.inherente <= 8 ? '10B981' : scores.inherente <= 14 ? 'F59E0B' : scores.inherente <= 19 ? 'F97316' : 'EF4444';
  const row19Color = controlesResult.residual <= 8 ? '10B981' : controlesResult.residual <= 14 ? 'F59E0B' : controlesResult.residual <= 19 ? 'F97316' : 'EF4444';
  addStyle(ws1['B16'], { font: { bold: true }, fill: { fgColor: { rgb: row18Color } }, alignment: { horizontal: 'center' } });
  addStyle(ws1['C16'], { font: { bold: true }, fill: { fgColor: { rgb: row18Color } }, alignment: { horizontal: 'center' } });
  addStyle(ws1['B17'], { font: { bold: true }, fill: { fgColor: { rgb: row19Color } }, alignment: { horizontal: 'center' } });
  addStyle(ws1['C17'], { font: { bold: true }, fill: { fgColor: { rgb: row19Color } }, alignment: { horizontal: 'center' } });

  XLSX.utils.book_append_sheet(wb, ws1, "PORTADA");

  // ==================== 2. DATOS CLIENTE ====================
  const ws2 = XLSX.utils.aoa_to_sheet([
    ['FICHA DE IDENTIFICACION DEL CLIENTE'],
    [''],
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
    ['OFAC', datos.ofac ? 'VERIFICADO' : 'No verificado'],
    ['ONU', datos.onu ? 'VERIFICADO' : 'No verificado'],
    ['PEP UAFE', datos.pepUafe ? 'VERIFICADO' : 'No verificado'],
    [''],
    ['OBSERVACIONES', datos.observaciones || 'Ninguna']
  ]);

  setCols(ws2, [30, 45]);
  addStyle(ws2['A1'], { font: { bold: true, sz: 12 }, fill: { fgColor: { rgb: '1F6FEB' } } });
  addStyle(ws2['A3'], { font: { bold: true }, fill: { fgColor: { rgb: '112233' } } });
  addStyle(ws2['A14'], { font: { bold: true }, fill: { fgColor: { rgb: '112233' } } });
  addStyle(ws2['A20'], { font: { bold: true }, fill: { fgColor: { rgb: '112233' } } });

  XLSX.utils.book_append_sheet(wb, ws2, "DATOS CLIENTE");

  // ==================== 3. ESCALAS ====================
  const ws3 = XLSX.utils.aoa_to_sheet([
    ['ESCALA DE CALIFICACION DE RIESGO'],
    [''],
    ['NIVEL', 'RANGO', 'DILIGENCIA'],
    [NIVELES_RIESGO[0].nivel, `1 - ${NIVELES_RIESGO[0].max}`, NIVELES_RIESGO[0].diligencia],
    [NIVELES_RIESGO[1].nivel, `1 - ${NIVELES_RIESGO[1].max}`, NIVELES_RIESGO[1].diligencia],
    [NIVELES_RIESGO[2].nivel, `1 - ${NIVELES_RIESGO[2].max}`, NIVELES_RIESGO[2].diligencia],
    [NIVELES_RIESGO[3].nivel, `1 - ${NIVELES_RIESGO[3].max}`, NIVELES_RIESGO[3].diligencia]
  ]);

  setCols(ws3, [18, 18, 50]);
  addStyle(ws3['A1'], { font: { bold: true, sz: 12 }, fill: { fgColor: { rgb: '1F6FEB' } } });
  addStyle(ws3['A3'], { font: { bold: true }, fill: { fgColor: { rgb: '112233' } } });

  const levelColors = ['10B981', 'F59E0B', 'F97316', 'EF4444'];
  levelColors.forEach((color, i) => {
    addStyle(ws3[`A${4+i}`], { font: { bold: true }, fill: { fgColor: { rgb: color } }, alignment: { horizontal: 'center' } });
  });

  XLSX.utils.book_append_sheet(wb, ws3, "ESCALAS");

  // ==================== 4. MATRIZ RIESGO ====================
  const matrizData = [
    ['FACTOR', 'PESO', 'SCORE PROMEDIO', 'SCORE PONDERADO']
  ];

  factoresResult.forEach(f => {
    matrizData.push([f.nombre, `${(f.peso * 100).toFixed(0)}%`, f.promedio, f.ponderado]);
  });

  matrizData.push(['', '', '', '']);
  matrizData.push(['DETALLE DE SUBCRITERIOS']);
  matrizData.push(['FACTOR', 'ID', 'PREGUNTA']);

  FACTORES_RIESGO.forEach(factor => {
    factor.subcriterios.forEach(sub => {
      matrizData.push([factor.nombre, sub.id, sub.pregunta]);
    });
  });

  const ws4 = XLSX.utils.aoa_to_sheet(matrizData);
  setCols(ws4, [25, 12, 15, 18]);
  addStyle(ws4['A1'], { font: { bold: true, sz: 12 }, fill: { fgColor: { rgb: '1F6FEB' } } });
  addStyle(ws4['A2'], { font: { bold: true }, fill: { fgColor: { rgb: '112233' } } });

  XLSX.utils.book_append_sheet(wb, ws4, "MATRIZ RIESGO");

  // ==================== 5. MAPA DE CALOR ====================
  const ws5 = XLSX.utils.aoa_to_sheet([
    ['MAPA DE CALOR: PROBABILIDAD x IMPACTO'],
    [''],
    ['Probabilidad ->', '1', '2', '3', '4', '5'],
    ['Impacto 1', 'BAJO', 'BAJO', 'BAJO', 'BAJO', 'MEDIO'],
    ['Impacto 2', 'BAJO', 'BAJO', 'MEDIO', 'MEDIO', 'MEDIO'],
    ['Impacto 3', 'BAJO', 'MEDIO', 'MEDIO', 'MEDIO', 'MEDIO-ALTO'],
    ['Impacto 4', 'BAJO', 'MEDIO', 'MEDIO', 'MEDIO-ALTO', 'ALTO'],
    ['Impacto 5', 'MEDIO', 'MEDIO', 'MEDIO-ALTO', 'ALTO', 'ALTO'],
    [''],
    ['Leyenda:', '', '', '', '', ''],
    ['BAJO', '1-8 puntos', '', '', '', ''],
    ['MEDIO', '9-14 puntos', '', '', '', ''],
    ['MEDIO-ALTO', '15-19 puntos', '', '', '', ''],
    ['ALTO', '20-25 puntos', '', '', '', '']
  ]);

  setCols(ws5, [20, 15, 15, 15, 15, 15]);
  addStyle(ws5['A1'], { font: { bold: true, sz: 12 }, fill: { fgColor: { rgb: '1F6FEB' } } });

  XLSX.utils.book_append_sheet(wb, ws5, "MAPA DE CALOR");

  // ==================== 6. CONTROLES ====================
  const ctrlData = [[ '#', 'CONTROL', 'EXISTE', 'EFECTIVIDAD']];

  CONTROLES_INTERNOS.forEach((ctrl, i) => {
    const c = controlesResult.lista.find(x => x.id === ctrl.id);
    ctrlData.push([i + 1, ctrl.nombre, c?.existe ? 'SI' : 'NO', c?.existe ? `${c.efectividad}/3` : '-']);
  });

  ctrlData.push(['', '', '', '']);
  ctrlData.push(['RESUMEN']);
  ctrlData.push(['Controles Existentes:', controlesResult.lista.filter(x => x.existe).length]);
  ctrlData.push(['Efectividad Promedio:', `${Math.round(controlesResult.efectividadPromedio * 100)}%`]);

  const ws6 = XLSX.utils.aoa_to_sheet(ctrlData);
  setCols(ws6, [5, 45, 12, 15]);
  addStyle(ws6['A1'], { font: { bold: true, sz: 12 }, fill: { fgColor: { rgb: '1F6FEB' } } });
  addStyle(ws6['A2'], { font: { bold: true }, fill: { fgColor: { rgb: '112233' } } });

  XLSX.utils.book_append_sheet(wb, ws6, "CONTROLES");

  // ==================== 7. REPORTE EJECUTIVO ====================
  const execLines = geminiAnalysis ? geminiAnalysis.split('\n') : ['No se genero analisis de IA.'];

  const ws7 = XLSX.utils.aoa_to_sheet([
    ['REPORTE EJECUTIVO Y ANALISIS DE IA'],
    [''],
    ['RESUMEN DE SCORES'],
    ['Score Inherente:', scores.inherente, '/25'],
    ['Nivel:', scores.nivel],
    ['Diligencia:', scores.diligencia],
    ['Score Residual:', controlesResult.residual, '/25'],
    ['Nivel Residual:', controlesResult.nivelResidual],
    ['Efectividad:', `${Math.round(controlesResult.efectividadPromedio * 100)}%`],
    [''],
    ['ANALISIS JURIDICO-NORMATIVO (GEMINI IA)'],
    ...execLines.map(line => [line])
  ]);

  setCols(ws7, [80]);
  addStyle(ws7['A1'], { font: { bold: true, sz: 12 }, fill: { fgColor: { rgb: '1F6FEB' } } });
  addStyle(ws7['A3'], { font: { bold: true }, fill: { fgColor: { rgb: '112233' } } });
  addStyle(ws7['A11'], { font: { bold: true }, fill: { fgColor: { rgb: '1F6FEB' } } });

  XLSX.utils.book_append_sheet(wb, ws7, "REPORTE EJECUTIVO");

  // Guardar
  const fileName = `Reporte_Riesgo_${datos.cedula || 'Caso'}_${new Date().getTime()}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

// ==================== PDF ====================
export const exportToPDF = async (datos, scores, factoresResult, controlesResult, geminiAnalysis) => {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF();
  let y = 15;

  const addPageIfNeeded = (requiredSpace) => {
    if (y + requiredSpace > 280) {
      doc.addPage();
      y = 15;
    }
  };

  doc.setTextColor(230, 230, 230);
  doc.setFontSize(60);
  doc.text("CONFIDENCIAL", 40, 150, { angle: 45 });
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("REPORTE DE ANALISIS DE RIESGO LA/FD", 105, y, { align: "center" });
  y += 10;
  
  doc.setFontSize(12);
  doc.text(datos.notaria || 'Notaria N/A', 105, y, { align: "center" });
  y += 15;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-EC', { dateStyle: 'full' })}`, 15, y);
  y += 15;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("DATOS DEL CASO", 15, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const dataLeft = [
    `Cliente: ${datos.cliente}`,
    `Cedula/RUC: ${datos.cedula}`,
    `Actividad: ${datos.actividad}`,
    `Acto Notarial: ${datos.acto}`
  ];
  const dataRight = [
    `Valor Operacion: USD ${datos.valor}`,
    `Origen Fondos: ${datos.origen}`,
    `PEP: ${datos.esPep ? 'Si' : 'No'}`,
    `Apoderado: ${datos.apoderado ? 'Si' : 'No'}`
  ];

  for (let i = 0; i < 4; i++) {
    doc.text(dataLeft[i], 15, y);
    doc.text(dataRight[i], 110, y);
    y += 6;
  }
  y += 5;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("RESUMEN DE SCORES", 15, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.text(`Riesgo Inherente: ${scores.inherente}/25 - ${scores.nivel}`, 15, y);
  y += 6;
  doc.text(`Debida Diligencia: ${scores.diligencia}`, 15, y);
  y += 6;
  doc.text(`Riesgo Residual: ${controlesResult.residual}/25 - ${controlesResult.nivelResidual}`, 15, y);
  y += 10;

  addPageIfNeeded(60);
  autoTable(doc, {
    startY: y,
    head: [['Factor', 'Peso', 'Score Promedio', 'Score Ponderado']],
    body: factoresResult.map(f => [f.nombre, `${f.peso * 100}%`, f.promedio, f.ponderado]),
    theme: 'grid',
    styles: { fontSize: 9 },
    headStyles: { fillColor: [26, 46, 68] }
  });
  y = doc.lastAutoTable.finalY + 15;

  addPageIfNeeded(40);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("ANALISIS JURIDICO-NORMATIVO (GEMINI IA)", 15, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  if (geminiAnalysis) {
    const lines = doc.splitTextToSize(geminiAnalysis.replace(/\*/g, ''), 180);
    for (let i = 0; i < lines.length; i++) {
      addPageIfNeeded(8);
      doc.text(lines[i], 15, y);
      y += 5;
    }
  } else {
    doc.text("No se genero el analisis de IA.", 15, y);
    y += 10;
  }

  addPageIfNeeded(60);
  generatePDFSignatureBlock(doc, y);

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Pagina ${i} de ${pageCount}`, 105, 290, { align: "center" });
    doc.text("Documento generado por Sistema de Gestion de Riesgo LA/FD - CONFIDENCIAL", 105, 285, { align: "center" });
  }

  doc.save(`Reporte_Riesgo_${datos.cedula || 'Caso'}_${new Date().getTime()}.pdf`);
};

export const generatePDFSignatureBlock = (doc, y) => {
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("FIRMAS DE VALIDACIÓN", 105, y, { align: "center" });
  y += 20;

  doc.line(20, y, 90, y);
  doc.line(120, y, 190, y);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Firma del Analista / Oficial de Cumplimiento", 55, y + 5, { align: "center" });
  doc.text("Firma y Sello del Notario Público", 155, y + 5, { align: "center" });
};
