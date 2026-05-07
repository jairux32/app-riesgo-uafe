import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getUserCases } from '../firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { calculateInherentRisk } from '../utils/calculations';
import { TrendingUp, AlertTriangle, FileCheck, Activity, Calendar, GitBranch, FileText, Bot, Download, Bell } from 'lucide-react';
import { generarAlertas, getAlertaStyle, contarAlertasPorPrioridad } from '../utils/alertasInteligentes';
import { ESTADOS_CASO } from '../data/constants';

const COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444'];
const RISK_LABELS = ['Bajo', 'Medio', 'Medio-Alto', 'Alto'];

export const Dashboard = ({ onGenerateReport }) => {
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('month');
  const [riskFilter, setRiskFilter] = useState('all');
  const [actoFilter, setActoFilter] = useState('all');
  const [alertas, setAlertas] = useState([]);

  useEffect(() => {
    loadData();
  }, [user, filter, riskFilter, actoFilter]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const allCases = await getUserCases(user.uid);
      const now = new Date();
      let filtered = allCases;

      if (filter === 'today') {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        filtered = allCases.filter(c => new Date(c.createdAt) >= today);
      } else if (filter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = allCases.filter(c => new Date(c.createdAt) >= weekAgo);
      } else if (filter === 'month') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        filtered = allCases.filter(c => new Date(c.createdAt) >= monthStart);
      }

      if (riskFilter !== 'all') {
        filtered = filtered.filter(c => {
          const score = c.evaluaciones ? calculateInherentRisk(c.evaluaciones).inherente : 0;
          if (riskFilter === 'bajo') return score <= 8;
          if (riskFilter === 'medio') return score > 8 && score <= 14;
          if (riskFilter === 'medio-alto') return score > 14 && score <= 19;
          if (riskFilter === 'alto') return score > 19;
          return true;
        });
      }

      if (actoFilter !== 'all') {
        filtered = filtered.filter(c => c.datos?.acto === actoFilter);
      }

      setCases(filtered);
      // Generar alertas inteligentes con todos los casos del usuario (no filtrados)
      const allAlertas = generarAlertas(allCases);
      setAlertas(allAlertas);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const getUniqueActos = () => {
    const actos = new Set();
    cases.forEach(c => { if (c.datos?.acto) actos.add(c.datos.acto); });
    return Array.from(actos).sort();
  };

  const getRiskDistribution = () => {
    const dist = [0, 0, 0, 0];
    cases.forEach(c => {
      const score = c.evaluaciones ? calculateInherentRisk(c.evaluaciones).inherente : 0;
      if (score <= 8) dist[0]++;
      else if (score <= 14) dist[1]++;
      else if (score <= 19) dist[2]++;
      else dist[3]++;
    });
    return RISK_LABELS.map((label, i) => ({ name: label, value: dist[i] })).filter(d => d.value > 0);
  };

  const getFactorAnalysis = () => {
    const factors = {};
    cases.forEach(c => {
      if (c.evaluaciones) {
        Object.entries(c.evaluaciones).forEach(([key, val]) => {
          const factorId = key.substring(0, 1) === 'c' ? 'CLIENTE' :
                          key.substring(0, 1) === 'p' ? 'PRODUCTO' :
                          key.substring(0, 1) === 'd' ? 'CANAL' :
                          key.substring(0, 1) === 'z' ? 'ZONA' : 'CUMPLIMIENTO';
          if (!factors[factorId]) factors[factorId] = { total: 0, count: 0 };
          factors[factorId].total += val.prob * val.imp;
          factors[factorId].count++;
        });
      }
    });
    return Object.entries(factors).map(([name, data]) => ({
      name,
      promedio: Math.round(data.total / data.count)
    }));
  };

  const getAlertCases = () => {
    return cases.filter(c => {
      if (!c.evaluaciones) return false;
      const score = calculateInherentRisk(c.evaluaciones).inherente;
      return score >= 15;
    }).slice(0, 5);
  };

  const avgScore = cases.length > 0
    ? Math.round(cases.reduce((sum, c) => sum + (c.evaluaciones ? calculateInherentRisk(c.evaluaciones).inherente : 0), 0) / cases.length)
    : 0;

  const riskDist = getRiskDistribution();
  const factorData = getFactorAnalysis();
  const alertCases = getAlertCases();

  const getEstadoCounts = () => {
    const counts = {};
    ESTADOS_CASO.forEach(e => counts[e.id] = 0);
    cases.forEach(c => {
      const estado = c.datos?.estado || 'borrador';
      counts[estado] = (counts[estado] || 0) + 1;
    });
    return ESTADOS_CASO.map(e => ({ ...e, count: counts[e.id] || 0 }));
  };

  const estadoCounts = getEstadoCounts();

  // Verificar si ya se generó reporte este mes
  const lastReportMonth = localStorage.getItem('app_last_report_month');
  const currentMonth = new Date().toISOString().slice(0, 7);
  const showReportReminder = cases.length > 0 && lastReportMonth !== currentMonth;

  if (loading) return <div className="card"><p style={{ textAlign: 'center' }}>Cargando estadísticas...</p></div>;

  return (
    <div>
      {showReportReminder && (
        <div style={{
          marginBottom: '20px', padding: '16px', background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px',
          display: 'flex', alignItems: 'center', gap: '12px'
        }}>
          <Calendar size={24} color="var(--accent)" />
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 'bold', color: 'var(--accent)' }}>
              Reporte mensual pendiente
            </p>
            <p style={{ fontSize: '0.9rem', color: 'var(--txt2)' }}>
              Aún no ha generado el reporte de cumplimiento de este mes ({new Date().toLocaleDateString('es-EC', { month: 'long', year: 'numeric' })}).
            </p>
          </div>
          <button
            className="btn"
            onClick={() => {
              localStorage.setItem('app_last_report_month', currentMonth);
              onGenerateReport?.();
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
          >
            <FileCheck size={16} /> Generar ahora
          </button>
        </div>
      )}

      {/* Pipeline de Estados */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
          <GitBranch size={20} color="var(--accent)" /> Pipeline de Casos
        </h3>
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '5px' }}>
          {estadoCounts.map(est => (
            <div
              key={est.id}
              style={{
                flex: 1, minWidth: '140px', padding: '15px', borderRadius: '8px',
                background: est.bg, border: '1px solid ' + est.color + '40',
                textAlign: 'center', cursor: 'pointer', transition: 'transform 0.2s',
                position: 'relative'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%',
                background: est.color + '25', display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 8px', color: est.color
              }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{est.count}</span>
              </div>
              <p style={{ fontWeight: '600', color: est.color, fontSize: '0.85rem' }}>{est.label}</p>
              {est.count > 0 && (
                <p style={{ fontSize: '0.75rem', color: 'var(--txt2)', marginTop: '4px' }}>
                  {((est.count / cases.length) * 100).toFixed(0)}% del total
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={24} /> Dashboard de Riesgo
          </h2>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <select className="input-field" style={{ width: 'auto' }} value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="today">Hoy</option>
              <option value="week">Últimos 7 días</option>
              <option value="month">Este Mes</option>
              <option value="all">Todo el historial</option>
            </select>
            <select className="input-field" style={{ width: 'auto' }} value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
              <option value="all">Todos los niveles</option>
              <option value="bajo">Bajo (1-8)</option>
              <option value="medio">Medio (9-14)</option>
              <option value="medio-alto">Medio-Alto (15-19)</option>
              <option value="alto">Alto (20-25)</option>
            </select>
            <select className="input-field" style={{ width: 'auto' }} value={actoFilter} onChange={(e) => setActoFilter(e.target.value)}>
              <option value="all">Todos los actos</option>
              {getUniqueActos().map(acto => (
                <option key={acto} value={acto}>{acto}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid-2" style={{ marginBottom: '30px' }}>
          <div style={{ padding: '20px', background: 'var(--bg-input)', borderRadius: '8px', textAlign: 'center', borderLeft: '4px solid var(--accent)' }}>
            <TrendingUp size={32} color="var(--accent)" style={{ marginBottom: '10px' }} />
            <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>{cases.length}</p>
            <p style={{ color: 'var(--txt2)', fontSize: '0.9rem' }}>Casos Procesados</p>
          </div>
          <div style={{ padding: '20px', background: 'var(--bg-input)', borderRadius: '8px', textAlign: 'center', borderLeft: '4px solid var(--verde)' }}>
            <FileCheck size={32} color="var(--verde)" style={{ marginBottom: '10px' }} />
            <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>{avgScore}/25</p>
            <p style={{ color: 'var(--txt2)', fontSize: '0.9rem' }}>Score Promedio</p>
          </div>
        </div>

        <div className="grid-2" style={{ marginBottom: '30px' }}>
          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '15px' }}>Distribución de Riesgo</h3>
            {riskDist.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={riskDist} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                    {riskDist.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <p style={{ color: 'var(--txt2)', textAlign: 'center' }}>Sin datos en este periodo</p>}
          </div>

          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '15px' }}>Factores de Riesgo</h3>
            {factorData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={factorData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 25]} />
                  <Tooltip />
                  <Bar dataKey="promedio" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p style={{ color: 'var(--txt2)', textAlign: 'center' }}>Sin datos en este periodo</p>}
          </div>
        </div>
      </div>

      {/* Alertas Inteligentes */}
      {alertas.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--rojo)' }}>
              <Bell size={20} /> Alertas Inteligentes ({alertas.length})
            </h3>
            {(() => {
              const counts = contarAlertasPorPrioridad(alertas);
              return (
                <div style={{ display: 'flex', gap: '10px', fontSize: '0.8rem' }}>
                  {counts.alta > 0 && <span style={{ color: 'var(--rojo)', fontWeight: 'bold' }}>{counts.alta} alta{counts.alta > 1 ? 's' : ''}</span>}
                  {counts.media > 0 && <span style={{ color: 'var(--amarillo)' }}>{counts.media} media{counts.media > 1 ? 's' : ''}</span>}
                </div>
              );
            })()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {alertas.slice(0, 8).map((alerta, i) => {
              const style = getAlertaStyle(alerta.tipo);
              return (
                <div key={i} style={{
                  padding: '12px', background: style.bg, borderRadius: '6px',
                  borderLeft: `3px solid ${style.color}`, display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center', gap: '10px'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '1rem' }}>{style.icon}</span>
                      <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: style.color }}>
                        {alerta.cliente}
                      </span>
                      <span style={{
                        fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px',
                        background: alerta.prioridad === 'alta' ? 'var(--rojo)' : 'var(--amarillo)',
                        color: 'white', textTransform: 'uppercase', fontWeight: 'bold'
                      }}>
                        {alerta.prioridad}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--txt2)', lineHeight: '1.4' }}>
                      {alerta.mensaje}
                    </p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--accent)', marginTop: '4px' }}>
                      💡 Acción: {alerta.accion}
                    </p>
                  </div>
                </div>
              );
            })}
            {alertas.length > 8 && (
              <p style={{ textAlign: 'center', color: 'var(--txt2)', fontSize: '0.85rem' }}>
                +{alertas.length - 8} alertas más...
              </p>
            )}
          </div>
        </div>
      )}

      {alertCases.length > 0 && (
        <div className="card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', color: 'var(--rojo)' }}>
            <AlertTriangle size={20} /> Casos de Riesgo Alto ({alertCases.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {alertCases.map((c, i) => (
              <div key={i} style={{ padding: '12px', background: 'var(--bg-input)', borderRadius: '6px', borderLeft: '3px solid var(--rojo)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 'bold' }}>{c.datos?.cliente || 'Sin nombre'}</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--txt2)' }}>{c.datos?.acto} | {new Date(c.createdAt).toLocaleDateString()}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--rojo)', marginRight: '8px' }}>
                    {calculateInherentRisk(c.evaluaciones).inherente}/25
                  </span>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                    onClick={() => window.dispatchEvent(new CustomEvent('openCase', { detail: c }))}
                    title="Abrir caso"
                  >
                    <FileText size={14} />
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                    onClick={() => window.dispatchEvent(new CustomEvent('analyzeCase', { detail: c }))}
                    title="Generar análisis IA"
                  >
                    <Bot size={14} />
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                    onClick={() => window.dispatchEvent(new CustomEvent('exportCasePDF', { detail: c }))}
                    title="Exportar PDF"
                  >
                    <Download size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
