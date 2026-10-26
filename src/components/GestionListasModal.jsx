import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { X, Upload, Trash2, ExternalLink, ShieldCheck } from 'lucide-react';
import {
  TIPOS_LISTA,
  ETIQUETAS_LISTA,
  getFuenteOficial,
  getEstadoListas,
  importarListaDesdeArchivo,
  eliminarLista
} from '../utils/listasDB';

const formatoFecha = (iso) => (iso ? new Date(iso).toLocaleString('es-EC') : '—');

/**
 * Gestión de snapshots locales de listas restrictivas. El archivo se procesa
 * en el navegador; solo se guardan nombres, versión, fecha y hash.
 */
export const GestionListasModal = ({ onClose, onCambio }) => {
  const [estado, setEstado] = useState({});
  const [cargando, setCargando] = useState({});
  const [versiones, setVersiones] = useState({});
  const inputs = useRef({});

  const refrescar = useCallback(async () => {
    setEstado(await getEstadoListas());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refrescar();
  }, [refrescar]);

  const handleArchivo = async (tipo, archivo) => {
    if (!archivo) return;
    setCargando(prev => ({ ...prev, [tipo]: true }));
    try {
      const meta = await importarListaDesdeArchivo(tipo, archivo, versiones[tipo]);
      toast.success(
        `${ETIQUETAS_LISTA[tipo]}: ${meta.total.toLocaleString('es-EC')} nombres importados`,
        { duration: 5000 }
      );
      await refrescar();
      onCambio?.();
    } catch (err) {
      toast.error(`No se pudo importar la lista: ${err.message}`, { duration: 7000 });
    } finally {
      setCargando(prev => ({ ...prev, [tipo]: false }));
      if (inputs.current[tipo]) inputs.current[tipo].value = '';
    }
  };

  const handleEliminar = async (tipo) => {
    await eliminarLista(tipo);
    await refrescar();
    onCambio?.();
    toast('Lista eliminada', { icon: '🗑️' });
  };

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 9999
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: '760px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center gap-3" style={{ marginBottom: '12px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <ShieldCheck size={20} /> Listas restrictivas
          </h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            <X size={14} /> Cerrar
          </button>
        </div>

        <p className="text-sm text-muted" style={{ marginBottom: '16px' }}>
          Importe el archivo oficial (CSV o JSON) de cada lista. El screening usa exactamente el
          snapshot cargado y registra su versión, fecha y hash en la verificación.
          Sin snapshot, el resultado es <strong>sin verificar</strong>, nunca &ldquo;limpio&rdquo;.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {TIPOS_LISTA.map(tipo => {
            const meta = estado[tipo];
            const fuente = getFuenteOficial(tipo);
            return (
              <div
                key={tipo}
                style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-input)' }}
              >
                <div className="flex justify-between items-center gap-2" style={{ flexWrap: 'wrap' }}>
                  <strong>{ETIQUETAS_LISTA[tipo]}</strong>
                  {fuente && (
                    <a
                      href={fuente}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs"
                      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      Fuente oficial <ExternalLink size={12} />
                    </a>
                  )}
                </div>

                {meta ? (
                  <p className="text-xs text-muted" style={{ margin: '6px 0 10px' }}>
                    {meta.total.toLocaleString('es-EC')} nombres · {meta.version} · {formatoFecha(meta.fecha)}
                    {meta.hash ? ` · hash ${meta.hash.slice(0, 16)}` : ''}
                  </p>
                ) : (
                  <p className="text-xs" style={{ margin: '6px 0 10px', color: 'var(--txt2)' }}>
                    Sin snapshot cargado.
                  </p>
                )}

                <div className="grid-2">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Versión / nombre del archivo</label>
                    <input
                      type="text"
                      className="input-field"
                      value={versiones[tipo] || ''}
                      onChange={(e) => setVersiones(prev => ({ ...prev, [tipo]: e.target.value }))}
                      placeholder="Ej: OFAC SDN 2026-10-26"
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Archivo CSV o JSON</label>
                    <div className="flex items-center gap-2">
                      <input
                        ref={(el) => { inputs.current[tipo] = el; }}
                        type="file"
                        accept=".csv,.json,text/csv,application/json"
                        className="input-field"
                        disabled={cargando[tipo]}
                        onChange={(e) => handleArchivo(tipo, e.target.files?.[0])}
                      />
                      {meta && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleEliminar(tipo)}
                          title="Eliminar snapshot"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {cargando[tipo] && (
                  <p className="text-xs text-muted" style={{ marginTop: '8px', marginBottom: 0 }}>
                    <Upload size={12} /> Procesando archivo...
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted" style={{ marginTop: '14px', marginBottom: 0 }}>
          Los snapshots se guardan solo en este navegador (IndexedDB). Actualícelos periódicamente
          y deje constancia de la versión usada en cada verificación.
        </p>
      </div>
    </div>
  );
};
