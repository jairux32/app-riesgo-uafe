import { Gauge, AlertTriangle, FileText, Bot, Clock, TrendingUp } from 'lucide-react';
import {
  calcularCalidadModelo,
  casosParaRevisar,
  describirCalidad,
  NIVELES_RIESGO
} from '../utils/calidadModelo';

const COLORES_NIVEL = {
  bajo: 'var(--verde)',
  medio: 'var(--amarillo, #f59e0b)',
  medio_alto: 'var(--naranja, #f97316)',
  alto: 'var(--rojo)'
};

const Tarjeta = ({ valor, etiqueta, icono: Icono, color }) => (
  <div style={{ padding: '14px', background: 'var(--bg-input)', borderRadius: '8px', borderLeft: `3px solid ${color}` }}>
    <Icono size={18} color={color} />
    <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '6px 0 0' }}>{valor}</p>
    <p className="text-xs text-muted" style={{ margin: 0 }}>{etiqueta}</p>
  </div>
);

/**
 * Tablero de calidad del modelo. No presenta tasas de falsos positivos o
 * negativos como si fueran verdades: muestra coincidencias sospechosas entre
 * el score y la decisión de reporte, y deja la revisión en manos del notario.
 */
export const CalidadModeloPanel = ({ casos = [], onAbrirCaso }) => {
  const metricas = calcularCalidadModelo(casos);
  const revision = casosParaRevisar(metricas);
  const resumen = describirCalidad(metricas);

  return (
    <div className="card">
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', color: 'var(--accent)' }}>
        <Gauge size={20} /> Calidad del modelo y calibración
      </h3>
      <p className="text-sm text-muted" style={{ marginTop: 0 }}>
        El tablero cruza el score con la decisión de reporte. No calcula falsos positivos ni negativos
        reales porque no hay una verdad de referencia etiquetada: señala casos para revisión humana.
      </p>

      <div className="grid-2" style={{ marginBottom: '18px' }}>
        <Tarjeta valor={metricas.casosEvaluados} etiqueta="Casos evaluados" icono={TrendingUp} color="var(--accent)" />
        <Tarjeta valor={`${metricas.promedioScore}/25`} etiqueta="Score promedio" icono={Gauge} color="var(--verde)" />
        <Tarjeta
          valor={metricas.calibracion.posiblesSubestimaciones.length}
          etiqueta="Posibles subestimaciones"
          icono={AlertTriangle}
          color="var(--rojo)"
        />
        <Tarjeta
          valor={metricas.calibracion.posiblesSobreestimaciones.length}
          etiqueta="Posibles sobreestimaciones"
          icono={AlertTriangle}
          color="var(--naranja, #f97316)"
        />
        <Tarjeta
          valor={metricas.tiempos.promedioDias === null ? '—' : `${metricas.tiempos.promedioDias} d`}
          etiqueta={`Tiempo medio de cierre (${metricas.tiempos.muestra} caso(s))`}
          icono={Clock}
          color="var(--accent)"
        />
        <Tarjeta
          valor={`${metricas.coberturaIA}%`}
          etiqueta={`Cobertura de dictamen IA (${metricas.conAnalisisIA})`}
          icono={Bot}
          color="var(--azul, #3b82f6)"
        />
      </div>

      <p className="text-sm" style={{ margin: '0 0 18px', color: 'var(--txt2)' }}>
        {resumen}
      </p>

      <div className="grid-2" style={{ marginBottom: '18px' }}>
        <div>
          <h4 style={{ fontSize: '0.9rem', marginBottom: '10px' }}>Distribución de riesgo</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {metricas.distribucion.map(nivel => (
              <div key={nivel.id}>
                <div className="flex justify-between text-xs" style={{ marginBottom: '3px' }}>
                  <span>{nivel.etiqueta}</span>
                  <span className="text-muted">{nivel.count} ({nivel.porcentaje}%)</span>
                </div>
                <div style={{ height: '6px', background: 'var(--bg-app-2)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${nivel.porcentaje}%`,
                      height: '100%',
                      background: COLORES_NIVEL[nivel.id]
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: '0.9rem', marginBottom: '10px' }}>Reportes y versiones</h4>
          <ul className="text-sm" style={{ margin: 0, paddingLeft: '18px', color: 'var(--txt2)' }}>
            <li>ROS enviados: {metricas.reportes.rosEnviados}</li>
            <li>NO-ROS enviados: {metricas.reportes.noRosEnviados}</li>
            <li>ROS vencidos o por vencer hoy: {metricas.reportes.rosVencidos}</li>
          </ul>

          {metricas.versiones.length > 0 ? (
            <div style={{ marginTop: '10px' }}>
              <p className="text-xs text-muted" style={{ margin: '0 0 4px' }}>Versiones del dictamen:</p>
              {metricas.versiones.slice(0, 4).map(item => (
                <p key={item.version} className="text-xs" style={{ margin: '2px 0', color: 'var(--txt2)' }}>
                  {item.version} — {item.count} caso(s)
                </p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted" style={{ marginTop: '10px' }}>
              Sin dictámenes de IA guardados todavía.
            </p>
          )}
        </div>
      </div>

      {metricas.alertas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '18px' }}>
          {metricas.alertas.map(alerta => (
            <div
              key={alerta.tipo}
              style={{
                padding: '8px 10px',
                borderRadius: '6px',
                borderLeft: `3px solid ${alerta.severidad === 'alta' ? 'var(--rojo)' : 'var(--naranja, #f97316)'}`,
                background: 'var(--bg-input)'
              }}
            >
              <p className="text-sm" style={{ margin: 0 }}>{alerta.mensaje}</p>
            </div>
          ))}
        </div>
      )}

      {revision.length > 0 && (
        <div>
          <h4 style={{ fontSize: '0.9rem', marginBottom: '10px' }}>
            Casos para revisar ({revision.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {revision.slice(0, 8).map(item => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px',
                  borderRadius: '6px',
                  background: 'var(--bg-input)',
                  borderLeft: `3px solid ${item.severidad === 'alta' ? 'var(--rojo)' : 'var(--naranja, #f97316)'}`
                }}
              >
                <div style={{ flex: 1 }}>
                  <p className="text-sm" style={{ margin: 0, fontWeight: 600 }}>
                    {item.cliente} · {item.score}/25
                  </p>
                  <p className="text-xs text-muted" style={{ margin: '3px 0 0' }}>
                    {item.motivo}
                  </p>
                </div>
                {onAbrirCaso && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                    title="Revisar caso"
                    onClick={() => onAbrirCaso(item.id, 4)}
                  >
                    <FileText size={14} />
                  </button>
                )}
              </div>
            ))}
            {revision.length > 8 && (
              <p className="text-xs text-muted" style={{ textAlign: 'center', margin: 0 }}>
                +{revision.length - 8} caso(s) más para revisar.
              </p>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-muted" style={{ marginTop: '14px', marginBottom: 0 }}>
        Umbrales de referencia: {NIVELES_RIESGO.map(n => `${n.etiqueta} ${n.min}-${n.max}`).join(' · ')}.
        El tiempo de cierre se aproxima con la última actualización del caso.
      </p>
    </div>
  );
};
