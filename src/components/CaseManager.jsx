import React, { useState, useEffect } from 'react';
import { Save, FolderOpen, Trash2, X, PlayCircle } from 'lucide-react';
import { getAllCases, saveCase, deleteCase } from '../utils/storage';

export const CaseManager = ({ currentCase, onLoadCase, onBatchAnalyze, batchProgress }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [cases, setCases] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const data = await getAllCases();
    setCases(data);
  };

  const toggleSelection = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveCase(currentCase);
      await loadHistory();
      alert('Caso guardado exitosamente en el historial local');
    } catch (err) {
      alert('Error al guardar el caso');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (window.confirm('¿Eliminar este caso del historial?')) {
      await deleteCase(id);
      await loadHistory();
    }
  };

  return (
    <>
      <button className="btn btn-secondary" onClick={() => setIsOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <FolderOpen size={16} /> Historial
      </button>

      {isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="card" style={{ width: '600px', maxWidth: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>Historial de Casos</h2>
              <button className="btn btn-secondary" onClick={() => setIsOpen(false)}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button 
                className="btn" 
                onClick={handleSave} 
                disabled={isSaving} 
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Save size={16} /> {isSaving ? 'Guardando...' : 'Guardar Caso Actual'}
              </button>
              <button 
                className="btn" 
                onClick={() => { onBatchAnalyze(selectedIds); setIsOpen(false); }} 
                disabled={selectedIds.length === 0 || batchProgress.active}
                style={{ background: 'var(--verde)', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <PlayCircle size={16} /> {batchProgress.active ? 'Analizando...' : `Analizar ${selectedIds.length} Casos`}
              </button>
            </div>

            {batchProgress.active && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '5px' }}>
                  <span>Progreso del análisis por lotes:</span>
                  <span>{batchProgress.current} / {batchProgress.total}</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${(batchProgress.current / batchProgress.total) * 100}%`, 
                    height: '100%', 
                    background: 'var(--accent)', 
                    transition: 'width 0.3s ease' 
                  }} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {cases.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--txt2)', padding: '20px' }}>No hay casos guardados localmente.</p>
              ) : (
                cases.map(c => (
                  <div 
                    key={c.id} 
                    onClick={() => { onLoadCase(c); setIsOpen(false); }}
                    style={{ 
                      padding: '15px', background: 'var(--bg-input)', borderRadius: '8px', 
                      cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      border: selectedIds.includes(c.id) ? '2px solid var(--accent)' : '1px solid transparent',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(c.id)} 
                        onChange={(e) => { e.stopPropagation(); toggleSelection(c.id); }}
                        style={{ transform: 'scale(1.2)' }}
                      />
                      <div>
                        <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>{c.datos.cliente || 'Sin nombre'}</p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--txt2)' }}>
                          {c.datos.acto} | {new Date(c.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button 
                      className="btn btn-secondary" 
                      onClick={(e) => handleDelete(c.id, e)}
                      style={{ padding: '5px', color: 'var(--rojo)' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
