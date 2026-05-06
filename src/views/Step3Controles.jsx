import React, { useState } from 'react';
import { CONTROLES_INTERNOS } from '../data/constants';
import { ChevronDown, ChevronUp } from 'lucide-react';

export const Step3Controles = ({ controlesEval, setControlesEval, onNext, onPrev }) => {
  const [expandedId, setExpandedId] = useState(null);

  const evaluatedCount = Object.keys(controlesEval).length;
  const totalControls = CONTROLES_INTERNOS.length;
  const isAllEvaluated = evaluatedCount === totalControls;
  const progressPercent = Math.round((evaluatedCount / totalControls) * 100);

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

      <div style={{ marginBottom: '20px', padding: '15px', background: 'var(--bg-input)', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--txt2)' }}>Progreso de evaluación</span>
          <span style={{ fontWeight: 'bold', color: isAllEvaluated ? 'var(--verde)' : 'var(--accent)' }}>
            {evaluatedCount} / {totalControls}
          </span>
        </div>
        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${progressPercent}%`, height: '100%', background: isAllEvaluated ? 'var(--verde)' : 'var(--accent)', transition: 'width 0.3s ease', borderRadius: '4px' }} />
        </div>
        {!isAllEvaluated && (
          <p style={{ fontSize: '0.8rem', color: 'var(--txt2)', marginTop: '8px' }}>
            Debe evaluar los {totalControls} controles internos para continuar.
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {CONTROLES_INTERNOS.map(control => {
          const evalCtrl = controlesEval[control.id] || { existe: false, efectividad: 0 };
          const isExpanded = expandedId === control.id;

          return (
            <div key={control.id} style={{
              background: 'var(--bg-input)', padding: '15px', borderRadius: '8px',
              borderLeft: evalCtrl.existe ? '4px solid var(--accent)' : '4px solid transparent',
              transition: 'all 0.2s',
              cursor: 'pointer'
            }} onClick={() => setExpandedId(isExpanded ? null : control.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: '500', flex: 1 }} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={evalCtrl.existe}
                    onChange={() => handleToggle(control.id)}
                    style={{ transform: 'scale(1.2)' }}
                  />
                  {control.nombre}
                </label>
                {isExpanded ? <ChevronUp size={18} color="var(--accent)" /> : <ChevronDown size={18} color="var(--txt2)" />}
              </div>

              {isExpanded && evalCtrl.existe && (
                <div style={{ marginTop: '15px', paddingLeft: '30px' }} onClick={(e) => e.stopPropagation()}>
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
                    onClick={(e) => e.stopPropagation()}
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
