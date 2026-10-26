import { useState } from 'react';
import toast from 'react-hot-toast';
import { HardDrive, Trash2, Search, AlertTriangle } from 'lucide-react';
import {
  purgarEvidenciasHuerfanas,
  describirPurga,
  DIAS_GRACIA_PURGA
} from '../utils/purgaEvidencias';
import { formatearTamano } from '../utils/evidencias';
import { getUserCases } from '../firebase/firestore';
import { getPendingCases } from '../utils/offlineSync';

/**
 * Mantenimiento del almacenamiento local. Analiza qué archivos de evidencia
 * quedaron sin referencia (caso borrado, evidencia retirada) y permite
 * eliminarlos. Nunca borra en el primer clic: primero muestra la vista previa.
 */
export const MantenimientoEvidencias = ({ userId, perfil }) => {
  const [analisis, setAnalisis] = useState(null);
  const [trabajando, setTrabajando] = useState(false);

  const cargarReferencias = async () => {
    const [casos, pendientes] = await Promise.all([
      getUserCases(userId).catch(() => []),
      getPendingCases(userId).catch(() => [])
    ]);
    return { casos: casos || [], casosPendientes: pendientes || [] };
  };

  const handleAnalizar = async () => {
    setTrabajando(true);
    try {
      const referencias = await cargarReferencias();
      const resultado = await purgarEvidenciasHuerfanas({
        ...referencias,
        perfil: perfil || {},
        confirmar: false
      });
      setAnalisis(resultado);
      if (resultado.error) toast.error(resultado.error);
    } catch (err) {
      toast.error('No se pudo analizar el almacenamiento: ' + err.message);
    } finally {
      setTrabajando(false);
    }
  };

  const handlePurgar = async () => {
    const total = analisis?.huerfanas?.length || 0;
    if (total === 0) return;

    const confirmado = globalThis.confirm?.(
      `Se eliminarán ${total} archivo(s) de evidencia de este dispositivo. `
      + 'Los casos conservan el hash SHA-256, pero el archivo ya no podrá verificarse. '
      + 'Esta acción no se puede deshacer.'
    );
    if (!confirmado) return;

    setTrabajando(true);
    try {
      const referencias = await cargarReferencias();
      const resultado = await purgarEvidenciasHuerfanas({
        ...referencias,
        perfil: perfil || {},
        confirmar: true
      });
      setAnalisis(resultado);
      if (resultado.fallidas?.length > 0) toast.error(describirPurga(resultado));
      else toast.success(describirPurga(resultado));
    } catch (err) {
      toast.error('No se pudo completar la purga: ' + err.message);
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <div style={{ marginTop: '25px', padding: '20px', background: 'var(--bg-input)', borderRadius: '8px' }}>
      <h3 style={{ fontSize: '1rem', color: 'var(--accent)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <HardDrive size={18} /> Almacenamiento local de evidencias
      </h3>
      <p className="text-sm text-muted" style={{ marginTop: 0 }}>
        Los archivos de evidencia y los certificados de capacitación se guardan solo en este dispositivo.
        Si un caso se elimina o se retira una evidencia, el archivo puede quedar huérfano. El análisis no
        borra nada: primero muestra qué archivos ya no están referenciados.
      </p>

      <div className="flex items-center gap-2" style={{ flexWrap: 'wrap', marginBottom: '12px' }}>
        <button type="button" className="btn btn-secondary" onClick={handleAnalizar} disabled={trabajando}>
          <Search size={14} /> {trabajando ? 'Analizando...' : 'Analizar almacenamiento'}
        </button>
        {analisis?.huerfanas?.length > 0 && (
          <button type="button" className="btn" onClick={handlePurgar} disabled={trabajando}>
            <Trash2 size={14} /> Eliminar {analisis.huerfanas.length} archivo(s)
          </button>
        )}
      </div>

      {analisis && (
        <div>
          <p className="text-sm" style={{ margin: '0 0 8px', color: 'var(--txt2)' }}>
            {describirPurga(analisis)}
          </p>

          {analisis.huerfanas?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {analisis.huerfanas.slice(0, 8).map(item => (
                <div
                  key={item.id}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: 'var(--bg-app-2)',
                    borderLeft: '3px solid var(--naranja, #f97316)'
                  }}
                >
                  <p className="text-xs" style={{ margin: 0, wordBreak: 'break-all' }}>
                    {item.id} · {formatearTamano(item.tamano)}
                    {item.diasSinUso !== null ? ` · ${item.diasSinUso} día(s) sin uso` : ' · sin fecha de guardado'}
                  </p>
                </div>
              ))}
              {analisis.huerfanas.length > 8 && (
                <p className="text-xs text-muted" style={{ margin: 0, textAlign: 'center' }}>
                  +{analisis.huerfanas.length - 8} archivo(s) más.
                </p>
              )}
            </div>
          )}

          {analisis.enGracia?.length > 0 && (
            <p className="text-xs text-muted" style={{ margin: '8px 0 0' }}>
              <AlertTriangle size={12} /> {analisis.enGracia.length} archivo(s) se conservan por estar
              dentro del periodo de gracia de {DIAS_GRACIA_PURGA} días: podrían pertenecer a un caso
              que aún no se ha guardado.
            </p>
          )}

          <p className="text-xs text-muted" style={{ margin: '8px 0 0' }}>
            Archivos revisados: {analisis.revisadas} · referencias activas: {analisis.referenciadas}.
            Los casos conservan el hash SHA-256 aunque se borre el archivo.
          </p>
        </div>
      )}
    </div>
  );
};
