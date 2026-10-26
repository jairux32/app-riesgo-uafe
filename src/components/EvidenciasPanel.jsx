import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Paperclip,
  Upload,
  Trash2,
  ShieldCheck,
  Download,
  AlertTriangle,
  FileText
} from 'lucide-react';
import {
  TIPOS_EVIDENCIA,
  crearRegistroEvidencia,
  resumenEvidencias,
  formatearTamano,
  etiquetaTipoEvidencia,
  verificarIntegridad
} from '../utils/evidencias';
import {
  guardarArchivoEvidencia,
  obtenerArchivoEvidencia,
  eliminarArchivoEvidencia
} from '../utils/evidenciasDB';

/**
 * Expediente documental del caso. El archivo queda en IndexedDB y el caso
 * guarda solo el hash SHA-256 y los metadatos.
 */
export const EvidenciasPanel = ({ evidencias = [], onChange, tipoPersona = 'natural' }) => {
  const inputRef = useRef(null);
  const [tipo, setTipo] = useState('identificacion');
  const [descripcion, setDescripcion] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [verificando, setVerificando] = useState(null);

  const resumen = resumenEvidencias(evidencias, { tipoPersona });

  const handleFiles = async (event) => {
    const archivos = Array.from(event.target.files || []);
    event.target.value = '';
    if (archivos.length === 0) return;

    setSubiendo(true);
    const nuevos = [];
    const fallidos = [];

    for (const archivo of archivos) {
      try {
        if (!archivo.size) {
          fallidos.push(archivo.name);
          continue;
        }
        const registro = await crearRegistroEvidencia(archivo, { tipo, descripcion });
        await guardarArchivoEvidencia(registro.id, archivo);
        nuevos.push(registro);
      } catch (err) {
        fallidos.push(`${archivo.name} (${err.message})`);
      }
    }

    if (nuevos.length > 0) {
      onChange([...(evidencias || []), ...nuevos]);
      setDescripcion('');
      toast.success(`${nuevos.length} evidencia(s) registrada(s) con hash SHA-256`);
    }
    if (fallidos.length > 0) {
      toast.error(`No se pudo registrar: ${fallidos.join(', ')}`);
    }
    setSubiendo(false);
  };

  const handleEliminar = async (evidencia) => {
    const confirmado = globalThis.confirm?.(
      `¿Eliminar la evidencia "${evidencia.nombre}"? Esta acción no se puede deshacer.`
    );
    if (!confirmado) return;

    try {
      await eliminarArchivoEvidencia(evidencia.id);
    } catch {
      // El metadato se elimina igual; el blob huérfano no afecta al expediente.
    }
    onChange((evidencias || []).filter(e => e.id !== evidencia.id));
    toast.success('Evidencia eliminada');
  };

  const handleDescargar = async (evidencia) => {
    try {
      const blob = await obtenerArchivoEvidencia(evidencia.id);
      if (!blob) {
        toast.error('El archivo no está disponible en este dispositivo.');
        return;
      }
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = evidencia.nombre || 'documento';
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('No se pudo descargar: ' + err.message);
    }
  };

  const handleVerificar = async (evidencia) => {
    setVerificando(evidencia.id);
    try {
      const blob = await obtenerArchivoEvidencia(evidencia.id);
      if (!blob) {
        toast.error('El archivo no está disponible en este dispositivo: no se puede verificar.');
        return;
      }
      const resultado = await verificarIntegridad(blob, evidencia.hash);
      if (resultado.integra) {
        toast.success('Integridad verificada: el archivo coincide con el hash registrado.');
      } else {
        toast.error('ALERTA: el archivo no coincide con el hash registrado. No use este documento.');
      }
    } catch (err) {
      toast.error('No se pudo verificar: ' + err.message);
    } finally {
      setVerificando(null);
    }
  };

  return (
    <div>
      <div className="grid-2">
        <div className="form-group">
          <label>Tipo de documento</label>
          <select className="input-field" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS_EVIDENCIA.map(opcion => (
              <option key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Descripción (opcional)</label>
          <input
            type="text"
            className="input-field"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej: cédula anverso y reverso"
          />
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleFiles}
      />

      <div className="flex items-center gap-2" style={{ flexWrap: 'wrap', marginBottom: '12px' }}>
        <button
          type="button"
          className="btn"
          disabled={subiendo}
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={14} /> {subiendo ? 'Calculando hash...' : 'Adjuntar evidencia'}
        </button>
        <span className="text-xs text-muted">
          El archivo se guarda en este dispositivo. En el caso solo se registra su hash SHA-256.
        </span>
      </div>

      {evidencias.length === 0 ? (
        <p className="text-sm text-muted" style={{ margin: 0 }}>
          <Paperclip size={14} /> Aún no hay documentos adjuntos.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {evidencias.map(evidencia => (
            <div
              key={evidencia.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                gap: '10px',
                alignItems: 'center',
                padding: '10px',
                borderRadius: '6px',
                background: 'var(--bg-input)'
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p className="text-sm" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={14} />
                  <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {evidencia.nombre}
                  </strong>
                </p>
                <p className="text-xs text-muted" style={{ margin: '3px 0 0' }}>
                  {etiquetaTipoEvidencia(evidencia.tipo)}
                  {evidencia.descripcion ? ` · ${evidencia.descripcion}` : ''}
                  {' · '}{formatearTamano(evidencia.tamano)}
                  {evidencia.cargadaEn
                    ? ` · ${new Date(evidencia.cargadaEn).toLocaleString('es-EC')}`
                    : ''}
                </p>
                <p className="text-xs" style={{ margin: '3px 0 0', wordBreak: 'break-all', color: 'var(--txt2)' }}>
                  SHA-256: {evidencia.hash}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  title="Verificar integridad"
                  disabled={verificando === evidencia.id}
                  onClick={() => handleVerificar(evidencia)}
                >
                  <ShieldCheck size={12} />
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  title="Descargar"
                  onClick={() => handleDescargar(evidencia)}
                >
                  <Download size={12} />
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  title="Eliminar"
                  onClick={() => handleEliminar(evidencia)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {evidencias.length > 0 && resumen.faltantes.length > 0 && (
        <p className="text-xs mt-2" style={{ margin: '10px 0 0', color: 'var(--naranja, #f97316)' }}>
          <AlertTriangle size={12} /> Evidencias mínimas faltantes:{' '}
          {resumen.faltantes.map(etiquetaTipoEvidencia).join(', ')}.
        </p>
      )}

      {resumen.invalidas.length > 0 && (
        <p className="text-xs mt-1" style={{ margin: '6px 0 0', color: 'var(--rojo)' }}>
          <AlertTriangle size={12} /> Hay {resumen.invalidas.length} registro(s) con datos incompletos.
        </p>
      )}
    </div>
  );
};
