import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import { Bot, FileText, Download, Save, RefreshCw, AlertTriangle } from 'lucide-react';
import { marked } from 'marked';
import { exportToPDF, exportToExcel } from '../utils/exportUtils';
import { buildPrompt, analizarConGemini } from '../utils/geminiApi';

export const Step4Analisis = ({ 
  datos, scores, controlesResult, factoresResult, 
  onReset 
}) => {
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

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
    try {
      await exportToPDF(datos, scores, factoresResult, controlesResult, analysisResult);
    } catch (err) {
      console.error("Error exportando PDF:", err);
    }
  };

  const handleExportExcel = async () => {
    try {
      await exportToExcel(datos, scores, factoresResult, controlesResult, analysisResult);
    } catch (err) {
      console.error("Error exportando Excel:", err);
    }
  };

  const renderMarkdown = (text) => {
    if (!text) return { __html: '' };
    const rawHtml = marked.parse(text);
    return { __html: DOMPurify.sanitize(rawHtml) };
  };

  return (
    <div>
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


      <div className="card">
        <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent)' }}>
          <Bot size={24} /> Análisis de IA (Gemini)
        </h2>

        {!analysisResult && !isLoading && (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <p style={{ color: 'var(--txt2)', marginBottom: '20px' }}>Genera un dictamen jurídico y detección de señales de alerta automatizado.</p>
            <button className="btn" onClick={handleGenerateIA} style={{ fontSize: '1.1rem', padding: '12px 24px' }}>
              <Bot size={20} /> Generar Análisis con IA
            </button>
            <p style={{ fontSize: '0.8rem', color: 'var(--txt2)', marginTop: '10px' }}>
              Modelo gratuito: gemini-2.5-flash | Consume ~2000 tokens
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
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
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

          {analysisResult && (
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
                dangerouslySetInnerHTML={renderMarkdown(analysisResult)}
              />
            </div>
          )}

      </div>

      <div className="card" style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
        <button className="btn" onClick={handleExportPDF}>
          <FileText size={18} /> Exportar PDF
        </button>
        <button className="btn" onClick={handleExportExcel} style={{ background: 'var(--verde)' }}>
          <Download size={18} /> Exportar Excel
        </button>
        <button className="btn btn-secondary" onClick={onReset} style={{ marginLeft: 'auto' }}>
          <RefreshCw size={18} /> Nueva Evaluación
        </button>
      </div>
    </div>
  );
};
