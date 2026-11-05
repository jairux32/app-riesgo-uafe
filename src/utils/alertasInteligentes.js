/**
 * Sistema de Alertas Inteligentes
 * Detecta situaciones de riesgo operativo y genera alertas accionables
 *
 * Los mensajes se redactan en lenguaje de negocio: quien los lee es un
 * notario, no un analista de datos. El puntaje de riesgo va de 0 a 25.
 */

import { calculateInherentRisk } from './calculations';
import { construirPerfilTransaccional, evaluarDesviaciones } from './perfilTransaccional';
import { detectarDuplicados } from './sincronizacion';
import { ESTADOS_CASO } from '../data/constants';

const DIAS_ESTANCAMIENTO = 7;
const DIAS_VENCIMIENTO_UAFE = 10; // Plazo para reportar desde aprobación (simulado)
const SCORE_ALTO_RIESGO = 15;
const SCORE_CRITICO = 20;

/**
 * Traduce el identificador interno del estado a la etiqueta que ve el usuario
 * ("en_revision" -> "En Revisión"). Si el estado no existe, se muestra el
 * identificador tal cual para no perder información.
 */
const etiquetaEstado = (id) =>
  ESTADOS_CASO.find(estado => estado.id === id)?.label || id;

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
        mensaje: `No se mueve desde hace ${diasSinCambio} días y sigue en estado "${etiquetaEstado(estado)}"`,
        accion: 'Revise el caso y actualice su estado',
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

  clientesMap.forEach((data) => {
    const casosAltos = data.scores.filter(s => s >= SCORE_ALTO_RIESGO).length;
    if (casosAltos >= 2) {
      const maxScore = Math.max(...data.scores);
      alertas.push({
        tipo: 'recurrente_alto_riesgo',
        prioridad: maxScore >= SCORE_CRITICO ? 'alta' : 'media',
        cliente: data.nombre,
        mensaje: `Este cliente tiene ${casosAltos} operaciones de riesgo alto (puntaje más alto: ${maxScore} de 25)`,
        accion: 'Revise todo el historial del cliente',
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
          mensaje: `Operación de riesgo alto sin reportar a la UAFE desde hace ${diasDesdeCreacion} días (puntaje ${risk.inherente} de 25)`,
          accion: 'Evalúe si corresponde enviar el reporte ROS',
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
    const algunPendiente = ['ofac', 'onu', 'uk', 'uafe'].some(k => verifs[k]?.estado === 'pendiente');
    if (algunPendiente) {
      const risk = calculateInherentRisk(c.evaluaciones || {});
      if (risk.inherente >= SCORE_ALTO_RIESGO) {
        alertas.push({
          tipo: 'verificacion_pendiente',
          prioridad: 'media',
          casoId: c.id,
          cliente: c.datos?.cliente || 'Sin nombre',
          mensaje: 'Falta verificar este caso de riesgo alto en las listas restrictivas (OFAC, ONU, UK y UAFE)',
          accion: 'Complete la verificación en las listas',
          score: risk.inherente
        });
      }
    }
  });

  // 5. Desviaciones frente al perfil transaccional del cliente
  const porCliente = new Map();
  cases.forEach(c => {
    const clave = String(c.datos?.cedula || '').trim() || c.datos?.cliente?.trim().toLowerCase();
    if (!clave) return;
    if (!porCliente.has(clave)) porCliente.set(clave, []);
    porCliente.get(clave).push(c);
  });

  porCliente.forEach(lista => {
    if (lista.length < 2) return;
    lista.forEach(caso => {
      const perfil = construirPerfilTransaccional(lista, {
        cedula: caso.datos?.cedula,
        cliente: caso.datos?.cliente,
        excluirCaseId: caso.id
      });
      if (!perfil.suficiente) return;

      const evaluacion = evaluarDesviaciones(caso.datos || {}, perfil);
      if (evaluacion.nivel === 'normal' || evaluacion.nivel === 'sin_perfil') return;

      alertas.push({
        tipo: 'desviacion_perfil',
        prioridad: evaluacion.nivel === 'atipico' ? 'alta' : 'media',
        casoId: caso.id,
        cliente: caso.datos?.cliente || 'Sin nombre',
        mensaje: evaluacion.alertas.map(a => a.mensaje).join(' '),
        accion: 'Documente el motivo de la diferencia o evalúe el reporte ROS',
        desviaciones: evaluacion.alertas
      });
    });
  });

  // 6. Posibles registros duplicados del mismo cliente, acto y mes
  detectarDuplicados(cases).forEach(grupo => {
    alertas.push({
      tipo: 'posible_duplicado',
      prioridad: 'media',
      casoId: grupo.casos[0]?.id,
      cliente: grupo.casos[0]?.cliente || 'Sin nombre',
      mensaje: `El mismo cliente tiene ${grupo.total} operaciones de "${grupo.acto}" en ${grupo.mes}`,
      accion: 'Revise si es un registro repetido y consolide el expediente',
      casos: grupo.casos
    });
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
    desviacion_perfil: { color: '#f97316', bg: 'rgba(249,115,22,0.1)', icon: '📈' },
    posible_duplicado: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '📑' },
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
