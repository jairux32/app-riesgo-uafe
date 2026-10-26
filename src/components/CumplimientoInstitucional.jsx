import { ShieldCheck, ShieldAlert } from 'lucide-react';
import {
  evaluarCumplimientoInstitucional,
  getEstadoCumplimientoStyle,
  describirVencimiento
} from '../utils/cumplimiento';

/**
 * Estado del cumplimiento institucional de la notaría. No bloquea nada:
 * muestra qué requisitos están registrados, vencidos o por vencer.
 */
export const CumplimientoInstitucional = ({ perfil, compacto = false }) => {
  const resultado = evaluarCumplimientoInstitucional(perfil || {});
  const Icono = resultado.requiereAtencion ? ShieldAlert : ShieldCheck;
  const color = resultado.requiereAtencion ? 'var(--naranja, #f97316)' : 'var(--verde)';

  if (compacto) {
    if (!resultado.requiereAtencion) return null;

    return (
      <div
        className="card"
        style={{ borderLeft: `3px solid ${color}`, display: 'flex', alignItems: 'center', gap: '10px' }}
      >
        <Icono size={20} color={color} />
        <div>
          <strong style={{ fontSize: '0.9rem' }}>Cumplimiento institucional</strong>
          <p className="text-sm text-muted" style={{ margin: 0 }}>
            {resultado.pendientes.length} requisito(s) pendiente(s)
            {resultado.vencidos.length > 0 ? `, ${resultado.vencidos.length} vencido(s)` : ''}.
            {' '}Revise el perfil de la notaría.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '25px', padding: '20px', background: 'var(--bg-input)', borderRadius: '8px' }}>
      <h3 style={{ fontSize: '1rem', color, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Icono size={18} /> Estado del cumplimiento institucional
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {resultado.items.map(item => {
          const estilo = getEstadoCumplimientoStyle(item.estado);
          return (
            <div
              key={item.clave}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap',
                padding: '8px 10px',
                borderRadius: '6px',
                background: 'var(--bg-app-2)'
              }}
            >
              <div>
                <span style={{ fontSize: '0.9rem' }}>{item.etiqueta}</span>
                <span className="text-xs text-muted" style={{ display: 'block' }}>
                  {describirVencimiento(item)} · {item.fundamento}
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: estilo.color }}>
                {estilo.etiqueta}
              </span>
            </div>
          );
        })}
      </div>

      {resultado.requiereAtencion ? (
        <p className="text-xs" style={{ color: 'var(--naranja, #f97316)', marginTop: '12px', marginBottom: 0 }}>
          Complete o actualice los requisitos marcados. El sistema no bloquea operaciones por estos datos,
          pero un supervisor puede solicitarlos en cualquier momento.
        </p>
      ) : (
        <p className="text-xs" style={{ color: 'var(--verde)', marginTop: '12px', marginBottom: 0 }}>
          Todos los requisitos institucionales están registrados y vigentes.
        </p>
      )}
    </div>
  );
};
