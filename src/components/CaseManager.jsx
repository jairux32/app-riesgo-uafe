import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Save, FolderOpen, Trash2, X, PlayCircle, Search, AlertTriangle, ShieldCheck, Shield } from 'lucide-react';
import { getAllCases, saveCase, deleteCase } from '../utils/storage';
import { calculateInherentRisk } from '../utils/calculations';

export const CaseManager = ({ currentCase, onLoadCase, onBatchAnalyze, batchProgress }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [cases, setCases] = useState([]);
  const [filteredCases, setFilteredCases] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) loadHistory();
  }, [isOpen]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredCases(cases);
      return;
    }
    const term = searchTerm.toLowerCase();
    const filtered = cases.filter(c =>
      (c.datos?.cliente || '').toLowerCase().includes(term) ||
      (c.datos?.cedula || '').toLowerCase().includes(term) ||
      (c.datos?.acto || '').toLowerCase().includes(term)
    );
    setFilteredCases(filtered);
  }, [searchTerm, cases]);

  const loadHistory = async () => {
    const data = await getAllCases();
    const sorted = data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setCases(sorted);
    setFilteredCases(sorted);
  };

  const getRiskInfo = (evaluaciones) => {
    if (!evaluaciones || Object.keys(evaluaciones).length === 0) {
      return { score: 0, label: 'Sin evaluar', color: 'var(--txt2)', bg: 'var(--bg-panel)' };
    }
    const result = calculateInherentRisk(evaluaciones);
    const score = result.inherente;
    if (score <= 8) return { score, label: 'Bajo', color: 'var(--verde)', bg: 'rgba(16, 185, 129, 0.15)' };
    if (score <= 14) return { score, label: 'Medio', color: 'var(--amarillo)', bg: 'rgba(245, 158, 11, 0.15)' };
    if (score <= 19) return { score, label: 'Medio-Alto', color: 'var(--naranja)', bg: 'rgba(249, 115, 22, 0.15)' };
    return { score, label: 'Alto', color: 'var(--rojo)', bg: 'rgba(239, 68, 68, 0.15)' };
  };

  const toggleSelection = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredCases.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCases.map(c => c.id));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveCase(currentCase);
      await loadHistory();
      toast.success('Caso guardado en la nube');
    } catch (err) {
      toast.error('Error al guardar el caso');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (window.confirm('¿Eliminar este caso del historial?')) {
      await deleteCase(id);
      await loadHistory();
      toast.success('Caso eliminado');
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
          background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '20px'
        }}>
          <div className="card" style={{ width: '900px', maxWidth: '100%', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexShrink: 0 }}>
              <div>
                <h2 style={{ fontSize: '1.3rem' }}>Historial de Casos</h2>
                <p style={{ color: 'var(--txt2)', fontSize: '0.85rem', marginTop: '4px' }}>
                  {cases.length} casos en total
                </p>
              </div>
              <button className="btn btn-secondary" onClick={() => setIsOpen(false)}><X size={20} /></button>
            </div>

            {/* Search & Actions */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexShrink: 0 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--txt2)' }} />
                <input
                  type="text"
                  placeholder="Buscar por cliente, cédula o acto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px 10px 36px', background: 'var(--bg-input)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--txt)',
                    outline: 'none', fontSize: '0.9rem'
                  }}
                />
              </div>
              <button className="btn" onClick={handleSave} disabled={isSaving} style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                <Save size={16} /> {isSaving ? 'Guardando...' : 'Guardar Caso Actual'}
              </button>
              <button
                className="btn"
                onClick={() => { onBatchAnalyze(selectedIds); setIsOpen(false); }}
                disabled={selectedIds.length === 0 || batchProgress.active}
                style={{ background: 'var(--verde)', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
              >
                <PlayCircle size={16} /> {batchProgress.active ? 'Analizando...' : `Analizar ${selectedIds.length}`}
              </button>
            </div>

            {/* Batch progress */}
            {batchProgress.active && (
              <div style={{ marginBottom: '15px', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '5px' }}>
                  <span>Progreso del análisis por lotes:</span>
                  <span>{batchProgress.current} / {batchProgress.total}</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${(batchProgress.current / batchProgress.total) * 100}%`,
                    height: '100%', background: 'var(--accent)', transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            )}

            {/* Table */}
            <div style={{ overflowY: 'auto', flex: 1, borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              {filteredCases.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--txt2)' }}>
                  {searchTerm ? 'No se encontraron casos con ese criterio.' : 'No hay casos guardados.'}
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-panel)', zIndex: 1 }}>
                    <tr>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)', width: '40px' }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.length === filteredCases.length && filteredCases.length > 0}
                          onChange={handleSelectAll}
                          style={{ transform: 'scale(1.2)' }}
                        />
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Cliente</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Cédula</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Acto</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Riesgo</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Fecha</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCases.map(c => {
                      const risk = getRiskInfo(c.evaluaciones);
                      return (
                        <tr
                          key={c.id}
                          onClick={() => { onLoadCase(c); setIsOpen(false); }}
                          style={{
                            cursor: 'pointer',
                            background: selectedIds.includes(c.id) ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => { if (!selectedIds.includes(c.id)) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                          onMouseLeave={(e) => { if (!selectedIds.includes(c.id)) e.currentTarget.style.background = 'transparent'; }}
                        >
                          <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(c.id)}
                              onChange={(e) => { e.stopPropagation(); toggleSelection(c.id); }}
                              style={{ transform: 'scale(1.2)' }}
                            />
                          </td>
                          <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: '500' }}>
                            {c.datos?.cliente || 'Sin nombre'}
                          </td>
                          <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--txt2)', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                            {c.datos?.cedula || '—'}
                          </td>
                          <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--txt2)' }}>
                            {c.datos?.acto || '—'}
                          </td>
                          <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '600',
                              background: risk.bg, color: risk.color, whiteSpace: 'nowrap'
                            }}>
                              {risk.score > 0 ? (
                                <>
                                  {risk.label === 'Alto' ? <AlertTriangle size={12} /> : <ShieldCheck size={12} />}
                                  {risk.label} ({risk.score})
                                </>
                              ) : (
                                <><Shield size={12} /> Sin evaluar</>
                              )}
                            </span>
                          </td>
                          <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--txt2)', fontSize: '0.85rem' }}>
                            {new Date(c.createdAt).toLocaleDateString('es-EC')}
                          </td>
                          <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <button
                              className="btn btn-secondary"
                              onClick={(e) => handleDelete(c.id, e)}
                              style={{ padding: '6px', color: 'var(--rojo)', minWidth: 'auto' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
