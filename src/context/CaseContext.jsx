import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { calculateInherentRisk, calculateResidualRisk } from '../utils/calculations';
import { saveCase, updateCase } from '../utils/storage';
import { updatePendingCase } from '../utils/offlineSync';
import { CONTROLES_INTERNOS, FACTORES_SENALES_UAFE, DDC_INICIAL, BENEFICIARIO_FINAL_INICIAL } from '../data/constants';
import toast from 'react-hot-toast';

const initialState = {
  datos: {
    notaria: '', notario: '', cliente: '', cedula: '', acto: '', valor: '',
    origen: '', medioPago: '', actividad: '', esPep: false, detallePep: '',
    apoderado: false, ofac: false, onu: false, uk: false, pepUafe: false,
    reportesPrevios: false, observaciones: '',
    estado: 'borrador', tags: [], notasInternas: '',
    verificaciones: {
      ofac: { estado: 'pendiente', fecha: null, resultado: null, coincidencias: [] },
      onu: { estado: 'pendiente', fecha: null, resultado: null, coincidencias: [] },
      uk: { estado: 'pendiente', fecha: null, resultado: null, coincidencias: [] },
      uafe: { estado: 'pendiente', fecha: null, resultado: null, coincidencias: [] }
    },
    tipoPersona: 'natural',
    nacionalidad: 'ECU',
    provincia: '', canton: '', parroquia: '',
    actividadSecundaria: '',
    ingresoMensual: '', ingresoAnual: '',
    estadoCivil: '',
    conyuge: { nombre: '', cedula: '', nacionalidad: '' },
    representanteLegal: { nombre: '', cedula: '', nacionalidad: '' },
    beneficiarioFinal: { ...BENEFICIARIO_FINAL_INICIAL },
    cadenaPropiedad: [],
    ddc: { ...DDC_INICIAL },
    fechaConstitucion: '',
    fechaTransaccion: '',
    tipoTransaccion: '',
    usoEfectivo: false, montoEfectivo: '',
    billetesAltaDenominacion: false, montoBilletesAlta: '',
    usoActivosVirtuales: false, tipoActivoVirtual: '', descripcionActivoVirtual: '',
    antecedentesPenales: false,
    registradoInterpolONUOFAC: false,
    prioridadReporte: 'normal',
    claseReporte: 'inicial',
    senalesAlertaDetectadas: [],
    tercerosImplicados: []
  },
  evaluaciones: {},
  controlesEval: {},
  step: 1
};

const CaseContext = createContext(null);

export const useCase = () => {
  const ctx = useContext(CaseContext);
  if (!ctx) throw new Error('useCase debe usarse dentro de CaseProvider');
  return ctx;
};

