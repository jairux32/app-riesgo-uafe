import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Check } from 'lucide-react';

const steps = [
  {
    id: 1,
    name: 'Datos Generales',
    ayuda: 'Capture los datos del cliente y de la operación.'
  },
  {
    id: 2,
    name: 'Evaluación de Riesgo',
    ayuda: 'Revise las 56 señales de alerta de la UAFE.'
  },
  {
    id: 3,
    name: 'Controles Internos',
    ayuda: 'Evalúe las 10 medidas de control de la notaría.'
  },
  {
    id: 4,
    name: 'Análisis y Exportación',
    ayuda: 'Genere el dictamen y exporte el reporte que corresponda.'
  }
];

export const WizardHeader = ({ currentStep, setStep }) => {
  // El check original marcaba como "completado" cualquier paso anterior al
  // actual, incluso si el usuario se había saltado pasos. Ahora el visto bueno
  // refleja únicamente los pasos por los que realmente pasó.
  const [pasoPrevio, setPasoPrevio] = useState(currentStep);
  const [visitados, setVisitados] = useState(() => new Set([currentStep]));

  if (pasoPrevio !== currentStep) {
    setPasoPrevio(currentStep);
    setVisitados(prev => (prev.has(currentStep) ? prev : new Set([...prev, currentStep])));
  }

  const pasoActual = steps.find(s => s.id === currentStep) || steps[0];

  const irAlPaso = (id) => {
    if (id === currentStep) return;

    // Salta más de un paso: no se bloquea (el usuario puede revisar lo que
    // quiera), pero se advierte de que el dictamen usará lo capturado hasta
    // ahora.
    if (id > currentStep + 1) {
      const omitidos = steps
        .filter(s => s.id > currentStep && s.id < id)
        .map(s => s.name);
      toast(
        `Va al paso ${id} sin pasar por "${omitidos.join('" ni "')}". ` +
        'El dictamen usará solo la información capturada hasta ahora.',
        { icon: 'ℹ️', duration: 5000 }
      );
    }

    setStep(id);
  };

  return (
    <div className="card" style={{ marginBottom: '30px' }}>
      <div style={{ marginBottom: '18px' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--txt2)', margin: '0 0 2px' }}>
          Paso {pasoActual.id} de {steps.length}
        </p>
        <p style={{ fontSize: '1.05rem', fontWeight: '600', margin: '0 0 4px' }}>
          {pasoActual.name}
        </p>
        <p style={{ fontSize: '0.85rem', color: 'var(--txt2)', margin: 0 }}>
          {pasoActual.ayuda}
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
        {/* Liena de fondo conectora */}
        <div style={{
          position: 'absolute', top: '15px', left: '10%', right: '10%', height: '2px',
          background: 'rgba(255,255,255,0.15)', zIndex: 0
        }}></div>

        {steps.map((step) => {
          const isActive = step.id === currentStep;
          const isVisited = visitados.has(step.id);

          return (
            <div key={step.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, width: '25%' }}>
              <button
                type="button"
                onClick={() => irAlPaso(step.id)}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`${step.name}${isActive ? ', paso actual' : ''}`}
                style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isActive || isVisited ? 'var(--accent)' : 'var(--bg-panel)',
                  color: 'white',
                  cursor: 'pointer',
                  border: `2px solid ${isActive || isVisited ? 'var(--accent)' : '#30363d'}`,
                  transition: 'all 0.3s ease'
                }}
              >
                {isVisited && !isActive ? <Check size={16} /> : <span>{step.id}</span>}
              </button>
              <span style={{
                marginTop: '10px', fontSize: '0.85rem', fontWeight: isActive ? '600' : '400',
                color: isActive ? 'var(--txt)' : 'var(--txt2)',
                textAlign: 'center'
              }}>
                {step.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
