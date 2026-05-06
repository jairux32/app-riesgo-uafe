import React from 'react';
import { Check, Circle } from 'lucide-react';

const steps = [
  { id: 1, name: 'Datos Generales' },
  { id: 2, name: 'Evaluación de Riesgo' },
  { id: 3, name: 'Controles Internos' },
  { id: 4, name: 'Análisis y Exportación' },
];

export const WizardHeader = ({ currentStep, setStep }) => {
  return (
    <div className="card" style={{ marginBottom: '30px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
        {/* Liena de fondo conectora */}
        <div style={{
          position: 'absolute', top: '15px', left: '10%', right: '10%', height: '2px',
          background: 'var(--bg-input)', zIndex: 0
        }}></div>

        {steps.map((step) => {
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;

          return (
            <div key={step.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, width: '25%' }}>
              <div 
                onClick={() => setStep(step.id)}
                style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isActive || isCompleted ? 'var(--accent)' : 'var(--bg-panel)',
                  color: 'white',
                  cursor: 'pointer',
                  border: `2px solid ${isActive || isCompleted ? 'var(--accent)' : '#30363d'}`,
                  transition: 'all 0.3s ease'
                }}
              >
                {isCompleted ? <Check size={16} /> : <span>{step.id}</span>}
              </div>
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
