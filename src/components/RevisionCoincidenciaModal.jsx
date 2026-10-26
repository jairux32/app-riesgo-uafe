import { useState } from 'react';
import toast from 'react-hot-toast';
import { X, ShieldAlert, Save } from 'lucide-react';
import {
  DECISIONES_REVISION,
  ETIQUETAS_LISTA,
  validarRevision
} from '../utils/revisionCoincidencias';

const hoy = () => new Date().toISOString().slice(0, 10);

/**
 * Ficha de descarte o confirmación de una coincidencia en listas. No decide
 * por el usuario: exige responsable, fecha y justificación trazable.
 */
export const RevisionCoincidenciaModal = ({ tipo, verificacion, perfil, onSave, onClose }) => {
  const [revision, setRevision] = useState({
    decision: verificacion?.revision?.decision || '',
    revisor: verificacion?.revision?.revisor || perfil?.oficialCumplimiento || '',
    fecha: verificacion?.revision?.fecha || hoy(),
    justificacion: verificacion?.revision?.justificacion || ''
  });

  const handleChange = (campo, valor) => {
    setRevision(prev => ({ ...prev, [campo]: valor }));
  };

  const handleGuardar = () => {
    const { valida, faltantes } = validarRevision(revision);
    if (!valida) {
      toast.error(`Complete la ficha: ${faltantes.join('; ')}.`);
      return;
    }
    onSave({
      ...revision,
      revisor: revision.revisor.trim(),
      justificacion: revision.justificacion.trim(),
      registradaEn: new Date().toISOString()
    });
  };

  const coincidencias = verificacion?.coincidencias || [];

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 9999, padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: '720px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center gap-3" style={{ marginBottom: '12px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <ShieldAlert size={20} /> Revisión de coincidencia — {ETIQUETAS_LISTA[tipo] || tipo.toUpperCase()}
          </h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            <X size={14} /> Cerrar
          </button>
        </div>

        <p className="text-sm text-muted" style={{ marginBottom: '12px' }}>
          El sistema no descarta coincidencias automáticamente. Documente quién revisó,
          con qué fundamento y qué decisión tomó.
        </p>

        {coincidencias.length > 0 && (
          <div style={{ marginBottom: '14px', padding: '10px', background: 'var(--bg-input)', borderRadius: '6px' }}>
            <p className="text-xs text-muted" style={{ marginTop: 0, marginBottom: '6px' }}>
              Coincidencias detectadas (mayor confianza primero):
            </p>
            <ul className="text-sm" style={{ margin: 0, paddingLeft: '18px' }}>
              {coincidencias.slice(0, 5).map((c, i) => (
                <li key={i}>
                  {c.nombre} — {c.confianza}%
                  {c.tipo ? ` (${c.tipo})` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid-2">
          <div className="form-group">
            <label>Decisión</label>
            <select
              className="input-field"
              value={revision.decision}
              onChange={(e) => handleChange('decision', e.target.value)}
            >
              <option value="">Seleccione...</option>
              {DECISIONES_REVISION.map(d => (
                <option key={d.valor} value={d.valor}>{d.etiqueta}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Responsable de la revisión</label>
            <input
              type="text"
              className="input-field"
              value={revision.revisor}
              onChange={(e) => handleChange('revisor', e.target.value)}
              placeholder="Nombre del oficial de cumplimiento"
            />
          </div>
          <div className="form-group">
            <label>Fecha de la revisión</label>
            <input
              type="date"
              className="input-field"
              value={revision.fecha}
              onChange={(e) => handleChange('fecha', e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Justificación y evidencia consultada</label>
          <textarea
            className="input-field"
            rows="5"
            value={revision.justificacion}
            onChange={(e) => handleChange('justificacion', e.target.value)}
            placeholder="Ej: Se comparó la cédula, fecha de nacimiento y nacionalidad; la coincidencia corresponde a otra persona homónima. Se adjunta copia del documento de identidad."
          />
          <p className="text-xs text-muted" style={{ marginTop: '4px', marginBottom: 0 }}>
            Mínimo 20 caracteres. Indique qué datos contrastó y dónde consta la evidencia.
          </p>
        </div>

        <div className="flex justify-end gap-2" style={{ marginTop: '12px' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={handleGuardar}>
            <Save size={14} /> Guardar revisión
          </button>
        </div>
      </div>
    </div>
  );
};