export const CaseProvider = ({ children }) => {
  const [datos, setDatos] = useState(initialState.datos);
  const [evaluaciones, setEvaluaciones] = useState(initialState.evaluaciones);
  const [controlesEval, setControlesEval] = useState(initialState.controlesEval);
  const [step, setStep] = useState(initialState.step);
  // Calcular scores reactivamente mediante useMemo
  const scores = useMemo(() => calculateInherentRisk(evaluaciones), [evaluaciones]);
  const controlesResult = useMemo(() => calculateResidualRisk(scores.inherente, controlesEval), [scores.inherente, controlesEval]);

  const savedRef = useRef(false);
  const [caseId, setCaseId] = useState(null);
  // El dictamen de IA se conserva en el contexto para que sobreviva al
  // recargar un caso y llegue al PDF/Excel aunque no se regenere.
  const [analysis, setAnalysis] = useState(null);

  // Totales reales del catálogo: antes estaban fijados en 56 y 12, pero el
  // catálogo tiene 10 controles, así que el borrador nunca se guardaba.
  const totalSenales = useMemo(
    () => FACTORES_SENALES_UAFE.reduce((suma, f) => suma + f.subcriterios.length, 0),
    []
  );
  const totalControles = CONTROLES_INTERNOS.length;

  // Auto-guardar borrador cada 10 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      const evalCount = Object.keys(evaluaciones).length;
      const ctrlCount = Object.keys(controlesEval).length;
      const isIncomplete = step < 4 || evalCount < totalSenales || ctrlCount < totalControles;
      if (isIncomplete && datos.cliente) {
        sessionStorage.setItem('app_draft_state', JSON.stringify({
          datos, evaluaciones, controlesEval, step,
          savedAt: new Date().toISOString(),
          isDraft: true
        }));
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [datos, evaluaciones, controlesEval, step, totalSenales, totalControles]);

  // Restaurar borrador al iniciar
  useEffect(() => {
    if (savedRef.current) return;
    savedRef.current = true;

    const draftState = sessionStorage.getItem('app_draft_state');
    if (draftState) {
      const draft = JSON.parse(draftState);
      const savedAt = new Date(draft.savedAt);
      const hoursSinceDraft = (new Date() - savedAt) / (1000 * 60 * 60);

      if (hoursSinceDraft < 24 && draft.isDraft) {
        toast((t) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ fontWeight: 'bold' }}>📝 Borrador encontrado</p>
            <p style={{ fontSize: '0.85rem' }}>
              Tiene un caso de {draft.datos.cliente || 'sin nombre'} guardado como borrador.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn"
                style={{ padding: '8px 16px', fontSize: '0.8rem' }}
                onClick={() => {
                  setDatos(draft.datos);
                  setEvaluaciones(draft.evaluaciones);
                  setControlesEval(draft.controlesEval);
                  setStep(draft.step);
                  sessionStorage.removeItem('app_draft_state');
                  toast.dismiss(t.id);
                  toast.success('Borrador restaurado');
                }}
              >
                Restaurar
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: '8px 16px', fontSize: '0.8rem' }}
                onClick={() => {
                  sessionStorage.removeItem('app_draft_state');
                  toast.dismiss(t.id);
                }}
              >
                Descartar
              </button>
            </div>
          </div>
        ), { duration: 10000, id: 'draft-restore' });
      } else {
        sessionStorage.removeItem('app_draft_state');
      }
    }
  }, []);

  const handleReset = useCallback(() => {
    setDatos(initialState.datos);
    setEvaluaciones(initialState.evaluaciones);
    setControlesEval(initialState.controlesEval);
    setStep(1);
    setCaseId(null);
    setAnalysis(null);
    sessionStorage.removeItem('app_draft_state');
  }, []);

  const loadCase = useCallback((c) => {
    // Los casos antiguos no tienen los campos de DDC/BF: se mezclan con los
    // valores iniciales para que la UI no reciba objetos undefined.
    setDatos({
      ...initialState.datos,
      ...(c.datos || {}),
      conyuge: { ...initialState.datos.conyuge, ...(c.datos?.conyuge || {}) },
      representanteLegal: {
        ...initialState.datos.representanteLegal,
        ...(c.datos?.representanteLegal || {})
      },
      beneficiarioFinal: {
        ...BENEFICIARIO_FINAL_INICIAL,
        ...(c.datos?.beneficiarioFinal || {})
      },
      ddc: { ...DDC_INICIAL, ...(c.datos?.ddc || {}) }
    });
    setEvaluaciones(c.evaluaciones || {});
    setControlesEval(c.controlesEval || {});
    setStep(1);
    setCaseId(c.id || null);
    setAnalysis(c.analysis || null);
  }, []);

  const updateDatos = useCallback((partial) => {
    setDatos(prev => ({ ...prev, ...partial }));
  }, []);

  const handleSave = useCallback(async () => {
    toast('Guardando caso...');
    const payload = {
      datos,
      evaluaciones,
      controlesEval,
      analysis,
      inherentScore: scores.inherente
    };
    try {
      // Si el caso ya existe, se actualiza: antes cada guardado creaba un
      // documento nuevo y el historial se llenaba de duplicados.
      if (caseId && String(caseId).startsWith('pending_')) {
        const key = Number.parseInt(String(caseId).replace('pending_', ''), 10);
        const ok = await updatePendingCase(key, payload);
        if (ok) toast.success('Caso actualizado localmente');
        else toast.error('No se encontró el borrador local');
      } else if (caseId) {
        const ok = await updateCase(caseId, payload);
        if (ok) toast.success('Caso actualizado');
      } else {
        const saved = await saveCase(payload);
        if (saved?.id) setCaseId(saved.id);
        if (saved) toast.success('Caso guardado');
      }
    } catch (err) {
      toast.error('Error al guardar: ' + err.message);
    }
  }, [datos, evaluaciones, controlesEval, analysis, scores.inherente, caseId]);

  return (
    <CaseContext.Provider value={{
      datos, setDatos, updateDatos,
      evaluaciones, setEvaluaciones,
      controlesEval, setControlesEval,
      step, setStep,
      scores, controlesResult,
      caseId,
      analysis, setAnalysis,
      handleReset, loadCase, handleSave,
    }}>
      {children}
    </CaseContext.Provider>
  );
};
