import { useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarClock, Save } from 'lucide-react';
import { calcularObligaciones, combinarReportes, estadoVencimiento, ESTADOS_REPORTE } from '../utils/obligaciones';
import { updateCase } from '../utils/storage';

const ETIQUETAS_ESTADO = {
  pendiente: 'Pendiente',
  preparado: 'Preparado',
  enviado: 'Enviado',
  acuse_recibido: 'Acuse recibido',
  no_aplica: 'No aplica',
};

const ETIQUETAS_TONO = {
  vencida: 'var(--rojo)',
  vence_hoy: 'var(--rojo)',
  por_vencer: 'var(--naranja, #f97316)',
  vigente: 'var(--verde)',
  sin_fecha: 'var(--txt2)',
};

const ESTADOS_COMPLETADOS = ['enviado', 'acuse_recibido', 'no_aplica'];

/**
 * Seguimiento de las obligaciones de reporte ante SISLAFT (ROS/NO-ROS y
 * RESU/NO-RESU). Calcula plazos sugeridos y permite registrar estado,
 * responsable, fecha de envío y acuse. El usuario puede ajustar las fechas.
 */
export const ObligacionesPanel = ({ datos, setDatos, scores, analysisResult, caseId }) => {
  const [guardando, setGuardando] = useState(false);

  const sugerencias = calcularObligaciones(datos, {
    scoreInherente: scores?.inherente,
    analisis: analysisResult,
    // Una vez registrado el conocimiento, el plazo del ROS no debe moverse.
    fechaConocimiento: datos.reportes?.ros?.fechaConocimiento
  });
  const reportes = combinarReportes(sugerencias, datos.reportes);

  const actualizar = (clave, cambios) => {
    setDatos(prev => ({
      ...prev,
      reportes: {
        ...(prev.reportes || {}),
        [clave]: {
          ...(prev.reportes?.[clave] || sugerencias[clave]),
          // Congela la fecha de conocimiento del ROS en cuanto el usuario
          // registra seguimiento, para que el plazo no se desplace cada día.
          ...(clave === 'ros' && !prev.reportes?.ros?.fechaConocimiento
            ? { fechaConocimiento: new Date().toISOString().slice(0, 10) }
            : {}),
          ...cambios
        }
      }
    }));
  };

  const guardar = async () => {
    if (!caseId || String(caseId).startsWith('pending_')) {
      toast.error('Guarde el caso antes de registrar el seguimiento de reportes.');
      return;
    }

    setGuardando(true);
    const reportesAGuardar = {
      ...reportes,
      ros: {
        ...reportes.ros,
        fechaConocimiento: reportes.ros.fechaConocimiento
          || new Date().toISOString().slice(0, 10)
      }
    };
    const ok = await updateCase(caseId, { reportes: reportesAGuardar });
    setGuardando(false);

    if (ok) toast.success('Seguimiento de reportes guardado');
  };

  return (
    <div className="card">
      <h3 style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <CalendarClock size={20} /> Obligaciones de reporte (SISLAFT)
      </h3>
      <p className="text-sm text-muted" style={{ marginBottom: '14px' }}>
        Plazos calculados según la operación y el dictamen. Ajuste las fechas si el conocimiento del caso ocurrió en otra fecha.
      </p>

      <div className="grid-2">
        {['resu', 'ros'].map((clave) => {
          const reporte = reportes[clave];
          const vencimiento = estadoVencimiento(reporte.fechaLimite);
          const completado = ESTADOS_COMPLETADOS.includes(reporte.estado);
          const color = completado ? 'var(--verde)' : ETIQUETAS_TONO[vencimiento.estado];

          return (
            <div
              key={clave}
              style={{
                padding: '14px',
                borderRadius: '8px',
                background: 'var(--bg-input)',
                border: `1px solid ${color}40`,
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div className="flex justify-between items-center gap-2">
                <strong style={{ fontSize: '1rem' }}>{reporte.tipo}</strong>
                <span className="text-xs" style={{ color, fontWeight: '600' }}>
                  {completado ? ETIQUETAS_ESTADO[reporte.estado] : vencimiento.etiqueta}
                </span>
              </div>

              <p className="text-xs text-muted" style={{ margin: 0 }}>
                {reporte.descripcion}
              </p>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Estado</label>
                <select
                  className="input-field"
                  value={reporte.estado}
                  onChange={(e) => actualizar(clave, { estado: e.target.value })}
                >
                  {ESTADOS_REPORTE.map(estado => (
                    <option key={estado} value={estado}>{ETIQUETAS_ESTADO[estado]}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Responsable</label>
                <input
                  type="text"
                  className="input-field"
                  value={reporte.responsable || ''}
                  onChange={(e) => actualizar(clave, { responsable: e.target.value })}
                />
              </div>

              <div className="grid-2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Fecha límite</label>
                  <input
                    type="date"
                    className="input-field"
                    value={reporte.fechaLimite || ''}
                    onChange={(e) => actualizar(clave, {
                      fechaLimite: e.target.value,
                      fechaLimiteManual: true
                    })}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Fecha de envío</label>
                  <input
                    type="date"
                    className="input-field"
                    value={reporte.fechaEnvio || ''}
                    onChange={(e) => actualizar(clave, { fechaEnvio: e.target.value })}
                  />
                </div>
              </div>

              {reporte.fechaLimiteProrroga && (
                <p className="text-xs text-muted" style={{ margin: 0 }}>
                  Prórroga máxima: {reporte.fechaLimiteProrroga}
                </p>
              )}

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Número de acuse / referencia SISLAFT</label>
                <input
                  type="text"
                  className="input-field"
                  value={reporte.acuse || ''}
                  onChange={(e) => actualizar(clave, { acuse: e.target.value })}
                  placeholder="Opcional"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Notas</label>
                <textarea
                  className="input-field"
                  rows="2"
                  value={reporte.notas || ''}
                  onChange={(e) => actualizar(clave, { notas: e.target.value })}
                  placeholder="Observaciones del reporte..."
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between items-center gap-3 mt-4" style={{ flexWrap: 'wrap' }}>
        <p className="text-xs text-muted" style={{ margin: 0 }}>
          La reserva del ROS (art. 62) impide revelar su existencia al cliente.
        </p>
        <button className="btn" onClick={guardar} disabled={guardando}>
          <Save size={16} /> {guardando ? 'Guardando...' : 'Guardar seguimiento'}
        </button>
      </div>
    </div>
  );
};
