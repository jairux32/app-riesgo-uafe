/**
 * Sistema de Alertas Inteligentes
 * Detecta situaciones de riesgo operativo y genera alertas accionables
 */

import { calculateInherentRisk } from './calculations';

const DIAS_ESTANCAMIENTO = 7;
const DIAS_VENCIMIENTO_UAFE = 10; // Plazo para reportar desde aprobación (simulado)
const SCORE_ALTO_RIESGO = 15;
const SCORE_CRITICO = 20;

/**
 * Genera alertas inteligentes basadas en el portfolio de casos
 */
export function generarAlertas(cases) {
  const alertas = [];
  const ahora = new Date();

  // 1. Casos estancados (sin avance por más de X días)
  cases.forEach(c => {
    const estado = c.datos?.estado || 'borrador';
    const updatedAt = c.updatedAt ? new Date(c.updatedAt) : new Date(c.createdAt);
    const diasSinCambio = Math.floor((ahora - updatedAt) / (1000 * 60 * 60 * 24));

    if ((estado === 'borrador' || estado === 'pendiente') && diasSinCambio >= DIAS_ESTANCAMIENTO) {
      alertas.push({
        tipo: 'estancado',
        prioridad: diasSinCambio >= 14 ? 'alta' : 'media',
        casoId: c.id,
        cliente: c.datos?.cliente || 'Sin nombre',
        mensaje: `Caso en estado "${estado}" sin movimiento por ${diasSinCambio} días`,
        accion: 'Revisar y avanzar estado',
        dias: diasSinCambio,
        fecha: updatedAt.toISOString()
      });
    }
  });

  // 2. Clientes recurrentes de alto riesgo
  const clientesMap = new Map();
  cases.forEach(c => {
    const cliente = c.datos?.cliente?.trim().toLowerCase();
    if (!cliente) return;
    const risk = calculateInherentRisk(c.evaluaciones || {});
    if (!clientesMap.has(cliente)) {
      clientesMap.set(cliente, { nombre: c.datos.cliente, casos: [], scores: [] });
    }
    clientesMap.get(cliente).casos.push(c);
    clientesMap.get(cliente).scores.push(risk.inherente);
  });

  clientesMap.forEach((data, cliente) => {
    const casosAltos = data.scores.filter(s => s >= SCORE_ALTO_RIESGO).length;
    if (casosAltos >= 2) {
      const maxScore = Math.max(...data.scores);
      alertas.push({
        tipo: 'recurrente_alto_riesgo',
        prioridad: maxScore >= SCORE_CRITICO ? 'alta' : 'media',
        cliente: data.nombre,
        mensaje: `Cliente con ${casosAltos} casos de riesgo alto (máx: ${maxScore}/25)`,
        accion: 'Revisar historial completo del cliente',
        totalCasos: data.casos.length,
        casosAltos
      });
    }
  });

  // 3. Vencimiento de reporte UAFE (casos críticos no reportados)
  cases.forEach(c => {
    const estado = c.datos?.estado || 'borrador';
    const risk = calculateInherentRisk(c.evaluaciones || {});
    if (risk.inherente >= SCORE_CRITICO && estado !== 'reportado_uafe') {
      const createdAt = new Date(c.createdAt);
      const diasDesdeCreacion = Math.floor((ahora - createdAt) / (1000 * 60 * 60 * 24));
      if (diasDesdeCreacion >= DIAS_VENCIMIENTO_UAFE) {
        alertas.push({
          tipo: 'vencimiento_uafe',
          prioridad: 'alta',
          casoId: c.id,
          cliente: c.datos?.cliente || 'Sin nombre',
          mensaje: `Caso crítico (${risk.inherente}/25) sin reportar a UAFE hace ${diasDesdeCreacion} días`,
          accion: 'Evaluar reporte ROS inmediato',
          dias: diasDesdeCreacion,
          score: risk.inherente
        });
      }
    }
  });

  // 4. Verificación de listas restrictivas pendiente
  cases.forEach(c => {
    const verifs = c.datos?.verificaciones;
    if (!verifs) return;
    const algunPendiente = ['ofac', 'onu', 'uafe'].some(k => verifs[k]?.estado === 'pendiente');
    if (algunPendiente) {
      const risk = calculateInherentRisk(c.evaluaciones || {});
      if (risk.inherente >= SCORE_ALTO_RIESGO) {
        alertas.push({
          tipo: 'verificacion_pendiente',
          prioridad: 'media',
          casoId: c.id,
          cliente: c.datos?.cliente || 'Sin nombre',
          mensaje: 'Verificación en listas restrictivas incompleta para caso de riesgo alto',
          accion: 'Completar verificación OFAC/ONU/UAFE',
          score: risk.inherente
        });
      }
    }
  });

  // Ordenar por prioridad
  const prioridadOrden = { alta: 0, media: 1, baja: 2 };
  alertas.sort((a, b) => prioridadOrden[a.prioridad] - prioridadOrden[b.prioridad]);

  return alertas;
}

/**
 * Obtiene estilo visual según tipo de alerta
 */
export function getAlertaStyle(tipo) {
  const styles = {
    estancado: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '⏰' },
    recurrente_alto_riesgo: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: '🔴' },
    vencimiento_uafe: { color: '#dc2626', bg: 'rgba(220,38,38,0.15)', icon: '🚨' },
    verificacion_pendiente: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '⚠️' },
  };
  return styles[tipo] || { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', icon: 'ℹ️' };
}

/**
 * Cuenta alertas por prioridad
 */
export function contarAlertasPorPrioridad(alertas) {
  return {
    alta: alertas.filter(a => a.prioridad === 'alta').length,
    media: alertas.filter(a => a.prioridad === 'media').length,
    baja: alertas.filter(a => a.prioridad === 'baja').length,
    total: alertas.length
  };
}
