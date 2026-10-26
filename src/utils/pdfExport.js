import { validarDDC } from './validators';
import { describirCadenaPropiedad } from './beneficiarioFinal';
import { describirRevisiones } from './revisionCoincidencias';
import { calcularObligaciones, combinarReportes } from './obligaciones';

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

  const ddc = validarDDC(datos);
  const beneficiario = datos.beneficiarioFinal || {};
  const estadoVerificacion = (clave) => {
    const estado = datos.verificaciones?.[clave]?.estado;
    if (!estado || estado === 'pendiente') return 'PENDIENTE';
    if (estado === 'no_configurado') return 'SIN FUENTE';
    return String(estado).toUpperCase();
  };

  if (datos.tipoPersona === 'juridica') {
    doc.text(`Beneficiario Final: ${beneficiario.nombre || 'N/A'} — ${beneficiario.cedula || 'N/A'} — ${beneficiario.porcentaje || 'N/A'}%`, 15, y);
    y += 6;

    const cadenaTexto = describirCadenaPropiedad(datos.cadenaPropiedad || []);
    if (cadenaTexto) {
      const cadenaLineas = doc.splitTextToSize(`Cadena de propiedad: ${cadenaTexto}`, 180);
      for (const linea of cadenaLineas) {
        addPageIfNeeded(8);
        doc.text(linea, 15, y);
        y += 5;
      }
      y += 1;
    }
  }
  const ddcTexto = ddc.completa
    ? `COMPLETA${ddc.advertencias?.length ? ` — advertencia: ${ddc.advertencias.join(' ')}` : ''}`
    : `INCOMPLETA — falta: ${ddc.faltantes.join(', ')}`;
  const ddcLineas = doc.splitTextToSize(`Debida Diligencia (art. 47): ${ddcTexto}`, 180);
  for (const linea of ddcLineas) {
    doc.text(linea, 15, y);
    y += 5;
  }
  doc.text(`Listas: OFAC ${estadoVerificacion('ofac')} | ONU ${estadoVerificacion('onu')} | UK ${estadoVerificacion('uk')} | UAFE ${estadoVerificacion('uafe')}`, 15, y);
  y += 5;

  const revisionLineas = doc.splitTextToSize(
    `Revisión de coincidencias: ${describirRevisiones(datos.verificaciones || {})}`,
    180
  );
  for (const linea of revisionLineas) {
    addPageIfNeeded(8);
    doc.text(linea, 15, y);
    y += 5;
  }
  y += 1;

  const obligaciones = calcularObligaciones(datos, {
    scoreInherente: scores.inherente,
    analisis: geminiAnalysis,
    fechaConocimiento: datos.reportes?.ros?.fechaConocimiento
  });
  const reportes = combinarReportes(obligaciones, datos.reportes);
  const reporteResu = reportes.resu;
  const reporteRos = reportes.ros;
  const obligacionesLineas = doc.splitTextToSize(
    `Reportes SISLAFT: ${reporteResu.tipo} (${reporteResu.fechaLimite}, ${reporteResu.estado}) | ${reporteRos.tipo} (${reporteRos.fechaLimite}, ${reporteRos.estado})`,
    180
  );
  for (const linea of obligacionesLineas) {
    doc.text(linea, 15, y);
    y += 5;
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
    const metaIA = typeof geminiAnalysis === 'object' ? geminiAnalysis?._meta : null;
    if (metaIA) {
      const metaTexto = [
        `Modelo: ${metaIA.modelo || '—'}`,
        `Prompt: ${metaIA.promptVersion || '—'}`,
        `Contexto legal: ${metaIA.contextoVersion || '—'}`,
        metaIA.generadoEn ? `Generado: ${new Date(metaIA.generadoEn).toLocaleString('es-EC')}` : null
      ].filter(Boolean).join('  |  ');
      doc.setFontSize(8);
      doc.setTextColor(110);
      const metaLines = doc.splitTextToSize(metaTexto, 180);
      for (const line of metaLines) {
        addPageIfNeeded(8);
        doc.text(line, 15, y);
        y += 4;
      }
      doc.setTextColor(0);
      doc.setFontSize(10);
      y += 2;
    }

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
