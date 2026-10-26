import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { GraduationCap, Plus, Trash2, Paperclip, AlertTriangle, Download, ShieldCheck } from 'lucide-react';
import {
  MODALIDADES_CAPACITACION,
  crearRegistroCapacitacion,
  crearEvidenciaCapacitacion,
  validarRegistroCapacitacion,
  evaluarVigenciaCapacitacion,
  etiquetaModalidad,
  normalizarParticipantes
} from '../utils/capacitacion';
import { verificarIntegridad } from '../utils/evidencias';
import { getEstadoCumplimientoStyle } from '../utils/cumplimiento';
import {
  eliminarArchivoEvidencia,
  guardarArchivoEvidencia,
  obtenerArchivoEvidencia
} from '../utils/evidenciasDB';

const FORM_INICIAL = {
  tema: '',
  fecha: '',
  horas: '',
  modalidad: 'presencial',
  facilitador: '',
  participantes: ''
};

/**
 * Registro detallado de la capacitación anual: cada jornada queda con tema,
 * fecha, horas, participantes, facilitador, responsable y el hash del
 * certificado o lista de asistencia. El archivo se guarda solo en el
 * dispositivo; en el perfil queda el hash.
 */
export const CapacitacionPanel = ({ registros = [], onChange, responsable = '' }) => {
  const inputRef = useRef(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [archivo, setArchivo] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [verificando, setVerificando] = useState(null);

  const resumen = evaluarVigenciaCapacitacion(registros);
  const estilo = getEstadoCumplimientoStyle(resumen.estado);
  const ordenados = [...(registros || [])].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setForm(FORM_INICIAL);
    setArchivo(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleAgregar = async () => {
    const base = crearRegistroCapacitacion({ ...form, responsable });
    const validacion = validarRegistroCapacitacion(base);
    if (!validacion.valida) {
      toast.error(`Complete: ${validacion.faltantes.join(', ')}`);
      return;
    }

    setGuardando(true);
    try {
      const evidencia = archivo ? await crearEvidenciaCapacitacion(archivo) : null;
      let registro = crearRegistroCapacitacion({ ...form, responsable, evidencia });

      if (archivo) {
        try {
          await guardarArchivoEvidencia(registro.id, archivo);
        } catch {
          // Si el archivo no se pudo guardar, no se registra un hash que no se
          // pueda verificar después.
          registro = crearRegistroCapacitacion({ ...form, responsable, evidencia: null });
          toast.error('No se pudo guardar el archivo en este dispositivo; se registrará sin evidencia.');
        }
      }

      onChange([...(registros || []), registro]);
      resetForm();
      toast.success('Capacitación registrada');
    } catch (err) {
      toast.error('No se pudo registrar la capacitación: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleDescargar = async (registro) => {
    try {
      const blob = await obtenerArchivoEvidencia(registro.id);
      if (!blob) {
        toast.error('El archivo no está disponible en este dispositivo.');
        return;
      }
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = registro.evidencia?.nombre || 'certificado';
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('No se pudo descargar: ' + err.message);
    }
  };

  const handleVerificar = async (registro) => {
    setVerificando(registro.id);
    try {
      const blob = await obtenerArchivoEvidencia(registro.id);
      if (!blob) {
        toast.error('El archivo no está disponible en este dispositivo: no se puede verificar.');
        return;
      }
      const resultado = await verificarIntegridad(blob, registro.evidencia?.hash);
      if (resultado.integra) {
        toast.success('Integridad verificada: el certificado coincide con el hash registrado.');
      } else {
        toast.error('ALERTA: el archivo no coincide con el hash registrado. No use este documento.');
      }
    } catch (err) {
      toast.error('No se pudo verificar: ' + err.message);
    } finally {
      setVerificando(null);
    }
  };

  const handleEliminar = async (registro) => {
    const confirmado = globalThis.confirm?.(
      `¿Eliminar la capacitación "${registro.tema}"? Esta acción no se puede deshacer.`
    );
    if (!confirmado) return;

    try {
      await eliminarArchivoEvidencia(registro.id);
    } catch {
      // El metadato se elimina igual; el archivo huérfano no afecta al perfil.
    }
    onChange((registros || []).filter(item => item.id !== registro.id));
    toast.success('Capacitación eliminada');
  };

  return (
    <div style={{ marginTop: '25px', padding: '20px', background: 'var(--bg-input)', borderRadius: '8px' }}>
      <h3 style={{ fontSize: '1rem', color: 'var(--accent)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <GraduationCap size={18} /> Capacitación anual del personal
      </h3>
      <p className="text-sm text-muted" style={{ marginTop: 0 }}>
        Registre cada jornada de capacitación. El certificado o la lista de asistencia se identifica con su
        hash SHA-256 y permanece en este dispositivo. Si ya usó el campo simple de fecha, el sistema toma la
        fecha más reciente de ambos.
      </p>

      <div className="grid-2">
        <div className="form-group">
          <label>Tema *</label>
          <input
            type="text"
            className="input-field"
            name="tema"
            value={form.tema}
            onChange={handleChange}
            placeholder="Ej: Señales de alerta en operaciones notariales"
          />
        </div>
        <div className="form-group">
          <label>Fecha *</label>
          <input type="date" className="input-field" name="fecha" value={form.fecha} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Horas *</label>
          <input
            type="number"
            className="input-field"
            name="horas"
            value={form.horas}
            onChange={handleChange}
            min="0"
            step="0.5"
          />
        </div>
        <div className="form-group">
          <label>Modalidad</label>
          <select className="input-field" name="modalidad" value={form.modalidad} onChange={handleChange}>
            {MODALIDADES_CAPACITACION.map(opcion => (
              <option key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Facilitador</label>
          <input
            type="text"
            className="input-field"
            name="facilitador"
            value={form.facilitador}
            onChange={handleChange}
            placeholder="Nombre o institución"
          />
        </div>
        <div className="form-group">
          <label>Certificado o lista de asistencia</label>
          <input
            ref={inputRef}
            type="file"
            className="input-field"
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
            onChange={(e) => setArchivo(e.target.files?.[0] || null)}
          />
        </div>
      </div>

      <div className="form-group">
        <label>Participantes *</label>
        <textarea
          className="input-field"
          name="participantes"
          value={form.participantes}
          onChange={handleChange}
          rows="2"
          placeholder="Un nombre por línea o separados por coma"
        />
        <span className="text-xs text-muted">
          {normalizarParticipantes(form.participantes).length} participante(s) detectado(s).
        </span>
      </div>

      <div className="flex items-center gap-2" style={{ flexWrap: 'wrap', marginBottom: '14px' }}>
        <button type="button" className="btn" onClick={handleAgregar} disabled={guardando}>
          <Plus size={14} /> {guardando ? 'Guardando...' : 'Agregar capacitación'}
        </button>
        <span className="text-xs text-muted">
          Responsable del registro: {responsable || 'defina el Oficial de Cumplimiento en el perfil'}.
        </span>
      </div>

      {ordenados.length === 0 ? (
        <p className="text-sm text-muted" style={{ margin: 0 }}>
          <Paperclip size={14} /> Aún no hay capacitaciones registradas.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {ordenados.map(registro => {
            const participantes = normalizarParticipantes(registro.participantes);
            return (
              <div
                key={registro.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  gap: '10px',
                  alignItems: 'center',
                  padding: '10px',
                  borderRadius: '6px',
                  background: 'var(--bg-app-2)'
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p className="text-sm" style={{ margin: 0, fontWeight: 600 }}>
                    {registro.tema}
                    {' · '}{registro.fecha}
                  </p>
                  <p className="text-xs text-muted" style={{ margin: '3px 0 0' }}>
                    {Number(registro.horas) || 0} h · {etiquetaModalidad(registro.modalidad)}
                    {registro.facilitador ? ` · ${registro.facilitador}` : ''}
                    {' · '}{participantes.length} participante(s)
                    {registro.responsable ? ` · registró ${registro.responsable}` : ''}
                  </p>
                  {registro.evidencia ? (
                    <p className="text-xs" style={{ margin: '3px 0 0', wordBreak: 'break-all', color: 'var(--txt2)' }}>
                      {registro.evidencia.nombre} — SHA-256 {registro.evidencia.hash}
                    </p>
                  ) : (
                    <p className="text-xs" style={{ margin: '3px 0 0', color: 'var(--naranja, #f97316)' }}>
                      Sin evidencia adjunta.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {registro.evidencia && (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        title="Verificar integridad"
                        disabled={verificando === registro.id}
                        onClick={() => handleVerificar(registro)}
                      >
                        <ShieldCheck size={12} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        title="Descargar"
                        onClick={() => handleDescargar(registro)}
                      >
                        <Download size={12} />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    title="Eliminar"
                    onClick={() => handleEliminar(registro)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
        <p className="text-sm" style={{ margin: 0, color: estilo.color, fontWeight: 600 }}>
          Capacitación anual: {estilo.etiqueta}
          {resumen.vence ? ` · vigencia hasta ${resumen.vence}` : ''}
        </p>
        <p className="text-xs text-muted" style={{ margin: '4px 0 0' }}>
          {resumen.horasUltimos12Meses} h registradas en los últimos 12 meses
          {' '}(referencia interna: {resumen.horasMinimas} h).
          {resumen.programadas > 0 ? ` ${resumen.programadas} jornada(s) futura(s) no cuentan todavía.` : ''}
        </p>
        {resumen.cumpleHoras === false && (
          <p className="text-xs" style={{ margin: '6px 0 0', color: 'var(--naranja, #f97316)' }}>
            <AlertTriangle size={12} /> Las horas registradas están por debajo de la referencia interna.
            Es una alerta, no un bloqueo.
          </p>
        )}
      </div>
    </div>
  );
};
