import React, { useState } from 'react';
import { FACTORES_RIESGO, ESCALA_VALORACION } from '../data/constants';
import { ChevronDown, ChevronUp } from 'lucide-react';

export const Step2Factores = ({ evaluaciones, setEvaluaciones, onNext, onPrev }) => {
  const [expandedFactor, setExpandedFactor] = useState(null);

  const applyTemplate = (profile) => {
    const templates = {
      bajo: { prob: 1, imp: 2 },
      estandar: { prob: 3, imp: 3 },
      alto: { prob: 5, imp: 5 }
    };
    const { prob, imp } = templates[profile];
    
    const newEval = {};
    FACTORES_RIESGO.flatMap(f => f.subcriterios).forEach(sub => {
      newEval[sub.id] = { prob, imp };
    });
    setEvaluaciones(newEval);
  };

  const evaluatedCount = Object.keys(evaluaciones).length;
  const totalFactors = FACTORES_RIESGO.flatMap(f => f.subcriterios).length;
  const isAllEvaluated = evaluatedCount === totalFactors;
  const progressPercent = Math.round((evaluatedCount / totalFactors) * 100);

  const handleSliderChange = (subId, tipo, valor) => {

    setEvaluaciones(prev => {
      const actual = prev[subId] || { prob: 1, imp: 1 };
      return {
        ...prev,
        [subId]: { ...actual, [tipo]: parseInt(valor) }
      };
    });
  };

  const getEtiqueta = (valor) => {
    return ESCALA_VALORACION.find(e => e.valor === parseInt(valor))?.etiqueta || '';
  };

  const getBadgeColor = (p, i) => {
    const r = p * i;
    if (r <= 4) return 'bg-verde';
    if (r <= 9) return 'bg-amarillo';
    if (r <= 14) return 'bg-amarillo'; // Simplified for color badges
    if (r <= 19) return 'bg-naranja';
    return 'bg-rojo';
  };

  return (
    <div>
      <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--txt2)' }}>Progreso de evaluación</span>
          <span style={{ fontWeight: 'bold', color: isAllEvaluated ? 'var(--verde)' : 'var(--accent)' }}>
            {evaluatedCount} / {totalFactors}
          </span>
        </div>
        <div style={{ width: '100%', height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${progressPercent}%`, height: '100%', background: isAllEvaluated ? 'var(--verde)' : 'var(--accent)', transition: 'width 0.3s ease', borderRadius: '4px' }} />
        </div>
        {!isAllEvaluated && (
          <p style={{ fontSize: '0.8rem', color: 'var(--txt2)', marginTop: '8px' }}>
            Debe evaluar todos los {totalFactors} subcriterios para continuar al siguiente paso.
          </p>
        )}
      </div>

      {FACTORES_RIESGO.map((factor, fIndex) => {
        const isExpanded = expandedFactor === factor.id;
        const evaluatedInFactor = factor.subcriterios.filter(sub => evaluaciones[sub.id]).length;
        const totalInFactor = factor.subcriterios.length;

        return (
        <div key={factor.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setExpandedFactor(isExpanded ? null : factor.id)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {isExpanded ? <ChevronUp size={20} color="var(--accent)" /> : <ChevronDown size={20} color="var(--txt2)" />}
              <div>
                <h2 style={{ fontSize: '1.2rem', color: 'var(--accent)' }}>Factor {fIndex + 1}: {factor.nombre}</h2>
                <p style={{ color: 'var(--txt2)', fontSize: '0.85rem', marginTop: '4px' }}>{factor.descripcion}</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                background: evaluatedInFactor === totalInFactor ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-panel)',
                color: evaluatedInFactor === totalInFactor ? 'var(--verde)' : 'var(--txt2)',
                padding: '5px 10px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: '500'
              }}>
                {evaluatedInFactor}/{totalInFactor}
              </span>
              <span style={{ background: 'var(--bg-panel)', padding: '5px 10px', borderRadius: '4px', fontSize: '0.9rem' }}>
                Peso: {factor.peso * 100}%
              </span>
            </div>
          </div>

          {isExpanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            {factor.subcriterios.map(sub => {
              const e = evaluaciones[sub.id] || { prob: 1, imp: 1 };
              const pxI = e.prob * e.imp;

              return (
                <div key={sub.id} style={{ background: 'var(--bg-input)', padding: '15px', borderRadius: '8px' }}>
                  <p style={{ fontWeight: '500', marginBottom: '15px' }}>{sub.pregunta}</p>
                  
                  <div className="grid-2">
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--txt2)' }}>Probabilidad</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{e.prob} - {getEtiqueta(e.prob)}</span>
                      </div>
                      <input 
                        type="range" min="1" max="5" step="1" 
                        value={e.prob}
                        onChange={(ev) => handleSliderChange(sub.id, 'prob', ev.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        title="1: Raro, 5: Casi Certero"
                      />
                    </div>
                    
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--txt2)' }}>Impacto</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{e.imp} - {getEtiqueta(e.imp)}</span>
                      </div>
                      <input 
                        type="range" min="1" max="5" step="1" 
                        value={e.imp}
                        onChange={(ev) => handleSliderChange(sub.id, 'imp', ev.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        title="1: Insignificante, 5: Catastrófico"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                      <span title="Probabilidad x Impacto">Score (P×I):</span>
                      <span className={getBadgeColor(e.prob, e.imp)} style={{ padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', color: 'white' }}>
                        {pxI}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
        );
      })}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={() => applyTemplate('bajo')} style={{ fontSize: '0.7rem' }}>Perfil Bajo</button>
            <button className="btn btn-secondary" onClick={() => applyTemplate('estandar')} style={{ fontSize: '0.7rem' }}>Perfil Estándar</button>
            <button className="btn btn-secondary" onClick={() => applyTemplate('alto')} style={{ fontSize: '0.7rem' }}>Perfil Alto</button>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={onPrev}>Paso Anterior</button>
            <button className="btn" onClick={onNext} disabled={!isAllEvaluated}>Siguiente Paso</button>
          </div>
        </div>

    </div>
  );
};
