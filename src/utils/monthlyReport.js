import {
  NIVELES_RIESGO,
  nivelDeScore as nivelDeScoreCalidad,
  scoreDeCaso as scoreDeCasoCalidad
} from './calidadModelo';
import { calcularObligaciones, estadoVencimiento } from './obligaciones';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

const ESTADOS_COMPLETADOS = ['enviado', 'acuse_recibido'];

/**
 * Niveles del motor de scoring. Se derivan del tablero de calidad para que el
 * reporte y la calibración usen los mismos cortes: ALTO empieza en 20 puntos y
 * el tramo 15-19 es MEDIO-ALTO. El reporte anterior usaba ≥15 como "Riesgo Alto".
 */
export const NIVELES_REPORTE = NIVELES_RIESGO.map(nivel => ({
  id: nivel.id,
  etiqueta: nivel.etiqueta.toUpperCase(),
  rango: `${nivel.min}-${nivel.max}`
}));

const aFecha = (valor) => {
  if (!valor) return null;
  const fecha = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

/**
 * Clave `AAAA-MM` en hora local. Evita `toISOString()`, que en Ecuador cambia
 * de mes desde las 19:00 del último día por el desfase UTC.
 */
export const claveMesLocal = (fecha) => {
  const valor = aFecha(fecha);
  if (!valor) return null;
  const mes = String(valor.getMonth() + 1).padStart(2, '0');
  return `${valor.getFullYear()}-${mes}`;
};

const etiquetaMes = (clave) => {
  const [anio, mes] = String(clave || '').split('-').map(Number);
  if (!anio || !mes || mes < 1 || mes > 12) return 'periodo sin fecha';
  return `${MESES[mes - 1]} de ${anio}`;
};

/**
 * Score guardado en el caso o recalculado desde las evaluaciones. Devuelve
 * `null` cuando el caso todavía no tiene evaluación: no es lo mismo "sin
 * evaluar" que "riesgo 0". Se reutiliza el criterio del tablero de calidad.
 */
export const scoreDeCaso = scoreDeCasoCalidad;

export const nivelDeScore = (score) => nivelDeScoreCalidad(score)?.id ?? null;

const limiteEfectivo = (obligacion) => {
  const limite = obligacion?.fechaLimite || '';
  const prorroga = obligacion?.fechaLimiteProrroga || '';
  return prorroga > limite ? prorroga : limite;
};

const esVencida = (obligacion, hoy) => {
  if (!obligacion || ESTADOS_COMPLETADOS.includes(obligacion.estado)) return false;
  return estadoVencimiento(limiteEfectivo(obligacion), hoy).estado === 'vencida';
};

const obligacionesDeCaso = (caso, score, hoy) => {
  const datos = caso?.datos || {};
  const guardados = datos.reportes || {};
  const sugerencias = calcularObligaciones(datos, {
    scoreInherente: score ?? 0,
    analisis: caso?.analysis,
    hoy
  });

  const unir = (clave) => {
    const guardado = guardados[clave] || {};
    const sugerida = sugerencias[clave] || {};
    return {
      tipo: guardado.tipo || sugerida.tipo,
      estado: guardado.estado || 'pendiente',
      fechaLimite: guardado.fechaLimite || sugerida.fechaLimite,
      fechaLimiteProrroga: guardado.fechaLimiteProrroga || sugerida.fechaLimiteProrroga
    };
  };

  return { resu: unir('resu'), ros: unir('ros') };
};

const vacioObligaciones = () => ({
  reportar: 0,
  noReportar: 0,
  pendientes: 0,
  enviados: 0,
  noAplica: 0,
  vencidos: 0
});

const resumirObligaciones = (obligaciones, hoy) => {
  const resu = vacioObligaciones();
  const ros = vacioObligaciones();

  obligaciones.forEach(({ resu: r, ros: s }) => {
    if (r.tipo === 'RESU') resu.reportar++;
    else resu.noReportar++;

    if (r.estado === 'no_aplica') resu.noAplica++;
    else if (ESTADOS_COMPLETADOS.includes(r.estado)) resu.enviados++;
    else resu.pendientes++;

    if (s.tipo === 'ROS') ros.reportar++;
    else ros.noReportar++;

    if (s.estado === 'no_aplica') ros.noAplica++;
    else if (ESTADOS_COMPLETADOS.includes(s.estado)) ros.enviados++;
    else ros.pendientes++;

    if (esVencida(r, hoy)) resu.vencidos++;
    if (esVencida(s, hoy)) ros.vencidos++;
  });

  return { resu, ros };
};

/**
 * Construye el resumen del reporte mensual. Es una función pura para poder
 * probarla con un reloj fijo. Solo incluye los casos creados en el mes local de
 * `ahora`; calcular el PDF y rotularlo con el mes actual era el error anterior.
 */
export const construirResumenMensual = (cases = [], { ahora = new Date() } = {}) => {
  const hoy = aFecha(ahora) || new Date();
  const clave = claveMesLocal(hoy);
  const lista = Array.isArray(cases) ? cases : [];
  const delMes = lista.filter(caso => claveMesLocal(caso?.createdAt) === clave);

  const filas = delMes.map(caso => {
    const score = scoreDeCaso(caso);
    return {
      id: caso?.id ?? null,
      cliente: caso?.datos?.cliente || '',
      acto: caso?.datos?.acto || '',
      score,
      nivel: nivelDeScore(score),
      fecha: aFecha(caso?.createdAt),
      obligaciones: obligacionesDeCaso(caso, score, hoy)
    };
  });

  const evaluadas = filas.filter(fila => fila.score !== null);
  const niveles = { bajo: 0, medio: 0, medio_alto: 0, alto: 0 };
  evaluadas.forEach(fila => {
    niveles[fila.nivel] += 1;
  });

  const promedioScore = evaluadas.length > 0
    ? Math.round((evaluadas.reduce((total, fila) => total + fila.score, 0) / evaluadas.length) * 10) / 10
    : 0;

  return {
    periodo: { clave, etiqueta: etiquetaMes(clave) },
    total: filas.length,
    evaluados: evaluadas.length,
    sinEvaluar: filas.length - evaluadas.length,
    promedioScore,
    niveles,
    obligaciones: resumirObligaciones(filas.map(fila => fila.obligaciones), hoy),
    casos: filas.map(fila => ({
      id: fila.id,
      cliente: fila.cliente,
      acto: fila.acto,
      score: fila.score,
      nivel: fila.nivel,
      fecha: fila.fecha
    }))
  };
};

const etiquetaNivel = (id) => NIVELES_REPORTE.find(nivel => nivel.id === id)?.etiqueta || 'SIN EVALUAR';

const textoCliente = (cliente) => (cliente ? String(cliente).substring(0, 28) : 'Sin nombre');
const textoActo = (acto) => (acto ? String(acto).substring(0, 22) : '');

export const generateMonthlyReport = async (cases, profile, opciones = {}) => {
  const resumen = construirResumenMensual(cases, opciones);
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF();
  const margen = 15;
  const centro = doc.internal.pageSize.getWidth() / 2;
  let y = 20;

  const asegurarEspacio = (alto) => {
    if (y + alto > 265) {
      doc.addPage();
      y = 20;
    }
  };

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('REPORTE MENSUAL DE GESTIÓN DE RIESGO LA/FT', centro, y, { align: 'center' });
  y += 10;

  doc.setFontSize(11);
  doc.text(profile?.notaria || 'Notaría', centro, y, { align: 'center' });
  y += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Periodo: ${resumen.periodo.etiqueta}`, centro, y, { align: 'center' });
  y += 15;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMEN EJECUTIVO', margen, y);
  y += 8;

  const porcentajeAlto = resumen.evaluados > 0
    ? Math.round((resumen.niveles.alto / resumen.evaluados) * 100)
    : 0;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Total de casos del periodo: ${resumen.total}`, margen, y);
  y += 6;
  doc.text(`Casos evaluados: ${resumen.evaluados} · Sin evaluar: ${resumen.sinEvaluar}`, margen, y);
  y += 6;
  doc.text(`Casos de Riesgo Alto (≥20 pts): ${resumen.niveles.alto} (${porcentajeAlto}% de los evaluados)`, margen, y);
  y += 6;
  doc.text(`Score promedio de riesgo: ${resumen.promedioScore}/25`, margen, y);
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.text('Distribución por nivel', margen, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  NIVELES_REPORTE.forEach(nivel => {
    doc.text(`${nivel.etiqueta} (${nivel.rango}): ${resumen.niveles[nivel.id]} caso(s)`, margen + 3, y);
    y += 5;
  });
  y += 6;

  asegurarEspacio(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('DETALLE DE CASOS', margen, y);
  y += 8;

  if (resumen.casos.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text('Sin casos registrados en el periodo.', margen, y);
    y += 12;
  } else {
    const tableData = resumen.casos.map(caso => [
      textoCliente(caso.cliente),
      textoActo(caso.acto),
      caso.score === null ? '—' : String(caso.score),
      caso.score === null ? 'SIN EVALUAR' : etiquetaNivel(caso.nivel),
      caso.fecha ? caso.fecha.toLocaleDateString('es-EC') : ''
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Cliente', 'Acto', 'Score', 'Riesgo', 'Fecha']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 7 },
      headStyles: { fillColor: [26, 46, 68] },
      margin: { left: margen, right: margen, top: 20, bottom: 20 },
      pageBreak: 'auto'
    });
    y = doc.lastAutoTable.finalY + 12;
  }

  const obligaciones = resumen.obligaciones;
  asegurarEspacio(45);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('OBLIGACIONES DE REPORTE', margen, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`RESU / NO-RESU: ${obligaciones.resu.reportar} / ${obligaciones.resu.noReportar}`, margen, y);
  y += 5;
  doc.text(
    `Pendientes: ${obligaciones.resu.pendientes} · Enviados: ${obligaciones.resu.enviados} · No aplica: ${obligaciones.resu.noAplica} · Vencidos: ${obligaciones.resu.vencidos}`,
    margen, y
  );
  y += 8;
  doc.text(`ROS / NO-ROS: ${obligaciones.ros.reportar} / ${obligaciones.ros.noReportar}`, margen, y);
  y += 5;
  doc.text(
    `Pendientes: ${obligaciones.ros.pendientes} · Enviados: ${obligaciones.ros.enviados} · No aplica: ${obligaciones.ros.noAplica} · Vencidos: ${obligaciones.ros.vencidos}`,
    margen, y
  );
  y += 5;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.text('Los conteos incluyen el seguimiento registrado y, si falta, el plazo sugerido por el sistema.', margen, y);
  y += 12;

  asegurarEspacio(30);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('RESPONSABLES', margen, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Notario/a: ${profile?.notario || ''}`, margen, y);
  y += 8;
  doc.text(`Oficial de Cumplimiento: ${profile?.oficialCumplimiento || ''}`, margen, y);

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`Página ${i} de ${pageCount} — Generado por Sistema de Gestión de Riesgo LA/FT`, centro, 290, { align: 'center' });
  }

  doc.save(`Reporte_Mensual_${resumen.periodo.clave}.pdf`);
  return resumen;
};
