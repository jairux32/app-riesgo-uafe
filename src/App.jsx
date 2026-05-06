import React, { useState, useEffect } from 'react';
import { LogOut, LayoutDashboard, FileText, Building2, FileDown } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { LoginForm } from './components/LoginForm';
import { WizardHeader } from './components/WizardHeader';
import { ScoreSidebar } from './components/ScoreSidebar';
import { ApiKeyModal } from './components/ApiKeyModal';
import { CaseManager } from './components/CaseManager';
import { HelpModal } from './components/HelpModal';
import { Step1Datos } from './views/Step1Datos';
import { Step2Factores } from './views/Step2Factores';
import { Step3Controles } from './views/Step3Controles';
import { Step4Analisis } from './views/Step4Analisis';
import { Dashboard } from './views/Dashboard';
import { NotaryProfile } from './views/NotaryProfile';
import { calculateInherentRisk, calculateResidualRisk } from './utils/calculations';
import { buildPrompt, analizarConGemini } from './utils/geminiApi';
import { DEMO_CASE } from './data/demoCase';
import { getAllCases, updateCaseAnalysis, setUserId } from './utils/storage';
import { getNotaryProfile } from './firebase/profileStore';
import { generateMonthlyReport } from './utils/monthlyReport';

function AppContent() {
  const { user, logout } = useAuth();
  const [apiKey, setApiKey] = useState(sessionStorage.getItem('gemini_api_key') || '');
  const [showApiModal, setShowApiModal] = useState(!sessionStorage.getItem('gemini_api_key'));
  const [step, setStep] = useState(1);
  const [view, setView] = useState('wizard');

  const [datos, setDatos] = useState({
    notaria: '', notario: '', cliente: '', cedula: '', acto: '', valor: '',
    origen: '', medioPago: '', actividad: '', esPep: false, detallePep: '',
    apoderado: false, ofac: false, onu: false, pepUafe: false,
    reportesPrevios: false, observaciones: ''
  });

  const [evaluaciones, setEvaluaciones] = useState({});
  const [controlesEval, setControlesEval] = useState({});
  const [scores, setScores] = useState({ inherente: 0, nivel: '', diligencia: '', colorClass: '', factores: [] });
  const [controlesResult, setControlesResult] = useState({ residual: 0, nivelResidual: '', colorClass: '', efectividadPromedio: 0, lista: [] });
  const [batchProgress, setBatchProgress] = useState({ active: false, current: 0, total: 0 });

  useEffect(() => { if (user?.uid) setUserId(user.uid); }, [user]);

  useEffect(() => {
    const resInherente = calculateInherentRisk(evaluaciones);
    setScores(resInherente);
    const resResidual = calculateResidualRisk(resInherente.inherente, controlesEval);
    setControlesResult(resResidual);
  }, [evaluaciones, controlesEval]);

  useEffect(() => {
    sessionStorage.setItem('app_wizard_state', JSON.stringify({ datos, evaluaciones, controlesEval, step }));
  }, [datos, evaluaciones, controlesEval, step]);

  useEffect(() => {
    const savedState = sessionStorage.getItem('app_wizard_state');
    if (savedState) {
      const { datos: sDatos, evaluaciones: sEval, controlesEval: sCtrl, step: sStep } = JSON.parse(savedState);
      setDatos(sDatos); setEvaluaciones(sEval); setControlesEval(sCtrl); setStep(sStep);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 's': e.preventDefault(); break;
          case 'enter': e.preventDefault(); if (step < 4 && view === 'wizard') setStep(step + 1); break;
          case 'p': e.preventDefault(); break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, view]);

  const handleDemoMode = () => { setDatos(DEMO_CASE); setView('wizard'); };

  const handleExpressAnalyze = () => {
    if (!datos.cliente || !datos.cedula) { alert('Complete los datos básicos del cliente primero'); setStep(1); setView('wizard'); return; }
    setEvaluaciones({}); setControlesEval({}); setStep(4); setView('wizard');
  };

  const handleReset = () => {
    setDatos({ notaria: '', notario: '', cliente: '', cedula: '', acto: '', valor: '', origen: '', medioPago: '', actividad: '', esPep: false, detallePep: '', apoderado: false, ofac: false, onu: false, pepUafe: false, reportesPrevios: false, observaciones: '' });
    setEvaluaciones({}); setControlesEval({}); setStep(1);
  };

  const handleBatchAnalyze = async (selectedIds) => {
    if (!apiKey) { alert('Configure la API Key primero'); setShowApiModal(true); return; }
    const allCases = await getAllCases();
    const targets = allCases.filter(c => selectedIds.includes(c.id));
    setBatchProgress({ active: true, current: 0, total: targets.length });
    try {
      for (let i = 0; i < targets.length; i++) {
        const c = targets[i];
        setBatchProgress(prev => ({ ...prev, current: i + 1 }));
        const ri = calculateInherentRisk(c.evaluaciones || {});
        const rr = calculateResidualRisk(ri.inherente, c.controlesEval || {});
        const prompt = buildPrompt(c.datos, ri, ri.factores, rr);
        const analysis = await analizarConGemini(apiKey, prompt);
        await updateCaseAnalysis(c.id, analysis);
      }
      alert(`Análisis completado para ${targets.length} casos.`);
    } catch (err) { alert('Error: ' + err.message); }
    finally { setBatchProgress({ active: false, current: 0, total: 0 }); }
  };

  const handleMonthlyReport = async () => {
    const allCases = await getAllCases();
    const profile = await getNotaryProfile(user.uid);
    if (allCases.length === 0) { alert('No hay casos para generar el reporte'); return; }
    await generateMonthlyReport(allCases, profile);
  };

  return (
    <div className="container">
      {showApiModal && <ApiKeyModal setApiKey={(key) => { setApiKey(key); setShowApiModal(false); }} />}
      <header style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ color: 'var(--accent)', fontSize: '1.8rem', marginBottom: '5px' }}>Sistema de Análisis de Riesgo LA/FD</h1>
          <p style={{ color: 'var(--txt2)' }}>Para el sector notarial ecuatoriano — Metodología EBR</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className={`btn ${view === 'dashboard' ? '' : 'btn-secondary'}`} onClick={() => setView('dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <LayoutDashboard size={16} /> Dashboard
          </button>
          <button className={`btn ${view === 'wizard' ? '' : 'btn-secondary'}`} onClick={() => setView('wizard')} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <FileText size={16} /> Análisis
          </button>
          <button className="btn btn-secondary" onClick={() => setView('profile')} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Building2 size={16} /> Perfil
          </button>
          <button className="btn btn-secondary" onClick={() => setShowApiModal(true)}>Config API</button>
          <button className="btn btn-secondary" onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <LogOut size={16} /> {user?.email?.split('@')[0]}
          </button>
        </div>
      </header>

      {view === 'dashboard' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
            <button className="btn" onClick={handleMonthlyReport} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--verde)' }}>
              <FileDown size={16} /> Generar Reporte Mensual PDF
            </button>
          </div>
          <Dashboard />
        </>
      )}

      {view === 'profile' && (
        <NotaryProfile onClose={() => setView('wizard')} />
      )}

      {view === 'wizard' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={handleDemoMode}>Cargar Demo</button>
              <button className="btn" onClick={handleExpressAnalyze} style={{ background: 'var(--naranja)' }}>🚀 Análisis Rápido</button>
            </div>
            <CaseManager currentCase={{ datos, evaluaciones, controlesEval }} onLoadCase={(c) => { setDatos(c.datos); setEvaluaciones(c.evaluaciones); setControlesEval(c.controlesEval); }} onBatchAnalyze={handleBatchAnalyze} batchProgress={batchProgress} />
          </div>
          <WizardHeader currentStep={step} setStep={setStep} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '30px', alignItems: 'start' }}>
            <main>
              {step === 1 && <Step1Datos datos={datos} setDatos={setDatos} onNext={() => setStep(2)} />}
              {step === 2 && <Step2Factores evaluaciones={evaluaciones} setEvaluaciones={setEvaluaciones} onNext={() => setStep(3)} onPrev={() => setStep(1)} />}
              {step === 3 && <Step3Controles controlesEval={controlesEval} setControlesEval={setControlesEval} onNext={() => setStep(4)} onPrev={() => setStep(2)} />}
              {step === 4 && <Step4Analisis datos={datos} scores={scores} controlesResult={controlesResult} factoresResult={scores.factores} apiKey={apiKey} setApiKey={setApiKey} onReset={handleReset} />}
            </main>
            <aside><ScoreSidebar scores={scores} /></aside>
          </div>
        </>
      )}
    </div>
  );
}

function App() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--bg-app-1) 0%, var(--bg-app-2) 100%)' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid var(--bg-input)', borderTop: '4px solid var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  if (!user) return <LoginForm />;
  return <AppContent />;
}

export default App;
