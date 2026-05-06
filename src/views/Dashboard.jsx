import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getUserCases } from '../firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { calculateInherentRisk } from '../utils/calculations';
import { TrendingUp, AlertTriangle, FileCheck, Activity } from 'lucide-react';

const COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444'];
const RISK_LABELS = ['Bajo', 'Medio', 'Medio-Alto', 'Alto'];

export const Dashboard = () => {
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('month');

  useEffect(() => {
    loadData();
  }, [user, filter]);

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

      setCases(filtered);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
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

  if (loading) return <div className="card"><p style={{ textAlign: 'center' }}>Cargando estadísticas...</p></div>;

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={24} /> Dashboard de Riesgo
          </h2>
          <select className="input-field" style={{ width: 'auto' }} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="today">Hoy</option>
            <option value="week">Últimos 7 días</option>
            <option value="month">Este Mes</option>
            <option value="all">Todo el historial</option>
          </select>
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

      {alertCases.length > 0 && (
        <div className="card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', color: 'var(--rojo)' }}>
            <AlertTriangle size={20} /> Casos que Requieren Atención ({alertCases.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {alertCases.map((c, i) => (
              <div key={i} style={{ padding: '12px', background: 'var(--bg-input)', borderRadius: '6px', borderLeft: '3px solid var(--rojo)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontWeight: 'bold' }}>{c.datos?.cliente || 'Sin nombre'}</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--txt2)' }}>{c.datos?.acto} | {new Date(c.createdAt).toLocaleDateString()}</p>
                </div>
                <span style={{ fontWeight: 'bold', color: 'var(--rojo)' }}>
                  {calculateInherentRisk(c.evaluaciones).inherente}/25
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
