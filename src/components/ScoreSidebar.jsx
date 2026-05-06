import React from 'react';
import { Activity } from 'lucide-react';

export const ScoreSidebar = ({ scores }) => {
  // Función para determinar el color del anillo del gauge (aprox.)
  const getGaugeColor = () => {
    if (scores.inherente <= 8) return 'var(--verde)';
    if (scores.inherente <= 14) return 'var(--amarillo)';
    if (scores.inherente <= 19) return 'var(--naranja)';
    return 'var(--rojo)';
  };

  const percentage = (scores.inherente / 25) * 100;

  return (
    <div className="card" style={{ position: 'sticky', top: '20px' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <Activity size={20} className={scores.colorClass.split(' ')[0]} />
        Score en Tiempo Real
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
        {/* CSS Gauge simple */}
        <div style={{
          position: 'relative', width: '120px', height: '120px', borderRadius: '50%',
          background: `conic-gradient(${getGaugeColor()} ${percentage}%, var(--bg-input) ${percentage}%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            position: 'absolute', width: '100px', height: '100px', borderRadius: '50%',
            background: 'var(--bg-card)', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center'
          }}>
            <span style={{ fontSize: '2rem', fontWeight: 'bold' }}>{scores.inherente}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--txt2)' }}>/ 25 pts</span>
          </div>
        </div>
      </div>

        <div style={{
          padding: '15px', borderRadius: '8px', textAlign: 'center',
          border: '1px solid',
        }} className={`border ${scores.colorClass}`}>

        <p style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '5px' }}>{scores.nivel}</p>
        <p style={{ fontSize: '0.85rem' }}>{scores.diligencia}</p>
      </div>

      {scores.factores && scores.factores.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h4 style={{ fontSize: '0.9rem', color: 'var(--txt2)', marginBottom: '10px' }}>Por Factor:</h4>
          {scores.factores.map(f => (
            <div key={f.id} style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                <span>{f.nombre}</span>
                <span>{f.ponderado} pts</span>
              </div>
              <div style={{ width: '100%', height: '4px', background: 'var(--bg-input)', borderRadius: '2px' }}>
                <div style={{ width: `${(f.promedio/5)*100}%`, height: '100%', background: 'var(--accent)', borderRadius: '2px' }}></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
