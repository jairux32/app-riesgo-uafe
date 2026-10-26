export const generatePDFSignatureBlock = (doc, y, profile, signatures = {}) => {
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("FIRMAS DE VALIDACIÓN", 105, y, { align: "center" });
  y += 10;

  doc.setFontSize(9);
  if (signatures.oficial) {
    try {
      doc.addImage(signatures.oficial, 'PNG', 15, y, 80, 30);
    } catch {
      doc.line(20, y + 20, 90, y + 20);
    }
  } else {
    doc.line(20, y + 20, 90, y + 20);
  }
  doc.text(profile?.oficialCumplimiento || "Firma del Analista / Oficial de Cumplimiento", 55, y + 28, { align: "center" });

  if (signatures.notario) {
    try {
      doc.addImage(signatures.notario, 'PNG', 115, y, 80, 30);
    } catch {
      doc.line(120, y + 20, 190, y + 20);
    }
  } else {
    doc.line(120, y + 20, 190, y + 20);
  }
  doc.text(profile?.notario || "Firma y Sello del Notario Público", 155, y + 28, { align: "center" });

  if (signatures.notario || signatures.oficial) {
    y += 40;
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("Documento firmado digitalmente mediante Sistema de Análisis de Riesgo LA/FD", 105, y, { align: "center" });
    doc.text(`Fecha de firma: ${new Date().toLocaleString('es-EC')}`, 105, y + 4, { align: "center" });
  }
};

export const exportToPDF = async (datos, scores, factoresResult, controlesResult, geminiAnalysis, profile, signatures = {}) => {
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
  doc.text(`Fecha de Emision: ${new Date().toLocaleDateString('es-EC', { dateStyle: 'full' })}`, 15, y);
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
    const analysisText = typeof geminiAnalysis === 'string'
      ? geminiAnalysis.replace(/\*/g, '')
      : JSON.stringify(geminiAnalysis, null, 2);
    const lines = doc.splitTextToSize(analysisText, 180);
    for (const line of lines) {
      addPageIfNeeded(8);
      doc.text(line, 15, y);
      y += 5;
    }
  } else {
    doc.text("No se genero el analisis de IA.", 15, y);
    y += 10;
  }

  addPageIfNeeded(80);
  generatePDFSignatureBlock(doc, y, profile, signatures);

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
