import { useState } from 'react';
import { FACTORES_SENALES_UAFE, ESCALA_VALORACION, CATEGORIAS_SENALES } from '../data/constants';
import { ChevronDown, ChevronUp, AlertTriangle, XCircle } from 'lucide-react';

export const Step2Senales = ({ evaluaciones, setEvaluaciones, onNext, onPrev }) => {
  const [expandedFactor, setExpandedFactor] = useState(null);

  const applyTemplate = (profile) => {
    const templates = {
      bajo: { prob: 0, imp: 1 },
      estandar: { prob: 0, imp: 3 },
      alto: { prob: 1, imp: 5 }
    };
    const { prob, imp } = templates[profile];
    
    const newEval = {};
    FACTORES_SENALES_UAFE.flatMap(f => f.subcriterios).forEach(sub => {
      newEval[sub.id] = { prob, imp };
    });
    setEvaluaciones(newEval);
  };

  const evaluatedCount = Object.keys(evaluaciones).length;
  const totalFactors = FACTORES_SENALES_UAFE.flatMap(f => f.subcriterios).length;
  const isAllEvaluated = evaluatedCount === totalFactors;
  const progressPercent = Math.round((evaluatedCount / totalFactors) * 100);

  const handleToggleSenal = (subId, presente) => {
    setEvaluaciones(prev => {
      const actual = prev[subId] || { prob: 0, imp: 1 };
      return {
        ...prev,
        [subId]: { prob: presente ? 1 : 0, imp: actual.imp }
      };
    });
  };

  const handleGravedadChange = (subId, gravedad) => {
    setEvaluaciones(prev => {
      const actual = prev[subId] || { prob: 0, imp: 1 };
      return {
        ...prev,
        [subId]: { prob: actual.prob, imp: parseInt(gravedad) }
      };
    });
  };

  const getCategoriaIcon = (catId) => {
    const cat = CATEGORIAS_SENALES.find(c => c.id === catId);
    return cat?.icon || '⚠️';
  };

  const getScoreForSenal = (subId) => {
    const evalSub = evaluaciones[subId] || { prob: 0, imp: 1 };
    return evalSub.prob * evalSub.imp;
  };

  const getSenalStatus = (subId) => {
    const evalSub = evaluaciones[subId];
    if (!evalSub) return 'pendiente';
    if (evalSub.prob === 0) return 'no_presente';
    return 'presente';
  };

  // Estilo de píldora para botones de toggle
  const pillBase = {
    padding: '4px 14px', fontSize: '0.78rem', borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
    background: 'transparent', color: 'var(--txt2)',
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    transition: 'all 0.15s', fontWeight: '500'
  };
  const pillActive = (color) => ({
    ...pillBase,
    background: `${color}22`, borderColor: `${color}44`, color: color
  });
  const pillInactive = { ...pillBase, opacity: 0.4 };

  return (
    <div className="page-transition">
      <div className="card card-sm">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm text-muted">Progreso de evaluación de señales</span>
          <span style={{ fontWeight: 'bold', color: isAllEvaluated ? 'var(--verde)' : 'var(--accent)' }}>
            {evaluatedCount} / {totalFactors}
          </span>
        </div>
        <div style={{ width: '100%', height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${progressPercent}%`, height: '100%', background: isAllEvaluated ? 'var(--verde)' : 'var(--accent)', transition: 'width 0.3s ease', borderRadius: '4px' }} />
        </div>
        {!isAllEvaluated && (
          <p className="text-xs text-muted mt-2">
            Debe evaluar todas las {totalFactors} señales de alerta para continuar.
          </p>
        )}
      </div>

      {FACTORES_SENALES_UAFE.map((factor) => {
        const isExpanded = expandedFactor === factor.id;
        const evaluatedInFactor = factor.subcriterios.filter(sub => evaluaciones[sub.id]).length;
        const totalInFactor = factor.subcriterios.length;
        const presentesInFactor = factor.subcriterios.filter(sub => {
          const e = evaluaciones[sub.id];
          return e && e.prob > 0;
        }).length;

        return (
        <div key={factor.id} className="card" style={{ marginBottom: '12px', cursor: 'pointer' }} onClick={() => setExpandedFactor(isExpanded ? null : factor.id)}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              {isExpanded ? <ChevronUp size={18} color="var(--accent)" /> : <ChevronDown size={18} color="var(--txt2)" />}
              <div>
                <span style={{ fontSize: '1rem', marginRight: '6px' }}>{getCategoriaIcon(factor.id)}</span>
                <span style={{ fontWeight: '600' }}>{factor.nombre}</span>
                <span className="text-xs text-muted" style={{ marginLeft: '8px' }}>
                  ({evaluatedInFactor}/{totalInFactor}
                  {presentesInFactor > 0 && <span style={{ color: 'var(--rojo)', marginLeft: '4px' }}>• {presentesInFactor} detectadas</span>})
                </span>
              </div>
            </div>
            <span className="text-xs text-muted" style={{ background: 'var(--bg-input)', padding: '2px 8px', borderRadius: '10px' }}>
              Peso: {factor.peso}x
            </span>
          </div>
          
          {isExpanded && (
            <div className="mt-4" style={{ paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.04)' }} onClick={(e) => e.stopPropagation()}>
              <p className="text-sm text-muted mb-4">{factor.descripcion}</p>
              
              {factor.subcriterios.map((sub) => {
                const status = getSenalStatus(sub.id);
                const score = getScoreForSenal(sub.id);
                const evalSub = evaluaciones[sub.id] || { prob: 0, imp: 1 };
                const isPresent = status === 'presente';
                
                return (
                  <div key={sub.id} style={{ 
                    marginBottom: '10px', padding: '10px 12px', 
                    background: isPresent ? 'rgba(239, 68, 68, 0.06)' : 'var(--bg-input)', 
                    borderRadius: '6px',
                    border: `1px solid ${isPresent ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.04)'}`,
                    transition: 'all 0.2s'
                  }}>
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex items-start gap-2" style={{ flex: 1 }}>
                        <span className="text-xs text-muted" style={{ fontFamily: 'monospace', minWidth: '38px', paddingTop: '2px' }}>{sub.id}</span>
                        <span className="text-sm" style={{ lineHeight: '1.4' }}>{sub.pregunta}</span>
                      </div>
                      <div className="flex gap-1" style={{ flexShrink: 0 }}>
                        <button
                          style={status === 'no_presente' ? pillActive('var(--verde)') : pillInactive}
                          onClick={() => handleToggleSenal(sub.id, false)}
                        >
                          <XCircle size={11} /> No
                        </button>
                        <button
                          style={status === 'presente' ? pillActive('var(--rojo)') : pillInactive}
                          onClick={() => handleToggleSenal(sub.id, true)}
                        >
                          <AlertTriangle size={11} /> Sí
                        </button>
                      </div>
                    </div>
                    
                    {isPresent && (
                      <div className="mt-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted" style={{ minWidth: '55px' }}>Gravedad:</span>
                          <input
                            type="range"
                            min="1"
                            max="5"
                            value={evalSub.imp}
                            onChange={(e) => handleGravedadChange(sub.id, e.target.value)}
                            style={{ flex: 1, accentColor: 'var(--rojo)' }}
                          />
                          <span style={{ 
                            fontWeight: 'bold', fontSize: '0.85rem', 
                            color: score >= 4 ? 'var(--rojo)' : score >= 2 ? 'var(--naranja)' : 'var(--amarillo)',
                            minWidth: '20px', textAlign: 'center'
                          }}>
                            {evalSub.imp}
                          </span>
                          <span className="text-xs text-muted" style={{ minWidth: '70px' }}>
                            {ESCALA_VALORACION.find(e => e.valor === evalSub.imp)?.etiqueta || ''}
                          </span>
                        </div>
                        <p className="text-xs mt-1" style={{ color: 'var(--rojo)', fontWeight: '500' }}>
                          Score: {score} pts
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        );
      })}

      <div className="card card-sm" style={{ border: '1px dashed rgba(255,255,255,0.1)', marginTop: '4px', marginBottom: '20px' }}>
        <h3 className="text-sm text-muted mb-2">Plantillas rápidas</h3>
        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-secondary btn-sm" onClick={() => applyTemplate('bajo')}>
            Perfil Bajo
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => applyTemplate('estandar')}>
            Perfil Estándar
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => applyTemplate('alto')}>
            <AlertTriangle size={12} /> Perfil Alto
          </button>
        </div>
      </div>

      <div className="flex justify-between">
        <button className="btn btn-secondary" onClick={onPrev}>Paso Anterior</button>
        <button className="btn" onClick={onNext} disabled={!isAllEvaluated}>
          {isAllEvaluated ? 'Siguiente Paso' : `Faltan ${totalFactors - evaluatedCount} señales`}
        </button>
      </div>
    </div>
  );
};
