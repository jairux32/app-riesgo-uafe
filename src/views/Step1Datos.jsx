import React, { useRef, useEffect, useState } from 'react';
import { Upload, Loader, UserCheck, Shield, Search, ExternalLink, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { parseUAFEExcel } from '../utils/excelParser';
import { saveCase, getAllCases } from '../utils/storage';
import { useAuth } from '../context/AuthContext';
import { getNotaryProfile } from '../firebase/profileStore';
import { validarIdentificacion } from '../utils/validators';
import { verificarListasRestrictivas, verificarDocumentoUAFE, getEstadoVerificacionStyle } from '../utils/sanctionsCheck';

export const Step1Datos = ({ datos, setDatos, setEvaluaciones, setControlesEval, onNext }) => {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importStats, setImportStats] = useState(null);
  const [clientHistory, setClientHistory] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const suggestionsRef = useRef(null);
  const [validacionCedula, setValidacionCedula] = useState(null);
  const [verificando, setVerificando] = useState(false);

  // Cargar clientes únicos del historial
  useEffect(() => {
    const loadClientHistory = async () => {
      const cases = await getAllCases();
      const uniqueClients = new Map();
      cases.forEach(c => {
        if (c.datos?.cedula && !uniqueClients.has(c.datos.cedula)) {
          uniqueClients.set(c.datos.cedula, c.datos);
        }
      });
      setClientHistory(Array.from(uniqueClients.values()));
    };
    loadClientHistory();
  }, []);

  // Cerrar sugerencias al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user || datos.notaria) return;
      const profile = await getNotaryProfile(user.uid);
      if (profile) {
        setDatos(prev => ({
          ...prev,
          notaria: profile.notaria || '',
          notario: profile.notario || ''
        }));
      }
    };
    loadProfile();
  }, [user]);
  // Plantillas por tipo de acto
  const applyTemplate = (acto) => {
    const templates = {
      'Compraventa inmueble': { valor: 50000, medioPago: 'Transferencia', origen: 'Venta de bienes / Ahorro', actividad: 'Comerciante / Profesional' },
      'Constitución compañía': { valor: 25000, medioPago: 'Transferencia', origen: 'Capital inicial / Inversión', actividad: 'Empresario' },
      'Poder especial': { valor: 0, medioPago: 'N/A', origen: 'N/A', actividad: 'Varía según cliente' },
      'Fideicomiso': { valor: 100000, medioPago: 'Transferencia', origen: 'Patrimonio / Inversión', actividad: 'Inversionista' },
      'Declaración juramentada': { valor: 0, medioPago: 'N/A', origen: 'N/A', actividad: 'Varía según cliente' },
      'Otro': { valor: 0, medioPago: '', origen: '', actividad: '' }
    };
    return templates[acto] || {};
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setDatos(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Plantilla: si cambia el acto, pre-llenar datos típicos
    if (name === 'acto' && value) {
      const template = applyTemplate(value);
      setDatos(prev => ({
        ...prev,
        acto: value,
        valor: template.valor || prev.valor,
        medioPago: template.medioPago || prev.medioPago,
        origen: template.origen || prev.origen,
        actividad: template.actividad || prev.actividad,
      }));
      toast('Plantilla cargada para ' + value, { icon: '📋', duration: 2000 });
    }

    // Validar cédula en tiempo real
    if (name === 'cedula') {
      const resultado = validarIdentificacion(value);
      setValidacionCedula(resultado);
    }

    // Autocompletar: buscar sugerencias al escribir en cliente o cédula
    if ((name === 'cliente' || name === 'cedula') && value.trim().length >= 2 && clientHistory.length > 0) {
      const term = value.toLowerCase();
      const matches = clientHistory.filter(c =>
        (c.cliente || '').toLowerCase().includes(term) ||
        (c.cedula || '').toLowerCase().includes(term)
      ).slice(0, 5);
      setSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSelectClient = (clientData) => {
    setDatos(prev => ({
      ...prev,
      cliente: clientData.cliente || prev.cliente,
      cedula: clientData.cedula || prev.cedula,
      actividad: clientData.actividad || prev.actividad,
      esPep: clientData.esPep || false,
      detallePep: clientData.detallePep || '',
      apoderado: clientData.apoderado || false,
      reportesPrevios: clientData.reportesPrevios || false,
      origen: clientData.origen || prev.origen,
      medioPago: clientData.medioPago || prev.medioPago,
    }));
    setShowSuggestions(false);
    toast.success(`Cliente ${clientData.cliente} cargado desde historial`, { icon: '👤' });
  };

  const handleVerificarListas = async () => {
    if (!datos.cliente || datos.cliente.trim().length < 3) {
      toast.error('Ingrese el nombre del cliente para verificar');
      return;
    }
    setVerificando(true);
    try {
      const resultados = await verificarListasRestrictivas(datos.cliente, 'todos');
      const docResult = datos.cedula ? await verificarDocumentoUAFE(datos.cedula) : null;

      setDatos(prev => ({
        ...prev,
        verificaciones: {
          ofac: {
            estado: resultados.ofac?.estado || 'error',
            fecha: resultados.ofac?.fecha,
            resultado: resultados.ofac?.mensaje,
            coincidencias: resultados.ofac?.coincidencias || []
          },
          onu: {
            estado: resultados.onu?.estado || 'error',
            fecha: resultados.onu?.fecha,
            resultado: resultados.onu?.mensaje,
            coincidencias: resultados.onu?.coincidencias || []
          },
          uafe: {
            estado: docResult ? docResult.estado : (resultados.uafe?.estado || 'error'),
            fecha: docResult ? docResult.fecha : resultados.uafe?.fecha,
            resultado: docResult ? docResult.mensaje : resultados.uafe?.mensaje,
            coincidencias: resultados.uafe?.coincidencias || []
          }
        }
      }));

      const hayAlerta = Object.values(resultados).some(r => r.estado === 'coincidencia' || r.estado === 'alerta');
      const hayPosible = Object.values(resultados).some(r => r.estado === 'posible');
      
      if (hayAlerta) {
        toast.error('¡ALERTA! Se encontraron coincidencias en listas restrictivas', { duration: 6000 });
      } else if (hayPosible) {
        toast('Se encontraron posibles coincidencias - Requiere revisión manual', { icon: '⚠️', duration: 5000 });
      } else {
        toast.success('Verificación completada: Sin coincidencias encontradas');
      }
    } catch (err) {
      toast.error('Error en verificación: ' + err.message);
    } finally {
      setVerificando(false);
    }
  };

  const isComplete = 
    datos.notaria?.trim() && 
    datos.notario?.trim() && 
    datos.cliente?.trim() && 
    validacionCedula?.valido && 
    datos.acto && 
    datos.valor >= 0 &&
    (!datos.esPep || (datos.esPep && datos.detallePep?.trim()));

  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setImporting(true);
    setImportStats(null);
    
    try {
      const cases = await parseUAFEExcel(file);
      if (cases.length === 0) {
        toast.error('No se encontraron registros válidos en el archivo Excel.');
        setImporting(false);
        return;
      }

      const imported = [];
      const skipped = { invalid: 0, duplicate: 0, error: 0 };

      for (let i = 0; i < cases.length; i++) {
        const caso = cases[i];
        
        // Validar datos mínimos por caso
        if (!caso.datos.cedula || !caso.datos.cliente) {
          skipped.invalid++;
          continue;
        }

        try {
          await saveCase({
            datos: caso.datos,
            evaluaciones: caso.evaluaciones,
            controlesEval: caso.controlesEval
          });
          imported.push(caso);
        } catch (err) {
          skipped.error++;
        }
      }

      if (imported.length > 0) {
        setDatos(imported[0].datos);
        setEvaluaciones(imported[0].evaluaciones || {});
        setControlesEval(imported[0].controlesEval || {});
      }

      setImportStats({
        total: cases.length,
        imported: imported.length,
        invalid: skipped.invalid,
        error: skipped.error
      });

      toast.success(
        `Importados: ${imported.length} | Inválidos: ${skipped.invalid} | Errores: ${skipped.error}`,
        { duration: 5000 }
      );
    } catch (err) {
      toast.error('Error al procesar el archivo Excel: ' + err.message);
    } finally {
      setImporting(false);
    }
    e.target.value = '';
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #30363d' }}>
        <h2>Paso 1: Datos del Caso Notarial</h2>
        <button 
          className="btn btn-secondary" 
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {importing ? <><Loader size={16} className="spin" /> Importando...</> : <><Upload size={16} /> Importar Excel</>}
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImportExcel}
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
        />
      </div>

      {importStats && (
        <div style={{ marginBottom: '15px', padding: '12px', background: 'var(--bg-input)', borderRadius: '8px', display: 'flex', gap: '20px', justifyContent: 'center', fontSize: '0.9rem' }}>
          <span style={{ color: 'var(--verde)' }}>✅ Importados: {importStats.imported}</span>
          <span style={{ color: 'var(--amarillo)' }}>⚠️ Inválidos: {importStats.invalid}</span>
          <span style={{ color: 'var(--rojo)' }}>❌ Errores: {importStats.error}</span>
        </div>
      )}


      <div className="grid-2">
        <div className="form-group">
          <label>Notaría</label>
          <input type="text" className="input-field" name="notaria" value={datos.notaria} onChange={handleChange} placeholder="Ej: Notaría Primera de Quito" />
        </div>
        <div className="form-group">
          <label>Notario/a</label>
          <input type="text" className="input-field" name="notario" value={datos.notario} onChange={handleChange} placeholder="Nombre del notario" />
        </div>
        
        <div className="form-group" style={{ position: 'relative' }} ref={suggestionsRef}>
          <label>Cliente (o Razón Social)</label>
          <input type="text" className="input-field" name="cliente" value={datos.cliente} onChange={handleChange} placeholder="Empiece a escribir para buscar en el historial..." />
          {showSuggestions && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
              background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', marginTop: '4px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              maxHeight: '200px', overflowY: 'auto'
            }}>
              {suggestions.map((client, i) => (
                <div
                  key={i}
                  onClick={() => handleSelectClient(client)}
                  style={{
                    padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <UserCheck size={16} color="var(--accent)" />
                  <div>
                    <div style={{ fontWeight: '500', fontSize: '0.9rem' }}>{client.cliente}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--txt2)' }}>{client.cedula} {client.actividad ? `• ${client.actividad}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="form-group">
          <label>Cédula / RUC / Pasaporte</label>
           <input
             type="text"
             className={`input-field ${validacionCedula ? (validacionCedula.valido ? 'border-verde' : 'border-rojo') : ''}`}
             name="cedula"
             value={datos.cedula}
             onChange={handleChange}
             placeholder="Ej: 1712345678001"
           />
           {validacionCedula && (
             <p style={{
               fontSize: '0.8rem',
               marginTop: '6px',
               color: validacionCedula.valido ? 'var(--verde)' : 'var(--rojo)',
               display: 'flex',
               alignItems: 'center',
               gap: '4px'
             }}>
               {validacionCedula.valido ? '✅' : '❌'} {validacionCedula.mensaje}
               {validacionCedula.tipo && <span style={{ color: 'var(--txt2)', marginLeft: '4px' }}>({validacionCedula.tipo})</span>}
             </p>
           )}
        </div>

        <div className="form-group">
          <label>Tipo de acto notarial</label>
          <select className="input-field" name="acto" value={datos.acto} onChange={handleChange}>
            <option value="">-- Seleccione --</option>
            <option value="Compraventa inmueble">Compraventa inmueble</option>
            <option value="Constitución compañía">Constitución compañía</option>
            <option value="Poder especial">Poder especial</option>
            <option value="Fideicomiso">Fideicomiso</option>
            <option value="Declaración juramentada">Declaración juramentada</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
        <div className="form-group">
          <label>Valor de la operación (USD)</label>
           <input type="number" className="input-field" name="valor" value={datos.valor} onChange={handleChange} min="0" />
           {datos.valor > 0 && (
             <p style={{ fontSize: '0.85rem', color: 'var(--txt2)', marginTop: '6px' }}>
               {new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(datos.valor)}
             </p>
           )}
        </div>

        <div className="form-group">
          <label>Origen declarado de los fondos</label>
          <input type="text" className="input-field" name="origen" value={datos.origen} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Medio de pago</label>
          <select className="input-field" name="medioPago" value={datos.medioPago} onChange={handleChange}>
            <option value="">-- Seleccione --</option>
            <option value="Efectivo">Efectivo</option>
            <option value="Transferencia">Transferencia</option>
            <option value="Cheque">Cheque</option>
            <option value="Mixto">Mixto</option>
            <option value="N/A">N/A</option>
          </select>
        </div>

        <div className="form-group">
          <label>Actividad económica del cliente</label>
          <input type="text" className="input-field" name="actividad" value={datos.actividad} onChange={handleChange} />
        </div>
      </div>

      <div style={{ marginTop: '20px', padding: '15px', background: 'var(--bg-input)', borderRadius: '8px' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '15px' }}>Banderas de Riesgo</h3>
        
        <div className="grid-2">
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <input type="checkbox" name="esPep" checked={datos.esPep} onChange={handleChange} />
            ¿El cliente es PEP (Persona Expuesta Políticamente)?
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <input type="checkbox" name="apoderado" checked={datos.apoderado} onChange={handleChange} />
            ¿Actúa mediante apoderado?
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <input type="checkbox" name="reportesPrevios" checked={datos.reportesPrevios} onChange={handleChange} />
            ¿Tiene reportes previos ante la UAFE conocidos?
          </label>
        </div>

        {datos.esPep && (
          <div className="form-group" style={{ marginTop: '15px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--accent)', marginBottom: '8px' }}>Detalle obligatorio de la condición PEP:</label>
            <input
              type="text"
              className={`input-field ${!datos.detallePep ? 'border-rojo' : ''}`}
              name="detallePep"
              value={datos.detallePep || ''}
              onChange={handleChange}
              placeholder="Ej: Ex-Ministro de Salud (2020-2022)"
            />
          </div>
        )}
      </div>

      <div style={{ marginTop: '20px', padding: '15px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={18} color="var(--accent)" /> Verificación en Listas Restrictivas
          </h3>
          <button
            className="btn"
            style={{ fontSize: '0.8rem', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={handleVerificarListas}
            disabled={verificando || !datos.cliente}
          >
            {verificando ? <><Loader size={14} className="spin" /> Verificando...</> : <><Search size={14} /> Verificar Ahora</>}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
          {[
            { key: 'ofac', label: 'OFAC', url: 'https://sanctionssearch.ofac.treas.gov/' },
            { key: 'onu', label: 'ONU', url: 'https://www.un.org/securitycouncil/content/un-sc-consolidated-list' },
            { key: 'uafe', label: 'UAFE Ecuador', url: 'https://www.uafe.gob.ec' },
          ].map(({ key, label, url }) => {
            const verif = datos.verificaciones?.[key] || { estado: 'pendiente' };
            const style = getEstadoVerificacionStyle(verif.estado);
            return (
              <div key={key} style={{
                padding: '12px', background: style.bg, borderRadius: '8px',
                border: `1px solid ${style.color}30`, transition: 'all 0.2s'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: style.color }}>{style.icon} {label}</span>
                  <span style={{ fontSize: '0.75rem', color: style.color, fontWeight: '500' }}>{style.label}</span>
                </div>
                {verif.resultado && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--txt2)', marginBottom: '6px', lineHeight: '1.4' }}>
                    {verif.resultado}
                  </p>
                )}
                {verif.coincidencias?.length > 0 && (
                  <div style={{ marginTop: '6px', padding: '6px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--txt2)', marginBottom: '4px' }}>Coincidencias:</p>
                    {verif.coincidencias.slice(0, 2).map((coin, i) => (
                      <div key={i} style={{ fontSize: '0.75rem', color: style.color, display: 'flex', justifyContent: 'space-between' }}>
                        <span>{coin.nombre}</span>
                        <span>{coin.confianza}%</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                  {verif.fecha && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--txt2)' }}>
                      {new Date(verif.fecha).toLocaleDateString('es-EC')}
                    </span>
                  )}
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '0.7rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => window.open(url, '_blank')}
                  >
                    <ExternalLink size={12} /> Consultar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="form-group" style={{ marginTop: '20px' }}>
        <label>Observaciones generales</label>
        <textarea className="input-field" name="observaciones" value={datos.observaciones} onChange={handleChange} rows="3" placeholder="Añada cualquier información relevante..."></textarea>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
        <button className="btn" onClick={onNext} disabled={!isComplete}>
          Siguiente Paso
        </button>
      </div>
    </div>
  );
};
