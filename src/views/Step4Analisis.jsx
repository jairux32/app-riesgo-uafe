import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Bot, FileText, Download, Printer, RefreshCw, AlertTriangle, Pen, Tag, Shield } from 'lucide-react';
import { getEstadoVerificacionStyle } from '../utils/sanctionsCheck';
import { ESTADOS_CASO, TAGS_PREDEFINIDOS } from '../data/constants';
import { exportToPDF, exportToExcel, exportROSPDF } from '../utils/exportUtils';
import { buildPrompt, analizarConGemini } from '../utils/geminiApi';
import { useAuth } from '../context/AuthContext';
import { getNotaryProfile } from '../firebase/profileStore';
import { SignatureModal } from '../components/SignatureModal';
import { transformAuditForDisplay, formatConfidence } from '../utils/auditTransformer';

export const Step4Analisis = ({
  datos, setDatos, scores, controlesResult, factoresResult, evaluaciones,
  onReset
}) => {
  const { user } = useAuth();
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [signatureNotario, setSignatureNotario] = useState(null);
  const [signatureOficial, setSignatureOficial] = useState(null);
  const [sigModalOpen, setSigModalOpen] = useState(false);
  const [sigModalRole, setSigModalRole] = useState('');
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem('gemini_api_key') || '');

  useEffect(() => {
    if (apiKey) {
      sessionStorage.setItem('gemini_api_key', apiKey);
    } else {
      sessionStorage.removeItem('gemini_api_key');
    }
  }, [apiKey]);

  const handleGenerateIA = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const promptText = buildPrompt(datos, scores, factoresResult, controlesResult);
      const res = await analizarConGemini(promptText);
      setAnalysisResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportPDF = async () => {
    toast('Generando PDF...', { icon: '📄' });
    try {
      const profile = await getNotaryProfile(user.uid);
      await exportToPDF(datos, scores, factoresResult, controlesResult, analysisResult, profile, {
        notario: signatureNotario,
        oficial: signatureOficial
      });
      toast.success('PDF descargado correctamente');
    } catch (err) {
      toast.error('Error al generar PDF: ' + err.message);
      console.error("Error exportando PDF:", err);
    }
  };

  const openSignatureModal = (role) => {
    setSigModalRole(role);
    setSigModalOpen(true);
  };

  const handleSaveSignature = (dataUrl) => {
    if (sigModalRole === 'notario') {
      setSignatureNotario(dataUrl);
    } else {
      setSignatureOficial(dataUrl);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = async () => {
    toast('Generando Excel...', { icon: '📊' });
    try {
      await exportToExcel(datos, scores, factoresResult, controlesResult, analysisResult);
      toast.success('Excel descargado correctamente');
    } catch (err) {
      toast.error('Error al generar Excel: ' + err.message);
      console.error("Error exportando Excel:", err);
    }
  };

  const handleExportROS = async () => {
    toast('Generando ROS PDF...', { icon: '📋' });
    try {
      const profile = await getNotaryProfile(user.uid);
      await exportROSPDF(datos, scores, evaluaciones, profile);
      toast.success('ROS generado correctamente');
    } catch (err) {
      toast.error('Error al generar ROS: ' + err.message);
      console.error("Error exportando ROS:", err);
    }
  };

  const auditData = analysisResult ? transformAuditForDisplay(analysisResult) : null;

  return (
    <div>
      {scores.inherente >= 20 && (
        <div style={{
          marginBottom: '20px', padding: '16px', background: 'rgba(239, 68, 68, 0.15)',
          border: '2px solid var(--rojo)', borderRadius: '8px', display: 'flex',
          alignItems: 'center', gap: '12px', animation: 'pulse 2s infinite'
        }}>
          <AlertTriangle size={28} color="var(--rojo)" />
          <div>
            <p style={{ color: 'var(--rojo)', fontWeight: 'bold', fontSize: '1.1rem' }}>
              CASO DE RIESGO ALTO — Requiere evaluación inmediata de ROS
            </p>
            <p style={{ color: 'var(--rojo)', fontSize: '0.9rem', marginTop: '4px' }}>
              Score: {scores.inherente}/25 | Este caso amerita análisis para reporte de operación sospechosa a la UAFE
            </p>
          </div>
        </div>
      )}

        <div className="card">
          <h2 style={{ marginBottom: '20px', color: 'var(--accent)' }}>Resumen de Riesgo</h2>
          
          <div className="grid-2">
            <div style={{ padding: '15px', background: 'var(--bg-input)', borderRadius: '8px', borderLeft: `4px solid ${scores.colorClass.split(' ')[0] === 'text-rojo' ? 'var(--rojo)' : 'var(--accent)'}` }}>
              <p style={{ color: 'var(--txt2)', fontSize: '0.9rem' }}>Riesgo Inherente</p>
              <p style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{scores.inherente}/25</p>
              <p className={scores.colorClass.split(' ')[0]} style={{ fontWeight: '600' }}>{scores.nivel}</p>
            </div>
            
            <div style={{ padding: '15px', background: 'var(--bg-input)', borderRadius: '8px', borderLeft: `4px solid ${controlesResult.colorClass.split(' ')[0] === 'text-rojo' ? 'var(--rojo)' : 'var(--accent)'}` }}>
              <p style={{ color: 'var(--txt2)', fontSize: '0.9rem' }}>Riesgo Residual</p>
              <p style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{controlesResult.residual}/25</p>
              <p className={controlesResult.colorClass.split(' ')[0]} style={{ fontWeight: '600' }}>{controlesResult.nivelResidual}</p>
            </div>
          </div>

          <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #30363d', borderRadius: '8px' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🚀 Factores Determinantes
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {scores.factores
                .sort((a, b) => b.ponderado - a.ponderado)
                .slice(0, 3)
                .map((f, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', padding: '5px 10px', background: 'var(--bg-panel)', borderRadius: '4px' }}>
                    <span>{f.nombre}</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--accent)' }}>{f.ponderado} pts</span>
                  </div>
                ))}
            </div>
          </div>

          <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #30363d', borderRadius: '8px' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '10px' }}>Acciones Sugeridas</h3>
            <ul style={{ listStylePosition: 'inside', color: 'var(--txt2)', fontSize: '0.9rem', lineHeight: '1.6' }}>
              {scores.inherente >= 0 && <li>Archivar expediente con debida diligencia.</li>}
              {scores.inherente >= 9 && <li>Solicitar declaración juramentada de origen de fondos lícitos.</li>}
              {scores.inherente >= 15 && <li style={{ color: 'var(--naranja)' }}>Escalar a revisión por Oficial de Cumplimiento.</li>}
              {scores.inherente >= 20 && <li style={{ color: 'var(--rojo)' }}>Evaluar la no celebración del acto y emitir posible reporte ROS a la UAFE.</li>}
            </ul>
          </div>
        </div>


      {datos.verificaciones && (
        <div className="card">
          <h2 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent)' }}>
            <Shield size={22} /> Estado de Verificaciones
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            {['ofac', 'onu', 'uafe'].map(key => {
              const verif = datos.verificaciones[key] || { estado: 'pendiente' };
              const style = getEstadoVerificacionStyle(verif.estado);
              return (
                <div key={key} style={{
                  padding: '12px', background: style.bg, borderRadius: '8px',
                  border: `1px solid ${style.color}30`, display: 'flex',
                  flexDirection: 'column', gap: '6px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.9rem', textTransform: 'uppercase', color: style.color }}>
                      {key}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: style.color, fontWeight: '600' }}>
                      {style.icon} {style.label}
                    </span>
                  </div>
                  {verif.resultado && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--txt2)', lineHeight: '1.4' }}>{verif.resultado}</p>
                  )}
                  {verif.fecha && (
                    <p style={{ fontSize: '0.7rem', color: 'var(--txt2)' }}>
                      Verificado: {new Date(verif.fecha).toLocaleDateString('es-EC')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card">
        <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent)' }}>
          <Bot size={24} /> Análisis de IA (Gemini)
        </h2>

        {!analysisResult && !isLoading && (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <p style={{ color: 'var(--txt2)', marginBottom: '20px' }}>Genera un dictamen jurídico y detección de señales de alerta automatizado.</p>
            <div style={{ maxWidth: '400px', margin: '0 auto 16px' }}>
              <input
                type="password"
                className="input-field"
                placeholder="API Key de Gemini (obligatorio)"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{ textAlign: 'center' }}
              />
              <p style={{ fontSize: '0.7rem', color: 'var(--txt2)', marginTop: '4px' }}>
                Obténgala en <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" style={{ color: 'var(--accent)' }}>Google AI Studio</a>
              </p>
            </div>
            <button className="btn" onClick={handleGenerateIA} style={{ fontSize: '1.1rem', padding: '12px 24px' }} disabled={!apiKey}>
              <Bot size={20} /> Generar Análisis con IA
            </button>
            <p style={{ fontSize: '0.75rem', color: 'var(--txt2)', marginTop: '10px' }}>
              Modelo gratuito: gemini-2.5-flash | ~2000 tokens
            </p>
          </div>
        )}

        {isLoading && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ 
              width: '40px', height: '40px', border: '4px solid var(--bg-input)', 
              borderTop: '4px solid var(--accent)', borderRadius: '50%', 
              animation: 'spin 1s linear infinite', margin: '0 auto 20px'
            }}></div>
            <p>Gemini está analizando el caso bajo la normativa ecuatoriana...</p>

          </div>
        )}

        {error && (
          <div style={{ padding: '15px', background: 'var(--rojo)', color: 'white', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={20} />
            <div>
              <p style={{ fontWeight: 'bold' }}>Error al conectar con Gemini</p>
              <p style={{ fontSize: '0.9rem' }}>{error}</p>
            </div>
          </div>
        )}

          {auditData && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              padding: '20px 0',
              background: 'var(--bg-app-1)' 
            }}>
              <div 
                className="legal-document"
                style={{ 
                  width: '210mm', 
                  minHeight: '297mm', 
                  background: 'white', 
                  color: '#1a1a1a', 
                  padding: '40px', 
                  borderRadius: '4px', 
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)', 
                  lineHeight: '1.6', 
                  fontSize: '12pt', 
                  fontFamily: 'serif',
                  textAlign: 'justify'
                }}
              >
                <h2>DICTAMEN DE ANÁLISIS DE RIESGO LA/FD</h2>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '0.85rem', color: '#666', fontFamily: 'sans-serif' }}>
                  <span>Fecha: {new Date(auditData.header.fecha).toLocaleDateString('es-EC')}</span>
                  <span>Modelo: {auditData.header.modelo}</span>
                  <span>Confianza: {formatConfidence(auditData.header.confianza)}</span>
                </div>

                <h3>I. DICTAMEN EJECUTIVO</h3>
                <div style={{ fontFamily: 'sans-serif', fontSize: '0.9rem' }}>
                  <p><strong>Nivel de Riesgo Inherente:</strong> {auditData.riskLevels.inherent}</p>
                  <p><strong>Nivel de Riesgo Residual:</strong> {auditData.riskLevels.residual}</p>
                  <p><strong>Clasificación Final:</strong> {auditData.riskLevels.classification}</p>
                  <p style={{ marginTop: '10px' }}>{auditData.riskLevels.summary}</p>
                </div>

                {auditData.alertSignals && Object.entries(auditData.alertSignals).some(([, signals]) => signals.length > 0) && (
                  <>
                    <h3>II. SEÑALES DE ALERTA IDENTIFICADAS</h3>
                    <div style={{ fontFamily: 'sans-serif', fontSize: '0.9rem' }}>
                      {Object.entries(auditData.alertSignals).map(([category, signals]) => {
                        if (signals.length === 0) return null;
                        const categoryLabels = {
                          identidad: 'Identidad', corporativa: 'Corporativa', transaccional: 'Transaccional',
                          internacional: 'Internacional', bienes_raices: 'Bienes Raíces', activos_virtuales: 'Activos Virtuales', otra: 'Otra'
                        };
                        return (
                          <div key={category} style={{ marginBottom: '12px' }}>
                            <p style={{ fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>{categoryLabels[category] || category}</p>
                            {signals.map((signal, idx) => (
                              <div key={idx} style={{ padding: '6px 10px', marginBottom: '4px', borderLeft: `3px solid ${signal.severidad === 'critica' ? 'var(--rojo)' : signal.severidad === 'alta' ? 'var(--naranja)' : signal.severidad === 'media' ? 'var(--amarillo)' : 'var(--verde)'}`, background: '#f8f9fa' }}>
                                <span style={{ fontWeight: '600' }}>{signal.codigo}</span>: {signal.descripcion}
                                {signal.norma && <span style={{ color: '#666', fontSize: '0.8rem' }}> — {signal.norma}</span>}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {auditData.legalFoundation.articles.length > 0 && (
                  <>
                    <h3>III. FUNDAMENTO LEGAL</h3>
                    <div style={{ fontFamily: 'sans-serif', fontSize: '0.9rem' }}>
                      {auditData.legalFoundation.articles.length > 0 && (
                        <div style={{ marginBottom: '10px' }}>
                          <p style={{ fontWeight: 'bold' }}>Artículos Aplicables:</p>
                          <ul style={{ paddingLeft: '20px' }}>
                            {auditData.legalFoundation.articles.map((article, idx) => (
                              <li key={idx}>
                                <strong>{article.norma ? `${article.norma} — ` : ''}{article.articulo}{article.numeral ? ` Num. ${article.numeral}` : ''}</strong>
                                {article.texto_referencia && <span style={{ display: 'block', fontSize: '0.85rem', color: '#666' }}>"{article.texto_referencia}"</span>}
                                <span style={{ display: 'block' }}>{article.aplicacion_caso}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {auditData.legalFoundation.resolutions.length > 0 && (
                        <div style={{ marginBottom: '10px' }}>
                          <p style={{ fontWeight: 'bold' }}>Resoluciones Aplicables:</p>
                          <ul style={{ paddingLeft: '20px' }}>
                            {auditData.legalFoundation.resolutions.map((res, idx) => (
                              <li key={idx}>
                                <strong>{res.resolucion}{res.articulo ? ` — ${res.articulo}` : ''}</strong>
                                <span style={{ display: 'block' }}>{res.aplicacion_caso}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {auditData.legalFoundation.gafiatCriteria.length > 0 && (
                        <div>
                          <p style={{ fontWeight: 'bold' }}>Criterios GAFIAT:</p>
                          <ul style={{ paddingLeft: '20px' }}>
                            {auditData.legalFoundation.gafiatCriteria.map((crit, idx) => (
                              <li key={idx}><strong>{crit.criterio}</strong>: {crit.aplicacion}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {auditData.obligations.length > 0 && (
                  <>
                    <h3>IV. OBLIGACIONES ACTIVADAS</h3>
                    <div style={{ fontFamily: 'sans-serif', fontSize: '0.9rem' }}>
                      {auditData.obligations.map((ob, idx) => (
                        <div key={idx} style={{ padding: '8px 10px', marginBottom: '6px', background: '#f8f9fa', borderLeft: '3px solid #333' }}>
                          <p><strong>{ob.obligacion}</strong></p>
                          {ob.plazo && <p style={{ fontSize: '0.85rem', color: '#666' }}>Plazo: {ob.plazo}</p>}
                          {ob.procedimiento && <p style={{ fontSize: '0.85rem', color: '#666' }}>Procedimiento: {ob.procedimiento}</p>}
                          {ob.responsable && <p style={{ fontSize: '0.85rem', color: '#666' }}>Responsable: {ob.responsable}</p>}
                          {ob.consecuencia && <p style={{ fontSize: '0.85rem', color: '#666' }}>Consecuencia: {ob.consecuencia}</p>}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <h3>V. EVALUACIÓN DE CONTROLES INTERNOS</h3>
                <div style={{ fontFamily: 'sans-serif', fontSize: '0.9rem' }}>
                  <p><strong>Efectividad Global:</strong> {Math.round(auditData.controls.effectiveness * 100)}%</p>
                  {auditData.controls.effective.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <p style={{ fontWeight: '600', color: 'var(--verde)' }}>Controles Efectivos:</p>
                      <ul style={{ paddingLeft: '20px' }}>
                        {auditData.controls.effective.map((c, idx) => (
                          <li key={idx}><strong>{c.nombre || c}</strong>{c.evaluacion ? `: ${c.evaluacion}` : ''}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {auditData.controls.deficient.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <p style={{ fontWeight: '600', color: 'var(--naranja)' }}>Controles Deficientes:</p>
                      <ul style={{ paddingLeft: '20px' }}>
                        {auditData.controls.deficient.map((c, idx) => (
                          <li key={idx}>
                            <strong>{c.nombre || c}</strong>{c.evaluacion ? `: ${c.evaluacion}` : ''}
                            {c.recomendacion && <span style={{ display: 'block', fontSize: '0.85rem', color: '#666' }}>→ {c.recomendacion}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {auditData.controls.criticalGaps.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <p style={{ fontWeight: '600', color: 'var(--rojo)' }}>Brechas Críticas:</p>
                      <ul style={{ paddingLeft: '20px' }}>
                        {auditData.controls.criticalGaps.map((c, idx) => <li key={idx}>{c}</li>)}
                      </ul>
                    </div>
                  )}
                </div>

                {auditData.ros.required && (
                  <>
                    <h3>VI. ANÁLISIS ROS</h3>
                    <div style={{ fontFamily: 'sans-serif', fontSize: '0.9rem', padding: '12px', background: '#fef2f2', borderLeft: '4px solid var(--rojo)' }}>
                      <p style={{ fontWeight: 'bold', color: 'var(--rojo)' }}>AMERITA REPORTE DE OPERACIÓN SOSPECHOSA</p>
                      <p style={{ marginTop: '6px' }}>Probabilidad de escalamiento: {auditData.ros.probability * 100}%</p>
                      <p style={{ marginTop: '6px' }}>{auditData.ros.justification}</p>
                      <p style={{ marginTop: '6px' }}><strong>Procedimiento:</strong> {auditData.ros.procedure}</p>
                    </div>
                  </>
                )}

                <h3>VII. RECOMENDACIÓN FINAL</h3>
                <div style={{ fontFamily: 'sans-serif', fontSize: '0.9rem', padding: '12px', border: '2px solid #333', borderRadius: '4px' }}>
                  <p style={{ fontWeight: 'bold', fontSize: '1rem', textTransform: 'uppercase' }}>{auditData.recommendation.decision.replace(/_/g, ' ')}</p>
                  <p style={{ marginTop: '8px' }}>{auditData.recommendation.justification}</p>
                  {auditData.recommendation.immediateActions.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <p style={{ fontWeight: '600' }}>Acciones Inmediatas:</p>
                      <ul style={{ paddingLeft: '20px' }}>
                        {auditData.recommendation.immediateActions.map((a, idx) => (
                          <li key={idx}>
                            <strong>{a.accion || a}</strong>
                            {a.plazo && <span style={{ fontSize: '0.85rem', color: '#666' }}> — Plazo: {a.plazo}</span>}
                            {a.responsable && <span style={{ fontSize: '0.85rem', color: '#666' }}> | Responsable: {a.responsable}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {auditData.recommendation.conditions.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <p style={{ fontWeight: '600' }}>Condiciones para Proceder:</p>
                      <ul style={{ paddingLeft: '20px' }}>
                        {auditData.recommendation.conditions.map((c, idx) => <li key={idx}>{c}</li>)}
                      </ul>
                    </div>
                  )}
                  {auditData.recommendation.followUpRequired && (
                    <p style={{ marginTop: '8px', fontWeight: '600', color: '#333' }}>Requiere Seguimiento — Próxima revisión: {auditData.recommendation.nextReview}</p>
                  )}
                </div>

                {auditData.evidence.length > 0 && (
                  <>
                    <h3>VIII. EVIDENCIAS</h3>
                    <div style={{ fontFamily: 'sans-serif', fontSize: '0.9rem' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: '#f0f0f0' }}>
                            <th style={{ padding: '6px', textAlign: 'left', borderBottom: '1px solid #ccc' }}>Tipo</th>
                            <th style={{ padding: '6px', textAlign: 'left', borderBottom: '1px solid #ccc' }}>Descripción</th>
                            <th style={{ padding: '6px', textAlign: 'left', borderBottom: '1px solid #ccc' }}>Fuente</th>
                            <th style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #ccc' }}>Fiabilidad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditData.evidence.map((ev, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                              <td style={{ padding: '6px' }}>{ev.tipo}</td>
                              <td style={{ padding: '6px' }}>{ev.descripcion}</td>
                              <td style={{ padding: '6px', color: '#666' }}>{ev.fuente}</td>
                              <td style={{ padding: '6px', textAlign: 'center', fontWeight: '600', color: ev.fiabilidad === 'alta' ? 'var(--verde)' : ev.fiabilidad === 'media' ? 'var(--amarillo)' : 'var(--rojo)' }}>
                                {ev.fiabilidad}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                <div style={{ marginTop: '20px', padding: '10px', background: '#f8f9fa', borderRadius: '4px', fontFamily: 'sans-serif', fontSize: '0.8rem', color: '#666' }}>
                  <strong>IX. TRAZABILIDAD</strong>
                  <p style={{ marginTop: '4px' }}>
                    Factores evaluados: {auditData.traction.factorsEvaluated.join(', ')} |
                    Señales verificadas: {auditData.traction.signalsChecked} |
                    Señales activadas: {auditData.traction.signalsActivated} |
                    Artículos citados: {auditData.traction.articlesCited} |
                    Metodología: {auditData.traction.methodology}
                  </p>
                </div>
              </div>
            </div>
          )}

      </div>

      <div className="card">
        <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Tag size={20} /> Estado y Etiquetas del Caso
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '15px' }}>
          <div>
            <label style={{ fontSize: '0.9rem', color: 'var(--txt2)', marginBottom: '8px', display: 'block' }}>Estado actual</label>
            <select
              className="input-field"
              value={datos.estado || 'borrador'}
              onChange={(e) => setDatos(prev => ({ ...prev, estado: e.target.value }))}
              style={{ padding: '10px' }}
            >
              {ESTADOS_CASO.map(est => (
                <option key={est.id} value={est.id}>{est.label}</option>
              ))}
            </select>
            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%',
                background: ESTADOS_CASO.find(e => e.id === (datos.estado || 'borrador'))?.color || '#94a3b8'
              }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--txt2)' }}>
                {ESTADOS_CASO.find(e => e.id === (datos.estado || 'borrador'))?.label}
              </span>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.9rem', color: 'var(--txt2)', marginBottom: '8px', display: 'block' }}>Etiquetas</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {TAGS_PREDEFINIDOS.map(tag => {
                const isSelected = (datos.tags || []).includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => {
                      const currentTags = datos.tags || [];
                      const newTags = isSelected
                        ? currentTags.filter(t => t !== tag.id)
                        : [...currentTags, tag.id];
                      setDatos(prev => ({ ...prev, tags: newTags }));
                    }}
                    style={{
                      padding: '6px 12px', borderRadius: '16px', fontSize: '0.8rem',
                      border: '1px solid ' + (isSelected ? tag.color : 'rgba(255,255,255,0.2)'),
                      background: isSelected ? tag.color + '20' : 'transparent',
                      color: isSelected ? tag.color : 'var(--txt2)',
                      cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    {isSelected ? '✓ ' : '+ '}{tag.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.9rem', color: 'var(--txt2)', marginBottom: '8px', display: 'block' }}>Notas internas (no aparecen en el PDF)</label>
          <textarea
            className="input-field"
            rows="3"
            value={datos.notasInternas || ''}
            onChange={(e) => setDatos(prev => ({ ...prev, notasInternas: e.target.value }))}
            placeholder="Notas para uso interno de la notaría..."
          />
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Pen size={20} /> Firmas Digitales
        </h3>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--txt2)', marginBottom: '8px' }}>Notario/a</p>
            {signatureNotario ? (
              <div style={{ border: '1px solid var(--accent)', borderRadius: '8px', padding: '10px', background: 'white' }}>
                <img src={signatureNotario} alt="Firma notario" style={{ width: '100%', height: '80px', objectFit: 'contain' }} />
                <button className="btn btn-secondary" onClick={() => openSignatureModal('notario')} style={{ marginTop: '8px', width: '100%', fontSize: '0.8rem' }}>
                  <Pen size={14} /> Refirmar
                </button>
              </div>
            ) : (
              <button className="btn btn-secondary" onClick={() => openSignatureModal('notario')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Pen size={16} /> Firmar como Notario
              </button>
            )}
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--txt2)', marginBottom: '8px' }}>Oficial de Cumplimiento</p>
            {signatureOficial ? (
              <div style={{ border: '1px solid var(--accent)', borderRadius: '8px', padding: '10px', background: 'white' }}>
                <img src={signatureOficial} alt="Firma oficial" style={{ width: '100%', height: '80px', objectFit: 'contain' }} />
                <button className="btn btn-secondary" onClick={() => openSignatureModal('oficial')} style={{ marginTop: '8px', width: '100%', fontSize: '0.8rem' }}>
                  <Pen size={14} /> Refirmar
                </button>
              </div>
            ) : (
              <button className="btn btn-secondary" onClick={() => openSignatureModal('oficial')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Pen size={16} /> Firmar como Oficial
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
        <button className="btn" onClick={handleExportPDF}>
          <FileText size={18} /> Exportar PDF
        </button>
        <button className="btn" onClick={handleExportExcel} style={{ background: 'var(--verde)' }}>
          <Download size={18} /> Exportar Excel
        </button>
        <button className="btn" onClick={handleExportROS} style={{ background: '#dc2626' }}>
          <AlertTriangle size={18} /> Generar ROS
        </button>
        <button className="btn btn-secondary" onClick={handlePrint}>
          <Printer size={18} /> Imprimir
        </button>
        <button className="btn btn-secondary" onClick={onReset} style={{ marginLeft: 'auto' }}>
          <RefreshCw size={18} /> Nueva Evaluación
        </button>
      </div>

      <SignatureModal
        isOpen={sigModalOpen}
        onClose={() => setSigModalOpen(false)}
        onSave={handleSaveSignature}
        title={sigModalRole === 'notario' ? 'Firma del Notario' : 'Firma del Oficial de Cumplimiento'}
      />
    </div>
  );
};
