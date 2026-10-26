import { validarDDC } from './validators';
import { describirCadenaPropiedad } from './beneficiarioFinal';
import { describirRevisiones } from './revisionCoincidencias';

export const exportROSPDF = async (datos, scores, evaluaciones, profile) => {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF();
  let y = 15;
  const ddc = validarDDC(datos);
  const beneficiario = datos.beneficiarioFinal || {};

  const addPageIfNeeded = (requiredSpace) => {
    if (y + requiredSpace > 280) {
      doc.addPage();
      y = 15;
    }
  };

  doc.setTextColor(230, 230, 230);
  doc.setFontSize(50);
  doc.text("CONFIDENCIAL", 40, 150, { angle: 45 });
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("REPORTE DE OPERACION SOSPECHOSA (ROS)", 105, y, { align: "center" });
  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Unidad de Analisis Financiero y Economico (UAFE) - Ecuador", 105, y, { align: "center" });
  y += 12;

  // SECCION A
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("SECCION A: INFORMACION GENERAL", 15, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  autoTable(doc, {
    startY: y,
    body: [
      ['Clase de Reporte', datos.claseReporte === 'tentativa' ? 'TENTATIVA' : 'INICIAL'],
      ['Ano de Reporte', new Date().getFullYear()],
      ['Mes de Reporte', new Date().getMonth() + 1],
      ['Prioridad', datos.prioridadReporte === 'alta' ? 'ALTA' : 'NORMAL'],
    ],
    theme: 'grid',
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', fillColor: [240, 240, 240] } }
  });
  y = doc.lastAutoTable.finalY + 10;

  // SECCION B
  addPageIfNeeded(40);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("SECCION B: INFORMACION DE LA INSTITUCION QUE REPORTA", 15, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  autoTable(doc, {
    startY: y,
    body: [
      ['RUC de la Institucion', profile?.ruc || 'Por completar'],
      ['Nombre de la Institucion', datos.notaria || 'N/A'],
      ['Notario/a Responsable', datos.notario || 'N/A'],
      ['Sector', 'NOTARIAL'],
    ],
    theme: 'grid',
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', fillColor: [240, 240, 240] } }
  });
  y = doc.lastAutoTable.finalY + 10;

  // SECCION C
  addPageIfNeeded(60);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("SECCION C: INFORMACION DE LA PERSONA O EMPRESA REPORTADA", 15, y);
  y += 8;
  doc.setFont("helvetica", "normal");

  const seccionC = [
    ['Tipo de Persona', datos.tipoPersona === 'juridica' ? 'JURIDICA' : 'NATURAL'],
    ['Tipo de Identificacion', datos.cedula?.length > 10 ? 'RUC' : 'CEDULA'],
    ['Numero de Identificacion', datos.cedula || 'N/A'],
    ['Nombre del Reportado', datos.cliente || 'N/A'],
    ['Nacionalidad', datos.nacionalidad || 'ECUADOR'],
    ['Provincia de Residencia', datos.provincia || 'Por completar'],
    ['Canton de Residencia', datos.canton || 'Por completar'],
    ['Parroquia de Residencia', datos.parroquia || 'Por completar'],
    ['Principal Actividad Economica', datos.actividad || 'N/A'],
    ['Persona Expuesta Politicamente', datos.esPep ? `SI - ${datos.detallePep || ''}` : 'NO'],
    ['Registrado en INTERPOL/ONU/OFAC', datos.registradoInterpolONUOFAC ? 'SI' : 'NO'],
    ['Antecedentes Penales o Judiciales', datos.antecedentesPenales ? 'SI' : 'NO'],
  ];

  if (datos.tipoPersona === 'juridica') {
    seccionC.push(['Representante Legal', datos.representanteLegal?.nombre || 'Por completar']);
    seccionC.push(['Cedula Representante', datos.representanteLegal?.cedula || 'Por completar']);
    seccionC.push(['Fecha de Constitucion', datos.fechaConstitucion || 'Por completar']);
    seccionC.push(['Beneficiario Final', beneficiario.nombre || 'Por completar']);
    seccionC.push(['Identificacion Beneficiario Final', beneficiario.cedula || 'Por completar']);
    seccionC.push(['Participacion Beneficiario Final', `${beneficiario.porcentaje || 'Por completar'}%`]);
    seccionC.push(['Beneficiario Final PEP', beneficiario.esPep ? `SI - ${beneficiario.detallePep || ''}` : 'NO']);
    const cadenaTexto = describirCadenaPropiedad(datos.cadenaPropiedad || []);
    if (cadenaTexto) {
      seccionC.push(['Cadena de Propiedad', cadenaTexto]);
    }
  } else {
    seccionC.push(['Estado Civil', datos.estadoCivil || 'Por completar']);
    if (datos.estadoCivil === 'casado') {
      seccionC.push(['Conyuge', datos.conyuge?.nombre || 'Por completar']);
    }
  }

  seccionC.push([
    'Revision de coincidencias en listas',
    describirRevisiones(datos.verificaciones || {})
  ]);

  seccionC.push([
    'Debida Diligencia (art. 47)',
    ddc.completa
      ? `COMPLETA${ddc.advertencias?.length ? ` - advertencia: ${ddc.advertencias.join(' ')}` : ''}`
      : `INCOMPLETA - falta: ${ddc.faltantes.join(', ')}`
  ]);

  autoTable(doc, {
    startY: y,
    body: seccionC,
    theme: 'grid',
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', fillColor: [240, 240, 240] } }
  });
  y = doc.lastAutoTable.finalY + 10;

  // SECCION D
  addPageIfNeeded(80);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("SECCION D: INFORMACION DE LA INUSUALIDAD O SOSPECHA", 15, y);
  y += 8;
  doc.setFont("helvetica", "normal");

  const seccionD = [
    ['Monto de la Sospecha (USD)', datos.valor || 'N/A'],
    ['Moneda', 'USD'],
    ['Fecha de la Transaccion', datos.fechaTransaccion || 'Por completar'],
    ['Tipo de Transaccion', datos.tipoTransaccion || 'Por completar'],
    ['Uso de Efectivo', datos.usoEfectivo ? `SI - $${datos.montoEfectivo}` : 'NO'],
    ['Billetes de Alta Denominacion', datos.billetesAltaDenominacion ? `SI - $${datos.montoBilletesAlta}` : 'NO'],
    ['Uso de Activos Virtuales', datos.usoActivosVirtuales ? `SI - ${datos.tipoActivoVirtual}` : 'NO'],
    ['Score de Riesgo Inherente', `${scores.inherente}/25`],
    ['Nivel de Riesgo', scores.nivel],
  ];

  autoTable(doc, {
    startY: y,
    body: seccionD,
    theme: 'grid',
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', fillColor: [240, 240, 240] } }
  });
  y = doc.lastAutoTable.finalY + 10;

  // SEÑALES DE ALERTA
  addPageIfNeeded(60);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("SEÑALES DE ALERTA DETECTADAS", 15, y);
  y += 8;
  doc.setFont("helvetica", "normal");

  const senalesDetectadas = Object.entries(evaluaciones)
    .filter(([, val]) => val.prob > 0)
    .map(([id, val]) => [id, `Gravedad: ${val.imp}/5`]);

  if (senalesDetectadas.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Codigo', 'Descripcion']],
      body: senalesDetectadas,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [200, 50, 50] }
    });
  } else {
    doc.text("No se detectaron senales de alerta especificas.", 15, y);
  }
  y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : y + 10;

  // DESCRIPCION DE SOSPECHA
  addPageIfNeeded(40);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("DESCRIPCION DE LAS INUSUALIDADES Y/O SOSPECHAS", 15, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const descLines = doc.splitTextToSize(datos.observaciones || 'Por completar por el Oficial de Cumplimiento...', 180);
  for (const line of descLines) {
    addPageIfNeeded(6);
    doc.text(line, 15, y);
    y += 5;
  }
  y += 10;

  // FIRMAS
  addPageIfNeeded(40);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("FIRMAS", 15, y);
  y += 15;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("_".repeat(50), 15, y);
  doc.text("_".repeat(50), 110, y);
  y += 6;
  doc.text("Oficial de Cumplimiento", 15, y);
  doc.text("Notario/a", 110, y);
  y += 6;
  doc.text(`Nombre: ${profile?.oficialCumplimiento || '_________________________'}`, 15, y);
  doc.text(`Nombre: ${datos.notario || '_________________________'}`, 110, y);

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generado por Sistema de Analisis de Riesgo LA/FD - ${new Date().toLocaleDateString('es-EC')}`, 105, 290, { align: "center" });

  doc.save(`ROS_${datos.cliente?.replace(/\s+/g, '_') || 'Reporte'}_${new Date().getTime()}.pdf`);
};
