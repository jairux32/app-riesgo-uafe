import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Save, FolderOpen, Trash2, X, PlayCircle, Search, AlertTriangle, ShieldCheck, Shield, Download, GitCompare, History } from 'lucide-react';
import { getAllCases, saveCase, deleteCase } from '../utils/storage';
import { exportMultipleToExcel } from '../utils/exportUtils';
import { calculateInherentRisk } from '../utils/calculations';
import { ESTADOS_CASO, TAGS_PREDEFINIDOS } from '../data/constants';

export const CaseManager = ({ currentCase, onLoadCase, onBatchAnalyze, batchProgress }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [cases, setCases] = useState([]);
  const [filteredCases, setFilteredCases] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [auditCase, setAuditCase] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [advancedFilters, setAdvancedFilters] = useState({
    fechaDesde: '',
    fechaHasta: '',
    scoreMin: '',
    scoreMax: '',
    esPep: false,
    apoderado: false,
    ofac: false,
    estado: '',
    tag: '',
    sortBy: 'fecha',
    sortOrder: 'desc'
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (isOpen) loadHistory();
  }, [isOpen]);

  useEffect(() => {
    let filtered = cases;
    
    // Filtro de búsqueda por texto
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        (c.datos?.cliente || '').toLowerCase().includes(term) ||
        (c.datos?.cedula || '').toLowerCase().includes(term) ||
        (c.datos?.acto || '').toLowerCase().includes(term)
      );
    }
    
    // Filtros avanzados
    if (advancedFilters.fechaDesde) {
      const desde = new Date(advancedFilters.fechaDesde);
      filtered = filtered.filter(c => new Date(c.createdAt) >= desde);
    }
    if (advancedFilters.fechaHasta) {
      const hasta = new Date(advancedFilters.fechaHasta);
      hasta.setHours(23, 59, 59);
      filtered = filtered.filter(c => new Date(c.createdAt) <= hasta);
    }
    if (advancedFilters.scoreMin) {
      filtered = filtered.filter(c => {
        const score = c.evaluaciones ? calculateInherentRisk(c.evaluaciones).inherente : 0;
        return score >= parseInt(advancedFilters.scoreMin);
      });
    }
    if (advancedFilters.scoreMax) {
      filtered = filtered.filter(c => {
        const score = c.evaluaciones ? calculateInherentRisk(c.evaluaciones).inherente : 0;
        return score <= parseInt(advancedFilters.scoreMax);
      });
    }
    if (advancedFilters.esPep) {
      filtered = filtered.filter(c => c.datos?.esPep);
    }
    if (advancedFilters.apoderado) {
      filtered = filtered.filter(c => c.datos?.apoderado);
    }
    if (advancedFilters.ofac) {
      filtered = filtered.filter(c => c.datos?.ofac);
    }
    if (advancedFilters.estado) {
      filtered = filtered.filter(c => (c.datos?.estado || 'borrador') === advancedFilters.estado);
    }
    if (advancedFilters.tag) {
      filtered = filtered.filter(c => (c.datos?.tags || []).includes(advancedFilters.tag));
    }

    // Ordenamiento
    filtered.sort((a, b) => {
      let valA, valB;
      switch (advancedFilters.sortBy) {
        case 'score':
          valA = a.evaluaciones ? calculateInherentRisk(a.evaluaciones).inherente : 0;
          valB = b.evaluaciones ? calculateInherentRisk(b.evaluaciones).inherente : 0;
          break;
        case 'cliente':
          valA = a.datos?.cliente || '';
          valB = b.datos?.cliente || '';
          break;
        case 'acto':
          valA = a.datos?.acto || '';
          valB = b.datos?.acto || '';
          break;
        case 'fecha':
        default:
          valA = new Date(a.createdAt);
          valB = new Date(b.createdAt);
      }
      
      if (valA < valB) return advancedFilters.sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return advancedFilters.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    
    setFilteredCases(filtered);
  }, [searchTerm, cases, advancedFilters]);

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

  const handleShowAudit = async (c, e) => {
    e.stopPropagation();
    setAuditCase(c);
    setShowAudit(true);
    try {
      const { getCaseAuditHistory } = await import('../firebase/auditStore');
      const logs = await getCaseAuditHistory(c.id);
      setAuditLogs(logs);
    } catch (err) {
      console.error('Error cargando auditoría:', err);
      setAuditLogs([]);
    }
  };

  const handleBatchDelete = async () => {
    if (!window.confirm(`¿Eliminar ${selectedIds.length} casos seleccionados? Esta acción no se puede deshacer.`)) return;
    try {
      for (const id of selectedIds) {
        await deleteCase(id);
      }
      setSelectedIds([]);
      await loadHistory();
      toast.success(`${selectedIds.length} casos eliminados`);
    } catch (err) {
      toast.error('Error al eliminar casos: ' + err.message);
    }
  };

  const handleBatchExport = async () => {
    const selectedCases = cases.filter(c => selectedIds.includes(c.id));
    if (selectedCases.length === 0) return;
    try {
      await exportMultipleToExcel(selectedCases);
      toast.success(`${selectedCases.length} casos exportados a Excel`);
    } catch (err) {
      toast.error('Error al exportar: ' + err.message);
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
              <button className="btn btn-secondary" onClick={() => setShowFilters(!showFilters)} style={{ whiteSpace: 'nowrap' }}>
                {showFilters ? 'Ocultar filtros' : 'Filtros avanzados'}
              </button>
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

            {/* Advanced Filters */}
            {showFilters && (
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px',
                marginBottom: '15px', padding: '15px', background: 'var(--bg-input)', borderRadius: '8px',
                flexShrink: 0
              }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--txt2)', marginBottom: '4px', display: 'block' }}>Desde</label>
                  <input type="date" className="input-field" style={{ padding: '8px' }}
                    value={advancedFilters.fechaDesde}
                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, fechaDesde: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--txt2)', marginBottom: '4px', display: 'block' }}>Hasta</label>
                  <input type="date" className="input-field" style={{ padding: '8px' }}
                    value={advancedFilters.fechaHasta}
                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, fechaHasta: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--txt2)', marginBottom: '4px', display: 'block' }}>Score mín</label>
                  <input type="number" className="input-field" style={{ padding: '8px' }} min="0" max="25"
                    value={advancedFilters.scoreMin}
                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, scoreMin: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--txt2)', marginBottom: '4px', display: 'block' }}>Score máx</label>
                  <input type="number" className="input-field" style={{ padding: '8px' }} min="0" max="25"
                    value={advancedFilters.scoreMax}
                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, scoreMax: e.target.value }))}
                    placeholder="25"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--txt2)', marginBottom: '4px', display: 'block' }}>Estado</label>
                  <select className="input-field" style={{ padding: '8px' }}
                    value={advancedFilters.estado}
                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, estado: e.target.value }))}
                  >
                    <option value="">Todos</option>
                    {ESTADOS_CASO.map(est => (
                      <option key={est.id} value={est.id}>{est.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--txt2)', marginBottom: '4px', display: 'block' }}>Etiqueta</label>
                  <select className="input-field" style={{ padding: '8px' }}
                    value={advancedFilters.tag}
                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, tag: e.target.value }))}
                  >
                    <option value="">Todas</option>
                    {TAGS_PREDEFINIDOS.map(tag => (
                      <option key={tag.id} value={tag.id}>{tag.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--txt2)', marginBottom: '4px', display: 'block' }}>Ordenar por</label>
                  <select className="input-field" style={{ padding: '8px' }}
                    value={advancedFilters.sortBy}
                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                  >
                    <option value="fecha">Fecha</option>
                    <option value="score">Score de riesgo</option>
                    <option value="cliente">Cliente</option>
                    <option value="acto">Tipo de acto</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--txt2)', marginBottom: '4px', display: 'block' }}>Orden</label>
                  <select className="input-field" style={{ padding: '8px' }}
                    value={advancedFilters.sortOrder}
                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, sortOrder: e.target.value }))}
                  >
                    <option value="desc">Descendente</option>
                    <option value="asc">Ascendente</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={advancedFilters.esPep} onChange={(e) => setAdvancedFilters(prev => ({ ...prev, esPep: e.target.checked }))} />
                    Solo PEP
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={advancedFilters.apoderado} onChange={(e) => setAdvancedFilters(prev => ({ ...prev, apoderado: e.target.checked }))} />
                    Con apoderado
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={advancedFilters.ofac} onChange={(e) => setAdvancedFilters(prev => ({ ...prev, ofac: e.target.checked }))} />
                    Verificado OFAC
                  </label>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button className="btn btn-secondary" style={{ width: '100%', fontSize: '0.8rem' }}
                    onClick={() => setAdvancedFilters({ fechaDesde: '', fechaHasta: '', scoreMin: '', scoreMax: '', esPep: false, apoderado: false, ofac: false, estado: '', tag: '', sortBy: 'fecha', sortOrder: 'desc' })}
                  >
                    Limpiar filtros
                  </button>
                </div>
              </div>
            )}

            {/* Bulk Actions Bar */}
            {selectedIds.length > 0 && (
              <div style={{
                display: 'flex', gap: '10px', marginBottom: '15px', padding: '10px 14px',
                background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px',
                border: '1px solid rgba(59, 130, 246, 0.2)', alignItems: 'center', flexShrink: 0
              }}>
                <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                  {selectedIds.length} seleccionado{selectedIds.length > 1 ? 's' : ''}
                </span>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowCompare(true)}
                  disabled={selectedIds.length < 2 || selectedIds.length > 3}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '8px 14px' }}
                >
                  <GitCompare size={14} /> Comparar {selectedIds.length}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleBatchExport}
                  disabled={selectedIds.length === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '8px 14px' }}
                >
                  <Download size={14} /> Exportar Excel
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleBatchDelete}
                  disabled={selectedIds.length === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '8px 14px', color: 'var(--rojo)' }}
                >
                  <Trash2 size={14} /> Eliminar
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setSelectedIds([])}
                  style={{ marginLeft: 'auto', fontSize: '0.8rem', padding: '8px 14px' }}
                >
                  Cancelar selección
                </button>
              </div>
            )}

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
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Estado</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Riesgo</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Fecha</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', width: '80px' }}></th>
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
                            {(() => {
                              const estadoId = c.datos?.estado || 'borrador';
                              const estado = ESTADOS_CASO.find(e => e.id === estadoId);
                              return (
                                <span style={{
                                  display: 'inline-block',
                                  padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600',
                                  background: estado?.bg || 'var(--bg-panel)', color: estado?.color || 'var(--txt2)', whiteSpace: 'nowrap'
                                }}>
                                  {estado?.label || 'Borrador'}
                                </span>
                              );
                            })()}
                            {(c.datos?.tags || []).length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px', justifyContent: 'center' }}>
                                {(c.datos.tags || []).slice(0, 3).map(tagId => {
                                  const tag = TAGS_PREDEFINIDOS.find(t => t.id === tagId);
                                  return tag ? (
                                    <span key={tagId} style={{
                                      display: 'inline-block', padding: '2px 6px', borderRadius: '8px',
                                      fontSize: '0.7rem', background: tag.color + '25', color: tag.color
                                    }}>
                                      {tag.label}
                                    </span>
                                  ) : null;
                                })}
                                {(c.datos.tags || []).length > 3 && (
                                  <span style={{ fontSize: '0.7rem', color: 'var(--txt2)' }}>+{c.datos.tags.length - 3}</span>
                                )}
                              </div>
                            )}
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
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button
                                className="btn btn-secondary"
                                onClick={(e) => handleShowAudit(c, e)}
                                style={{ padding: '6px', color: 'var(--accent)', minWidth: 'auto' }}
                                title="Ver auditoría"
                              >
                                <History size={14} />
                              </button>
                              <button
                                className="btn btn-secondary"
                                onClick={(e) => handleDelete(c.id, e)}
                                style={{ padding: '6px', color: 'var(--rojo)', minWidth: 'auto' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
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

      {/* Comparison Modal */}
      {showCompare && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000, padding: '20px'
        }}>
          <div className="card" style={{ width: '1000px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <GitCompare size={24} /> Comparativa de Casos
              </h2>
              <button className="btn btn-secondary" onClick={() => setShowCompare(false)}><X size={20} /></button>
            </div>

            {(() => {
              const compareCases = cases.filter(c => selectedIds.includes(c.id)).slice(0, 3);
              return (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${compareCases.length}, 1fr)`, gap: '20px' }}>
                  {compareCases.map(c => {
                    const risk = getRiskInfo(c.evaluaciones);
                    return (
                      <div key={c.id} style={{ padding: '15px', background: 'var(--bg-input)', borderRadius: '8px' }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: '10px', color: 'var(--accent)' }}>
                          {c.datos?.cliente || 'Sin nombre'}
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--txt2)', marginBottom: '15px' }}>
                          {c.datos?.cedula} | {c.datos?.acto}
                        </p>

                        <div style={{ marginBottom: '15px', padding: '10px', background: 'var(--bg-panel)', borderRadius: '6px', textAlign: 'center' }}>
                          <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: risk.color }}>{risk.score}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--txt2)', display: 'block' }}>/ 25 — {risk.label}</span>
                        </div>

                        <div style={{ fontSize: '0.85rem', lineHeight: '1.6' }}>
                          <p><strong>Valor:</strong> ${c.datos?.valor?.toLocaleString() || '0'}</p>
                          <p><strong>PEP:</strong> {c.datos?.esPep ? 'Sí' : 'No'}</p>
                          <p><strong>Apoderado:</strong> {c.datos?.apoderado ? 'Sí' : 'No'}</p>
                          <p><strong>OFAC:</strong> {c.datos?.ofac ? 'Verificado' : 'No'}</p>
                          <p><strong>Fecha:</strong> {new Date(c.createdAt).toLocaleDateString('es-EC')}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Audit Modal */}
      {showAudit && auditCase && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000, padding: '20px'
        }}>
          <div className="card" style={{ width: '600px', maxWidth: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <History size={22} /> Historial de Cambios
              </h2>
              <button className="btn btn-secondary" onClick={() => setShowAudit(false)}><X size={20} /></button>
            </div>

            <div style={{ marginBottom: '15px', padding: '12px', background: 'var(--bg-input)', borderRadius: '8px' }}>
              <p style={{ fontWeight: 'bold' }}>{auditCase.datos?.cliente}</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--txt2)' }}>{auditCase.datos?.cedula} | {auditCase.datos?.acto}</p>
            </div>

            {auditLogs.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--txt2)', padding: '20px' }}>
                No hay registros de auditoría para este caso.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {auditLogs.map((log, i) => (
                  <div key={i} style={{ padding: '12px', background: 'var(--bg-input)', borderRadius: '6px', borderLeft: '3px solid var(--accent)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontWeight: '500', fontSize: '0.9rem' }}>
                        {log.action === 'CASO_CREADO' ? '📝 Caso creado' :
                         log.action === 'CASO_ACTUALIZADO' ? '✏️ Caso actualizado' :
                         log.action === 'ANALISIS_GENERADO' ? '🤖 Análisis generado' :
                         log.action === 'EXPORTADO_PDF' ? '📄 PDF exportado' :
                         log.action === 'FIRMADO' ? '✍️ Firmado' :
                         log.action}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--txt2)' }}>
                        {new Date(log.timestamp).toLocaleString('es-EC')}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--txt2)' }}>
                      Usuario: {log.userEmail || 'Sistema'}
                    </p>
                    {log.details?.cliente && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--txt2)', marginTop: '4px' }}>
                        Cliente: {log.details.cliente}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
