import {
  FACTORES_RIESGO,
  FACTORES_SENALES_UAFE,
  NIVELES_RIESGO,
  CONTROLES_INTERNOS
} from '../data/constants';

// Peso de la señal más crítica dentro de un factor.
// La media sola diluye una señal grave entre muchas leves; mezclarla
// con el máximo garantiza que un hallazgo crítico aislado no desaparezca.
const PESO_MAXIMO_FACTOR = 0.5;

// Reducción máxima del riesgo inherente atribuible a los controles.
// Ningún control interno elimina por completo el riesgo de LA/FT.
const REDUCCION_MAXIMA_CONTROLES = 0.5;

const clamp = (valor, min, max) => Math.min(max, Math.max(min, valor));

// Detecta si las evaluaciones usan el sistema antiguo (factores) o el nuevo de señales UAFE
function detectarSistemaEvaluacion(evaluaciones) {
  const keys = Object.keys(evaluaciones);
  if (keys.length === 0) return 'senales'; // Default al nuevo sistema
  const tieneSenalesUAFE = keys.some(k => k.startsWith('SA'));
  return tieneSenalesUAFE ? 'senales' : 'factores';
}

/**
 * Lleva la probabilidad a la escala 1-5.
 *
 * En el sistema de señales la UI envía una bandera 0/1 (señal presente o no).
 * Interpretarla como 0/1 hacía que el score máximo real fuera 5 sobre 25 y que
 * todos los casos cayeran en riesgo BAJO. Una señal presente se valora como
 * probabilidad alta (5) y una ausente como probabilidad baja (1); la gravedad
 * (impacto 1-5) sigue siendo la que gradúa el resultado.
 *
 * En el sistema antiguo la probabilidad ya viene en escala 1-5.
 */
function probabilidadEnEscala(prob, sistema) {
  const valor = Number(prob);
  if (!Number.isFinite(valor)) return 1;
  if (sistema === 'senales') return valor > 0 ? 5 : 1;
  return clamp(valor, 1, 5);
}

function impactoEnEscala(imp) {
  const valor = Number(imp);
  if (!Number.isFinite(valor)) return 1;
  return clamp(valor, 1, 5);
}

// Calcula el score inherente total y de cada factor
export const calculateInherentRisk = (evaluaciones = {}) => {
  const sistema = detectarSistemaEvaluacion(evaluaciones);
  const factoresUsados = sistema === 'senales' ? FACTORES_SENALES_UAFE : FACTORES_RIESGO;

  // Los pesos del catálogo suman 0,999; se normalizan por su suma real.
  const pesoTotal = factoresUsados.reduce((suma, f) => suma + (f.peso || 0), 0) || 1;

  let scoreTotal = 0;
  let senalesEvaluadas = 0;
  let senalesTotales = 0;
  const factoresResult = [];

  factoresUsados.forEach(factor => {
    const totalFactor = factor.subcriterios.length;
    senalesTotales += totalFactor;

    let sumaProductos = 0;
    let maximoProducto = 0;
    let evaluadasFactor = 0;

    factor.subcriterios.forEach(sub => {
      const evaluacion = evaluaciones[sub.id];
      if (!evaluacion) return;

      const producto =
        probabilidadEnEscala(evaluacion.prob, sistema) * impactoEnEscala(evaluacion.imp);

      sumaProductos += producto;
      if (producto > maximoProducto) maximoProducto = producto;
      evaluadasFactor++;
      senalesEvaluadas++;
    });

    // Media sobre el total de señales del factor: lo no evaluado no infla el riesgo.
    const media = totalFactor > 0 ? sumaProductos / totalFactor : 0;
    const representativo = evaluadasFactor > 0
      ? (1 - PESO_MAXIMO_FACTOR) * media + PESO_MAXIMO_FACTOR * maximoProducto
      : 0;

    const ponderado = representativo * ((factor.peso || 0) / pesoTotal);
    scoreTotal += ponderado;

    factoresResult.push({
      id: factor.id,
      nombre: factor.nombre,
      peso: factor.peso,
      promedio: media.toFixed(2),
      maximo: maximoProducto.toFixed(2),
      evaluadas: evaluadasFactor,
      total: totalFactor,
      ponderado: ponderado.toFixed(2)
    });
  });

  const inherente = clamp(Math.round(scoreTotal), 0, 25);

  // Encontrar el nivel de riesgo correspondiente
  const nivel = NIVELES_RIESGO.find(n => inherente <= n.max)
    || NIVELES_RIESGO[NIVELES_RIESGO.length - 1];

  return {
    inherente,
    nivel: nivel.nivel,
    diligencia: nivel.diligencia,
    colorClass: nivel.colorClass,
    factores: factoresResult,
    cobertura: {
      evaluadas: senalesEvaluadas,
      total: senalesTotales,
      porcentaje: senalesTotales > 0 ? Math.round((senalesEvaluadas / senalesTotales) * 100) : 0
    }
  };
};

// Calcula la efectividad de los controles y el riesgo residual
export const calculateResidualRisk = (inherentScore, controlesEval = {}) => {
  // El denominador es el catálogo completo de controles: un control ausente
  // cuenta como 0 y no puede ser compensado por uno solo perfecto.
  const totalControles = CONTROLES_INTERNOS.length || Object.keys(controlesEval).length || 1;

  let efectividadTotal = 0;
  const listaControles = [];
  const idsControles = CONTROLES_INTERNOS.map(c => c.id);

  // Se recorren también los controles definidos en el catálogo aunque no
  // vengan en la evaluación, para que queden registrados como no existentes.
  const idsEvaluados = Array.from(new Set([...idsControles, ...Object.keys(controlesEval)]));

  idsEvaluados.forEach(id => {
    const ctrl = controlesEval[id];
    if (ctrl?.existe) {
      const efectividad = clamp(Number(ctrl.efectividad) || 0, 0, 3);
      efectividadTotal += efectividad / 3;
      listaControles.push({ id, existe: true, efectividad });
    } else {
      listaControles.push({ id, existe: false, efectividad: 0 });
    }
  });

  const efectividadPromedio = totalControles > 0
    ? clamp(efectividadTotal / totalControles, 0, 1)
    : 0;

  const inherente = clamp(Number(inherentScore) || 0, 0, 25);
  const residualScore = Math.round(
    inherente - inherente * efectividadPromedio * REDUCCION_MAXIMA_CONTROLES
  );
  const finalResidualScore = clamp(residualScore, 0, 25);

  const nivelResidual = NIVELES_RIESGO.find(n => finalResidualScore <= n.max)
    || NIVELES_RIESGO[NIVELES_RIESGO.length - 1];

  return {
    residual: finalResidualScore,
    nivelResidual: nivelResidual.nivel,
    colorClass: nivelResidual.colorClass,
    efectividadPromedio: efectividadPromedio.toFixed(2),
    lista: listaControles
  };
};
