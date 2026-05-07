import React, { useState } from 'react';
import { FACTORES_SENALES_UAFE, ESCALA_VALORACION, CATEGORIAS_SENALES } from '../data/constants';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

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

  return (
    <div>
      <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--txt2)' }}>Progreso de evaluación de señales</span>
          <span style={{ fontWeight: 'bold', color: isAllEvaluated ? 'var(--verde)' : 'var(--accent)' }}>
            {evaluatedCount} / {totalFactors}
          </span>
        </div>
        <div style={{ width: '100%', height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${progressPercent}%`, height: '100%', background: isAllEvaluated ? 'var(--verde)' : 'var(--accent)', transition: 'width 0.3s ease', borderRadius: '4px' }} />
        </div>
        {!isAllEvaluated && (
          <p style={{ fontSize: '0.8rem', color: 'var(--txt2)', marginTop: '8px' }}>
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
        <div key={factor.id} className="card" style={{ cursor: 'pointer', marginBottom: '12px' }} onClick={() => setExpandedFactor(isExpanded ? null : factor.id)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {isExpanded ? <ChevronUp size={20} color="var(--accent)" /> : <ChevronDown size={20} color="var(--txt2)" />}
              <div>
                <span style={{ fontSize: '1.1rem', marginRight: '8px' }}>{getCategoriaIcon(factor.id)}</span>
                <span style={{ fontWeight: 'bold' }}>{factor.nombre}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--txt2)', marginLeft: '10px' }}>
                  ({evaluatedInFactor}/{totalInFactor} evaluadas
                  {presentesInFactor > 0 && <span style={{ color: 'var(--rojo)', marginLeft: '6px' }}>• {presentesInFactor} detectadas</span>})
                </span>
              </div>
            </div>
            <span className="badge" style={{ background: 'var(--bg-input)' }}>
              Peso: {factor.peso}x
            </span>
          </div>
          
          {isExpanded && (
            <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.05)' }} onClick={(e) => e.stopPropagation()}>
              <p style={{ fontSize: '0.85rem', color: 'var(--txt2)', marginBottom: '15px' }}>
                {factor.descripcion}
              </p>
              
              {factor.subcriterios.map((sub) => {
                const status = getSenalStatus(sub.id);
                const score = getScoreForSenal(sub.id);
                const evalSub = evaluaciones[sub.id] || { prob: 0, imp: 1 };
                
                return (
                  <div key={sub.id} style={{ 
                    marginBottom: '12px', 
                    padding: '12px', 
                    background: status === 'presente' ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-input)', 
                    borderRadius: '6px',
                    border: status === 'presente' ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid transparent',
                    transition: 'all 0.2s'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--txt2)', fontFamily: 'monospace', minWidth: '40px' }}>
                          {sub.id}
                        </span>
                        <span style={{ fontSize: '0.9rem' }}>{sub.pregunta}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className={`btn ${status === 'no_presente' ? 'btn-secondary' : ''}`}
                          style={{ 
                            padding: '4px 12px', 
                            fontSize: '0.75rem',
                            opacity: status === 'no_presente' ? 1 : 0.5,
                            background: status === 'no_presente' ? 'var(--verde)' : undefined
                          }}
                          onClick={() => handleToggleSenal(sub.id, false)}
                        >
                          <XCircle size={12} /> No
                        </button>
                        <button
                          className={`btn ${status === 'presente' ? '' : 'btn-secondary'}`}
                          style={{ 
                            padding: '4px 12px', 
                            fontSize: '0.75rem',
                            opacity: status === 'presente' ? 1 : 0.5,
                            background: status === 'presente' ? 'var(--rojo)' : undefined
                          }}
                          onClick={() => handleToggleSenal(sub.id, true)}
                        >
                          <AlertTriangle size={12} /> Sí
                        </button>
                      </div>
                    </div>
                    
                    {status === 'presente' && (
                      <div style={{ marginTop: '8px', paddingLeft: '48px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--txt2)', minWidth: '70px' }}>Gravedad:</span>
                          <input
                            type="range"
                            min="1"
                            max="5"
                            value={evalSub.imp}
                            onChange={(e) => handleGravedadChange(sub.id, e.target.value)}
                            style={{ flex: 1, accentColor: 'var(--rojo)' }}
                          />
                          <span style={{ 
                            fontWeight: 'bold', 
                            fontSize: '0.9rem', 
                            color: score >= 4 ? 'var(--rojo)' : score >= 2 ? 'var(--naranja)' : 'var(--amarillo)',
                            minWidth: '30px',
                            textAlign: 'center'
                          }}>
                            {evalSub.imp}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--txt2)', minWidth: '80px' }}>
                            {ESCALA_VALORACION.find(e => e.valor === evalSub.imp)?.etiqueta || ''}
                          </span>
                        </div>
                        <div style={{ marginTop: '4px', fontSize: '0.8rem', color: 'var(--rojo)', fontWeight: '500' }}>
                          Score: {score} pts
                        </div>
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

      <div className="card" style={{ marginTop: '20px', marginBottom: '20px', background: 'var(--bg-input)' }}>
        <h3 style={{ fontSize: '0.9rem', marginBottom: '10px' }}>Plantillas rápidas (evaluar todas las señales)</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => applyTemplate('bajo')}>
            <CheckCircle2 size={14} /> Perfil Bajo Riesgo
          </button>
          <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => applyTemplate('estandar')}>
            Perfil Estándar
          </button>
          <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => applyTemplate('alto')}>
            <AlertTriangle size={14} /> Perfil Alto Riesgo
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
        <button className="btn btn-secondary" onClick={onPrev}>Paso Anterior</button>
        <button className="btn" onClick={onNext} disabled={!isAllEvaluated}>
          {isAllEvaluated ? 'Siguiente Paso' : `Faltan ${totalFactors - evaluatedCount} señales`}
        </button>
      </div>
    </div>
  );
};
