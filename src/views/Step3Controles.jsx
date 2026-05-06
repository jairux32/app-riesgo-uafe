import React from 'react';
import { CONTROLES_INTERNOS } from '../data/constants';

export const Step3Controles = ({ controlesEval, setControlesEval, onNext, onPrev }) => {
  
  const evaluatedCount = Object.keys(controlesEval).length;
  const totalControls = CONTROLES_INTERNOS.length;
  const isAllEvaluated = evaluatedCount > 0; // Permitir avanzar si evaluó al menos un control

  const handleToggle = (id) => {

    setControlesEval(prev => {
      const exists = prev[id]?.existe || false;
      return {
        ...prev,
        [id]: { ...prev[id], existe: !exists, efectividad: exists ? 0 : (prev[id]?.efectividad || 1) }
      };
    });
  };

  const handleSliderChange = (id, val) => {
    setControlesEval(prev => ({
      ...prev,
      [id]: { ...prev[id], efectividad: parseInt(val) }
    }));
  };

  const getEfectividadLabel = (val) => {
    if (val === 1) return "Baja (1/3)";
    if (val === 2) return "Media (2/3)";
    if (val === 3) return "Alta (3/3)";
    return "";
  };

  return (
    <div className="card">
      <h2 style={{ marginBottom: '10px', color: 'var(--accent)' }}>Paso 3: Evaluación de Controles Internos</h2>
      <p style={{ color: 'var(--txt2)', fontSize: '0.95rem', marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #30363d' }}>
        Evalúe la existencia y efectividad de los controles internos de la notaría. Esto atenuará el Riesgo Inherente para obtener el Riesgo Residual.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {CONTROLES_INTERNOS.map(control => {
          const evalCtrl = controlesEval[control.id] || { existe: false, efectividad: 0 };

          return (
            <div key={control.id} style={{ 
              background: 'var(--bg-input)', padding: '15px', borderRadius: '8px',
              borderLeft: evalCtrl.existe ? '4px solid var(--accent)' : '4px solid transparent',
              transition: 'all 0.2s'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: '500', flex: 1 }}>
                  <input 
                    type="checkbox" 
                    checked={evalCtrl.existe} 
                    onChange={() => handleToggle(control.id)} 
                    style={{ transform: 'scale(1.2)' }}
                  />
                  {control.nombre}
                </label>
              </div>

              {evalCtrl.existe && (
                <div style={{ marginTop: '15px', paddingLeft: '30px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--txt2)' }}>Efectividad del control</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--accent)' }}>
                      {getEfectividadLabel(evalCtrl.efectividad)}
                    </span>
                  </div>
                  <input 
                    type="range" min="1" max="3" step="1" 
                    value={evalCtrl.efectividad || 1} 
                    onChange={(e) => handleSliderChange(control.id, e.target.value)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px' }}>
        <button className="btn btn-secondary" onClick={onPrev}>Paso Anterior</button>
        <button className="btn" onClick={onNext} disabled={!isAllEvaluated}>Finalizar y Analizar</button>
      </div>
    </div>
  );
};
