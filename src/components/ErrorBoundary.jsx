import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { registrarEvento } from '../utils/observabilidad';

/**
 * Última red de React: sin esto, un error de render deja la pantalla en blanco
 * y el usuario no sabe si sus datos se guardaron. Se registra el error (sin
 * datos del caso) y se ofrece reintentar el árbol o recargar la app.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    registrarEvento({
      nivel: 'error',
      origen: 'react',
      error,
      contexto: {
        etapa: 'render',
        recurso: info?.componentStack
          ? info.componentStack.split('\n')[1]?.trim().slice(0, 120)
          : null
      }
    });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          maxWidth: '640px',
          margin: '60px auto',
          padding: '28px',
          background: 'var(--bg-input)',
          border: '1px solid var(--rojo)',
          borderRadius: '10px',
          textAlign: 'center'
        }}
      >
        <AlertTriangle size={40} color="var(--rojo)" />
        <h1 style={{ fontSize: '1.25rem', margin: '14px 0 8px' }}>
          La aplicación encontró un error inesperado
        </h1>
        <p className="text-sm text-muted" style={{ marginTop: 0 }}>
          El caso que estaba editando puede seguir guardado en este dispositivo.
          Antes de recargar, revise si el último guardado se completó.
        </p>
        <p
          className="text-xs"
          style={{
            background: 'var(--bg-app-2)',
            borderRadius: '6px',
            padding: '10px',
            wordBreak: 'break-word',
            color: 'var(--txt2)'
          }}
        >
          {this.state.error?.message || 'Error desconocido'}
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '18px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => this.setState({ error: null })}
          >
            <RefreshCw size={16} /> Reintentar
          </button>
          <button type="button" className="btn" onClick={() => globalThis.location.reload()}>
            Recargar la aplicación
          </button>
        </div>
      </div>
    );
  }
}
