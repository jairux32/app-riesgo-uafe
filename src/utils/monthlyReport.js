export const generateMonthlyReport = async (cases, profile) => {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF();
  let y = 20;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('REPORTE MENSUAL DE GESTIÓN DE RIESGO LA/FD', 105, y, { align: 'center' });
  y += 12;

  doc.setFontSize(11);
  doc.text(profile?.notaria || 'Notaría', 105, y, { align: 'center' });
  y += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Periodo: ${new Date().toLocaleDateString('es-EC', { month: 'long', year: 'numeric' })}`, 105, y, { align: 'center' });
  y += 15;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMEN EJECUTIVO', 15, y);
  y += 8;

  const totalCases = cases.length;
  const highRisk = cases.filter(c => {
    if (!c.evaluaciones) return false;
    const score = Object.values(c.evaluaciones).reduce((sum, e) => sum + (e.prob * e.imp), 0);
    return score >= 15;
  }).length;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Total de casos procesados: ${totalCases}`, 15, y);
  y += 6;
  doc.text(`Casos de Riesgo Alto (≥15 pts): ${highRisk} (${totalCases > 0 ? Math.round((highRisk / totalCases) * 100) : 0}%)`, 15, y);
  y += 6;

  const avgScore = totalCases > 0
    ? Math.round(cases.reduce((sum, c) => {
        if (!c.evaluaciones) return sum;
        return sum + Object.values(c.evaluaciones).reduce((s, e) => s + (e.prob * e.imp), 0);
      }, 0) / totalCases)
    : 0;
  doc.text(`Score promedio de riesgo: ${avgScore}/25`, 15, y);
  y += 15;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('DETALLE DE CASOS', 15, y);
  y += 10;

  const tableData = cases.slice(0, 50).map(c => {
    const score = c.evaluaciones ? Object.values(c.evaluaciones).reduce((sum, e) => sum + (e.prob * e.imp), 0) : 0;
    const nivel = score <= 8 ? 'BAJO' : score <= 14 ? 'MEDIO' : score <= 19 ? 'MEDIO-ALTO' : 'ALTO';
    return [
      c.datos?.cliente?.substring(0, 25) || '',
      c.datos?.acto?.substring(0, 20) || '',
      String(score),
      nivel,
      new Date(c.createdAt).toLocaleDateString()
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['Cliente', 'Acto', 'Score', 'Riesgo', 'Fecha']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [26, 46, 68] }
  });

  const finalY = doc.lastAutoTable.finalY + 20;

  if (finalY > 250) doc.addPage();
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('RESPONSABLES', 15, finalY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Notario/a: ${profile?.notario || ''}`, 15, finalY + 8);
  doc.text(`Oficial de Cumplimiento: ${profile?.oficialCumplimiento || ''}`, 15, finalY + 16);

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`Página ${i} de ${pageCount} — Generado por Sistema de Gestión de Riesgo LA/FD`, 105, 290, { align: 'center' });
  }

  doc.save(`Reporte_Mensual_${new Date().toISOString().slice(0, 7)}.pdf`);
};
