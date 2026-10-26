import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { LogOut, LayoutDashboard, FileText, Building2, FileDown, Sun, Moon } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { useCase, CaseProvider } from './context/CaseContext';
import { LoginForm } from './components/LoginForm';
import { WizardHeader } from './components/WizardHeader';
import { ScoreSidebar } from './components/ScoreSidebar';
import { CaseManager } from './components/CaseManager';
import { HelpModal } from './components/HelpModal';

import { Step1Datos } from './views/Step1Datos';
import { Step2Senales } from './views/Step2Senales';
import { Step3Controles } from './views/Step3Controles';

const Step4Analisis = lazy(() => import('./views/Step4Analisis').then(m => ({ default: m.Step4Analisis })));
const Dashboard = lazy(() => import('./views/Dashboard').then(m => ({ default: m.Dashboard })));
const NotaryProfile = lazy(() => import('./views/NotaryProfile').then(m => ({ default: m.NotaryProfile })));

import { calculateInherentRisk, calculateResidualRisk } from './utils/calculations';
import { buildPrompt, analizarConGemini } from './utils/geminiApi';

import { getAllCases, updateCaseAnalysis, syncPendingCases } from './utils/storage';
import { onConnectivityChange } from './utils/offlineSync';
import { getNotaryProfile } from './firebase/profileStore';
import { requestNotificationPermission, onMessageReceived } from './firebase/messaging';
import { generateMonthlyReport } from './utils/monthlyReport';

function LoadingFallback() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid var(--bg-input)', borderTop: '3px solid var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  );
}

