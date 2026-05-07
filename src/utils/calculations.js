import { FACTORES_RIESGO, FACTORES_SENALES_UAFE, NIVELES_RIESGO } from '../data/constants';

// Detecta si las evaluaciones usan el sistema antiguo o el nuevo de señales UAFE
function detectarSistemaEvaluacion(evaluaciones) {
  const keys = Object.keys(evaluaciones);
  if (keys.length === 0) return 'senales'; // Default al nuevo sistema
  const tieneSenalesUAFE = keys.some(k => k.startsWith('SA'));
  return tieneSenalesUAFE ? 'senales' : 'factores';
}

// Calcula el score inherente total y de cada factor
export const calculateInherentRisk = (evaluaciones) => {
  const sistema = detectarSistemaEvaluacion(evaluaciones);
  const factoresUsados = sistema === 'senales' ? FACTORES_SENALES_UAFE : FACTORES_RIESGO;
  
  let scoreTotal = 0;
  const factoresResult = [];

  factoresUsados.forEach(factor => {
    let factorSuma = 0;
    let subEvaluados = 0;
    factor.subcriterios.forEach(sub => {
      const evalSub = evaluaciones[sub.id];
      if (evalSub) {
        factorSuma += (evalSub.prob * evalSub.imp);
        subEvaluados++;
      }
    });

    // Si no hay subcriterios evaluados, evitar división por cero
    const promedioFactor = subEvaluados > 0 ? factorSuma / factor.subcriterios.length : 0;
    const ponderadoFactor = promedioFactor * factor.peso;
    
    scoreTotal += ponderadoFactor;
    
    factoresResult.push({
      id: factor.id,
      nombre: factor.nombre,
      peso: factor.peso,
      promedio: promedioFactor.toFixed(2),
      ponderado: ponderadoFactor.toFixed(2)
    });
  });

  const inherenteRedondeado = Math.round(scoreTotal);
  
  // Encontrar el nivel de riesgo correspondiente
  const nivel = NIVELES_RIESGO.find(n => inherenteRedondeado <= n.max) || NIVELES_RIESGO[NIVELES_RIESGO.length - 1];

  return {
    inherente: inherenteRedondeado,
    nivel: nivel.nivel,
    diligencia: nivel.diligencia,
    colorClass: nivel.colorClass,
    factores: factoresResult
  };
};

// Calcula la efectividad de los controles y el riesgo residual
export const calculateResidualRisk = (inherentScore, controlesEval) => {
  let efectividadTotal = 0;
  let controlesExistentes = 0;
  const listaControles = [];

  Object.keys(controlesEval).forEach(id => {
    const ctrl = controlesEval[id];
    if (ctrl.existe) {
      controlesExistentes++;
      efectividadTotal += (ctrl.efectividad / 3);
      listaControles.push({
        id,
        existe: true,
        efectividad: ctrl.efectividad
      });
    } else {
      listaControles.push({
        id,
        existe: false,
        efectividad: 0
      });
    }
  });

  const efectividadPromedio = controlesExistentes > 0 ? efectividadTotal / controlesExistentes : 0;

  // El riesgo residual se reduce según la efectividad promedio de los controles
  // Si la efectividad es 100%, el riesgo se reduce a la mitad. Si es 0%, el riesgo se mantiene.
  const reduccion = inherentScore * (efectividadPromedio * 0.5);
  const residualScore = Math.round(inherentScore - reduccion);
  const finalResidualScore = Math.max(0, residualScore);
  
  const nivelResidual = NIVELES_RIESGO.find(n => finalResidualScore <= n.max) || NIVELES_RIESGO[NIVELES_RIESGO.length - 1];
  
  return {
    residual: finalResidualScore,
    nivelResidual: nivelResidual.nivel,
    colorClass: nivelResidual.colorClass,
    efectividadPromedio: efectividadPromedio.toFixed(2),
    lista: listaControles
  };

};
