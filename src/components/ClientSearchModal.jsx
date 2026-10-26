import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, User, MapPin, Mail, FileText, History } from 'lucide-react';
import { searchClients } from '../utils/clientsDB';
import { getAllCases } from '../utils/storage';
import { calculateInherentRisk } from '../utils/calculations';

export const ClientSearchModal = ({ onSelect, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientHistory, setClientHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const debounceRef = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const found = await searchClients(q, 30);
      setResults(found);
    } catch (err) {
      console.error('Error buscando clientes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  const handleSelectClient = async (client) => {
    setSelectedClient(client);
    setLoadingHistory(true);
    try {
      const allCases = await getAllCases();
      const history = allCases.filter(c =>
        c.datos?.cedula === client.identificacion ||
        c.datos?.cliente?.toLowerCase() === client.nombre.toLowerCase()
      );
      setClientHistory(history);
    } catch (err) {
      console.error('Error cargando historial:', err);
      setClientHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleConfirm = () => {
    if (selectedClient) {
      onSelect({
        cliente: selectedClient.nombre,
        cedula: selectedClient.identificacion,
        email: selectedClient.email,
        telefono: selectedClient.telefono,
        direccion: selectedClient.direccion,
      });
      onClose();
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 9999
    }}>
      <div className="card" style={{
        width: '800px', maxWidth: '95%', maxHeight: '90vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column'
      }}>
        <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent)' }}>
            <Search size={22} /> Buscar Cliente en Base de Datos
          </h2>
          <button className="btn-ghost" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <input
            type="text"
            className="input-field"
            placeholder="Buscar por nombre o identificación (mín. 2 caracteres)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            style={{ paddingLeft: '40px', fontSize: '1rem' }}
          />
          <Search size={18} style={{
            position: 'absolute', left: '12px', top: '50%',
            transform: 'translateY(-50%)', color: 'var(--txt2)'
          }} />
        </div>

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', gap: '16px' }}>
          {/* Lista de resultados */}
          <div style={{ flex: selectedClient ? '1' : '1', overflowY: 'auto', maxHeight: '50vh' }}>
            {loading && <p style={{ color: 'var(--txt2)', textAlign: 'center', padding: '20px' }}>Buscando...</p>}

            {!loading && query.length >= 2 && results.length === 0 && (
              <p style={{ color: 'var(--txt2)', textAlign: 'center', padding: '20px' }}>
                No se encontraron clientes con "{query}"
              </p>
            )}

            {!loading && query.length < 2 && (
              <p style={{ color: 'var(--txt2)', textAlign: 'center', padding: '20px' }}>
                Escriba al menos 2 caracteres para buscar
              </p>
            )}

            {results.map((client) => (
              <div
                key={client.id}
                onClick={() => handleSelectClient(client)}
                style={{
                  padding: '12px 16px', cursor: 'pointer', borderRadius: '8px',
                  marginBottom: '4px', border: '1px solid transparent',
                  background: selectedClient?.id === client.id ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-input)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (selectedClient?.id !== client.id) {
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedClient?.id !== client.id) {
                    e.currentTarget.style.borderColor = 'transparent';
                  }
                }}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                      <User size={14} style={{ display: 'inline', marginRight: '6px' }} />
                      {client.nombre}
                    </p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--txt2)', marginTop: '2px' }}>
                      <FileText size={12} style={{ display: 'inline', marginRight: '4px' }} />
                      {client.identificacion}
                      {client.direccion && (
                        <span style={{ marginLeft: '12px' }}>
                          <MapPin size={12} style={{ display: 'inline', marginRight: '4px' }} />
                          {client.direccion}
                        </span>
                      )}
                    </p>
                  </div>
                  {client.email && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--txt2)' }}>
                      <Mail size={12} style={{ display: 'inline' }} />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Panel de detalle + historial */}
          {selectedClient && (
            <div style={{
              width: '320px', flexShrink: 0, overflowY: 'auto',
              maxHeight: '50vh', paddingLeft: '16px',
              borderLeft: '1px solid rgba(255,255,255,0.08)'
            }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '12px', color: 'var(--accent)' }}>
                Datos del Cliente
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                <div style={{ fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--txt2)' }}>Nombre:</span><br />
                  <strong>{selectedClient.nombre}</strong>
                </div>
                <div style={{ fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--txt2)' }}>Identificación:</span><br />
                  <strong>{selectedClient.identificacion}</strong>
                </div>
                {selectedClient.email && (
                  <div style={{ fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--txt2)' }}>Email:</span><br />
                    <strong>{selectedClient.email}</strong>
                  </div>
                )}
                {selectedClient.telefono && (
                  <div style={{ fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--txt2)' }}>Teléfono:</span><br />
                    <strong>{selectedClient.telefono}</strong>
                  </div>
                )}
                {selectedClient.direccion && (
                  <div style={{ fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--txt2)' }}>Dirección:</span><br />
                    <strong>{selectedClient.direccion}</strong>
                  </div>
                )}
              </div>

              <h3 style={{
                fontSize: '0.9rem', marginBottom: '10px', color: 'var(--accent)',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}>
                <History size={16} /> Historial de Análisis
              </h3>

              {loadingHistory && <p style={{ fontSize: '0.8rem', color: 'var(--txt2)' }}>Cargando...</p>}

              {!loadingHistory && clientHistory.length === 0 && (
                <p style={{ fontSize: '0.8rem', color: 'var(--txt2)' }}>
                  No hay análisis previos para este cliente.
                </p>
              )}

              {!loadingHistory && clientHistory.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {clientHistory.map((c) => {
                    const score = c.evaluaciones ? calculateInherentRisk(c.evaluaciones).inherente : 0;
                    const nivel = score <= 8 ? 'BAJO' : score <= 14 ? 'MEDIO' : score <= 19 ? 'MEDIO-ALTO' : 'ALTO';
                    const color = score <= 8 ? 'var(--verde)' : score <= 14 ? 'var(--amarillo)' : score <= 19 ? 'var(--naranja)' : 'var(--rojo)';
                    return (
                      <div key={c.id} style={{
                        padding: '8px 10px', background: 'var(--bg-input)',
                        borderRadius: '6px', fontSize: '0.8rem'
                      }}>
                        <div className="flex justify-between">
                          <span>{c.datos?.acto || 'N/A'}</span>
                          <span style={{ color, fontWeight: 'bold' }}>{score}/25 {nivel}</span>
                        </div>
                        {c.createdAt && (
                          <p style={{ fontSize: '0.7rem', color: 'var(--txt2)', marginTop: '2px' }}>
                            {new Date(c.createdAt).toLocaleDateString('es-EC')}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                className="btn"
                style={{ width: '100%', marginTop: '16px' }}
                onClick={handleConfirm}
              >
                Seleccionar este cliente
              </button>
            </div>
          )}
        </div>

        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--txt2)', textAlign: 'center' }}>
            Base de datos local · 36,981 clientes
          </p>
        </div>
      </div>
    </div>
  );
};