function Header({ isDarkMode, setIsDarkMode, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  return (
    <header className="flex justify-between items-center flex-wrap gap-4" style={{ marginBottom: '30px' }}>
      <div>
        <h1 style={{ color: 'var(--accent)', fontSize: '1.8rem', marginBottom: '5px' }}>Sistema de Análisis de Riesgo LA/FD</h1>
        <p style={{ color: 'var(--txt2)' }}>Para el sector notarial ecuatoriano — Metodología EBR</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button className={`btn ${isActive('/dashboard') ? '' : 'btn-secondary'}`} onClick={() => navigate('/dashboard')}>
          <LayoutDashboard size={16} /> Dashboard
        </button>
        <button className={`btn ${isActive('/') ? '' : 'btn-secondary'}`} onClick={() => navigate('/')}>
          <FileText size={16} /> Análisis
        </button>
        <button className={`btn ${isActive('/profile') ? '' : 'btn-secondary'}`} onClick={() => navigate('/profile')}>
          <Building2 size={16} /> Perfil
        </button>
        <button
          className="btn-ghost"
          onClick={() => setIsDarkMode(!isDarkMode)}
          title={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <HelpModal />
        <button className="btn-ghost" onClick={onLogout} style={{ color: 'var(--rojo)' }}>
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}

function WizardView({ onBatchAnalyze, batchProgress, onLoadCase }) {
  const {
    datos, setDatos,
    evaluaciones, setEvaluaciones,
    controlesEval, setControlesEval,
    step, setStep,
    scores, controlesResult,
    caseId,
    analysis, setAnalysis,
    handleReset,
  } = useCase();

  return (
    <>
      <div className="flex justify-end mb-4">
        <CaseManager
          onLoadCase={onLoadCase}
          onBatchAnalyze={onBatchAnalyze}
          batchProgress={batchProgress}
        />
      </div>
      <WizardHeader currentStep={step} setStep={setStep} />
      <div className="wizard-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '30px', alignItems: 'start' }}>
        <main>
          {step === 1 && <Step1Datos datos={datos} setDatos={setDatos} setEvaluaciones={setEvaluaciones} setControlesEval={setControlesEval} onNext={() => setStep(2)} />}
          {step === 2 && <Step2Senales evaluaciones={evaluaciones} setEvaluaciones={setEvaluaciones} onNext={() => setStep(3)} onPrev={() => setStep(1)} />}
          {step === 3 && <Step3Controles controlesEval={controlesEval} setControlesEval={setControlesEval} onNext={() => setStep(4)} onPrev={() => setStep(2)} />}
          {step === 4 && (
            <Suspense fallback={<LoadingFallback />}>
              <Step4Analisis datos={datos} setDatos={setDatos} scores={scores} controlesResult={controlesResult} factoresResult={scores.factores} evaluaciones={evaluaciones} caseId={caseId} analysisResult={analysis} setAnalysisResult={setAnalysis} onReset={handleReset} />
            </Suspense>
          )}
        </main>
        <aside><ScoreSidebar scores={scores} /></aside>
      </div>
    </>
  );
}

function AppContent() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { step, setStep, handleSave, loadCase } = useCase();

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('app_theme');
    return saved ? saved === 'dark' : true;
  });
  const [batchProgress, setBatchProgress] = useState({ active: false, current: 0, total: 0 });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    localStorage.setItem('app_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    if (user?.uid && 'Notification' in window) {
      requestNotificationPermission(user.uid);
      const unsubscribe = onMessageReceived((payload) => {
        toast(payload.notification?.title || 'Notificación recibida', {
          icon: '🔔',
          duration: 5000,
        });
      });
      return () => unsubscribe;
    }
  }, [user]);

  useEffect(() => {
    const unsubscribe = onConnectivityChange((online) => {
      if (online) {
        toast('Conexión restaurada. Sincronizando datos...', { icon: '📶' });
        syncPendingCases();
      } else {
        toast('Modo offline activado. Los cambios se guardarán localmente.', { icon: '✈️', duration: 3000 });
      }
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SYNC_PENDING_CASES') {
          syncPendingCases();
        }
      });
    }

    return unsubscribe;
  }, []);

  const isWizard = location.pathname === '/';

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 's':
            e.preventDefault();
            if (isWizard) handleSave();
            break;
          case 'enter':
            e.preventDefault();
            if (step < 4 && isWizard) setStep(step + 1);
            break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, isWizard, handleSave, setStep]);

  const handleBatchAnalyze = async (selectedIds) => {
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
        const analysis = await analizarConGemini(prompt);
        await updateCaseAnalysis(c.id, analysis);
      }
      toast.success(`Análisis completado para ${targets.length} casos.`);
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setBatchProgress({ active: false, current: 0, total: 0 });
    }
  };

  const handleMonthlyReport = async () => {
    const allCases = await getAllCases();
    const profile = await getNotaryProfile(user.uid);
    if (allCases.length === 0) {
      toast.error('No hay casos para generar el reporte');
      return;
    }
    await generateMonthlyReport(allCases, profile);
  };

  const onLoadCase = (c) => {
    loadCase(c);
    navigate('/');
  };

  return (
    <div className="container">
      <Header isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} onLogout={logout} />

      <Routes>
        <Route path="/" element={
          <WizardView onBatchAnalyze={handleBatchAnalyze} batchProgress={batchProgress} onLoadCase={onLoadCase} />
        } />
        <Route path="/dashboard" element={
          <Suspense fallback={<LoadingFallback />}>
            <div className="flex justify-end mb-4">
              <button className="btn btn-secondary btn-sm" onClick={handleMonthlyReport}>
                <FileDown size={14} /> Reporte Mensual PDF
              </button>
            </div>
            <Dashboard onGenerateReport={handleMonthlyReport} />
          </Suspense>
        } />
        <Route path="/profile" element={
          <Suspense fallback={<LoadingFallback />}>
            <NotaryProfile onClose={() => navigate('/')} />
          </Suspense>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function App() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--bg-app-1) 0%, var(--bg-app-2) 100%)' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid var(--bg-input)', borderTop: '4px solid var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }
  if (!user) return <LoginForm />;
  return (
    <CaseProvider>
      <AppContent />
    </CaseProvider>
  );
}

function AppWithToast() {
  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { background: '#141E38', color: '#f8fafc', border: '1px solid #30363d' } }} />
      <App />
    </>
  );
}

export default AppWithToast;
