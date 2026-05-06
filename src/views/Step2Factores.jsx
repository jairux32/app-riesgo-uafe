import React from 'react';
import { FACTORES_RIESGO, ESCALA_VALORACION } from '../data/constants';
import { Info } from 'lucide-react';

export const Step2Factores = ({ evaluaciones, setEvaluaciones, onNext, onPrev }) => {
  
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
  const isAllEvaluated = evaluatedCount > 0; // Permitir avanzar si al menos evaluó un factor

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
      {FACTORES_RIESGO.map((factor, fIndex) => (
        <div key={factor.id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #30363d', paddingBottom: '10px', marginBottom: '15px' }}>
            <h2 style={{ fontSize: '1.2rem', color: 'var(--accent)' }}>Factor {fIndex + 1}: {factor.nombre}</h2>
            <span style={{ background: 'var(--bg-panel)', padding: '5px 10px', borderRadius: '4px', fontSize: '0.9rem' }}>
              Peso: {factor.peso * 100}%
            </span>
          </div>
          <p style={{ color: 'var(--txt2)', fontSize: '0.95rem', marginBottom: '20px' }}>{factor.descripcion}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
        </div>
      ))}

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
