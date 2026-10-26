import { Plus, Trash2, UserCheck, AlertTriangle } from 'lucide-react';
import { evaluarCadenaPropiedad } from '../utils/beneficiarioFinal';

/**
 * Tabla editable de la cadena de propiedad. Cada fila representa un nivel:
 * el porcentaje que ese propietario tiene sobre el nivel inmediatamente
 * inferior. La participación efectiva se calcula multiplicando los niveles.
 */
export const CadenaPropiedad = ({
  cadena = [],
  onChange,
  onAgregar,
  onEliminar,
  onUsarBeneficiario
}) => {
  const evaluacion = evaluarCadenaPropiedad(cadena);

  return (
    <div style={{ marginTop: '14px', padding: '12px 14px', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
      <div className="flex justify-between items-center gap-2" style={{ flexWrap: 'wrap' }}>
        <div>
          <h4 className="text-sm text-muted" style={{ margin: 0 }}>Cadena de propiedad (art. 92)</h4>
          <p className="text-xs text-muted" style={{ margin: '4px 0 0' }}>
            Cada nivel declara el % que posee sobre el nivel anterior. La participación efectiva es el producto de los porcentajes.
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onAgregar}>
          <Plus size={12} /> Agregar nivel
        </button>
      </div>

      {cadena.length === 0 ? (
        <p className="text-xs text-muted" style={{ marginTop: '10px', marginBottom: 0 }}>
          Sin cadena declarada. Puede registrar el beneficiario final directamente o reconstruir la cadena para calcular su participación.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
          {evaluacion.niveles.map((nivel, indice) => (
            <div
              key={indice}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(140px, 1.4fr) minmax(110px, 1fr) minmax(90px, 0.8fr) minmax(70px, 0.6fr) minmax(70px, 0.6fr) auto',
                gap: '8px',
                alignItems: 'end',
                padding: '10px',
                borderRadius: '6px',
                background: 'var(--bg-input)'
              }}
            >
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="text-xs">Nombre o razón social</label>
                <input
                  type="text"
                  className="input-field"
                  value={nivel.nombre || ''}
                  onChange={(e) => onChange(indice, 'nombre', e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="text-xs">Identificación</label>
                <input
                  type="text"
                  className="input-field"
                  value={nivel.identificacion || ''}
                  onChange={(e) => onChange(indice, 'identificacion', e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="text-xs">Tipo</label>
                <select
                  className="input-field"
                  value={nivel.tipo || 'natural'}
                  onChange={(e) => onChange(indice, 'tipo', e.target.value)}
                >
                  <option value="natural">Persona natural</option>
                  <option value="juridica">Persona jurídica</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="text-xs">% del nivel inferior</label>
                <input
                  type="number"
                  className="input-field"
                  min="0.01"
                  max="100"
                  step="0.01"
                  value={nivel.porcentaje ?? ''}
                  onChange={(e) => onChange(indice, 'porcentaje', e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="text-xs">Efectiva</label>
                <div
                  className="input-field"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontWeight: '600',
                    color: nivel.participacionEfectiva !== null && nivel.participacionEfectiva >= evaluacion.umbral
                      ? 'var(--verde)'
                      : 'var(--txt2)'
                  }}
                >
                  {nivel.participacionEfectiva === null ? '—' : `${nivel.participacionEfectiva}%`}
                </div>
              </div>
              <div className="flex items-center gap-1" style={{ paddingBottom: '2px' }}>
                {nivel.tipo === 'natural' && nivel.participacionEfectiva !== null && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    title="Usar como beneficiario final"
                    onClick={() => onUsarBeneficiario(nivel)}
                  >
                    <UserCheck size={12} />
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  title="Eliminar nivel"
                  onClick={() => onEliminar(indice)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {cadena.length > 0 && (
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {evaluacion.incompletos.length > 0 && (
            <p className="text-xs" style={{ margin: 0, color: 'var(--naranja, #f97316)' }}>
              <AlertTriangle size={12} /> Complete nombre, identificación y porcentaje de cada nivel.
            </p>
          )}
          {evaluacion.totalDirecto > 100 && (
            <p className="text-xs" style={{ margin: 0, color: 'var(--rojo)' }}>
              <AlertTriangle size={12} /> La participación directa supera el 100%.
            </p>
          )}
          {!evaluacion.alcanzaUmbral && evaluacion.incompletos.length === 0 && (
            <p className="text-xs" style={{ margin: 0, color: 'var(--naranja, #f97316)' }}>
              <AlertTriangle size={12} /> Ningún propietario alcanza el 10%: identifique al gerente de mayor rango como beneficiario final.
            </p>
          )}
          {evaluacion.beneficiarios.length > 0 && (
            <p className="text-xs" style={{ margin: 0, color: 'var(--verde)' }}>
              Beneficiario(s) final(es) por participación ≥ {evaluacion.umbral}%:{' '}
              {evaluacion.beneficiarios.map(b => `${b.nombre} (${b.participacionEfectiva}%)`).join(' · ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
