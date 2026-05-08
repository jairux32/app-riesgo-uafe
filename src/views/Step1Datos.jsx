import React, { useRef, useEffect, useState } from 'react';
import { Upload, Loader, UserCheck, Shield, Search, ExternalLink, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { parseUAFEExcel } from '../utils/excelParser';
import { saveCase, getAllCases } from '../utils/storage';
import { useAuth } from '../context/AuthContext';
import { getNotaryProfile } from '../firebase/profileStore';
import { validarIdentificacion } from '../utils/validators';
import { verificarListasRestrictivas, verificarDocumentoUAFE, getEstadoVerificacionStyle } from '../utils/sanctionsCheck';
import { PROVINCIAS_ECUADOR, cargarCatalogo } from '../data/constants';

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
  const [cantones, setCantones] = useState([]);
  const [parroquias, setParroquias] = useState([]);
  const [nacionalidades, setNacionalidades] = useState([]);
  const [actividades, setActividades] = useState([]);
  const [catalogosCargados, setCatalogosCargados] = useState(false);

  // Cargar catálogos UAFE
  useEffect(() => {
    const loadCatalogs = async () => {
      const [cant, parr, nac, act] = await Promise.all([
        cargarCatalogo('cantones'),
        cargarCatalogo('parroquias'),
        cargarCatalogo('nacionalidades'),
        cargarCatalogo('actividades')
      ]);
      setCantones(cant);
      setParroquias(parr);
      setNacionalidades(nac);
      setActividades(act);
      setCatalogosCargados(true);
    };
    loadCatalogs();
  }, []);

  // Filtrar cantones cuando cambia provincia
  useEffect(() => {
    if (datos.provincia && cantones.length > 0) {
      const provCode = datos.provincia.substring(0, 2);
      const filtered = cantones.filter(c => c.codigo.startsWith(provCode));
      // No resetear cantón si ya está en la lista filtrada
      const cantonValido = filtered.some(c => c.canton === datos.canton);
      if (!cantonValido) {
        setDatos(prev => ({ ...prev, canton: '', parroquia: '' }));
      }
    }
  }, [datos.provincia, cantones]);

  // Filtrar parroquias cuando cambia cantón
  useEffect(() => {
    if (datos.canton && parroquias.length > 0) {
      const cantonObj = cantones.find(c => c.canton === datos.canton);
      if (cantonObj) {
        const filtered = parroquias.filter(p => p.codigo.startsWith(cantonObj.codigo));
        const parroquiaValida = filtered.some(p => p.parroquia === datos.parroquia);
        if (!parroquiaValida) {
          setDatos(prev => ({ ...prev, parroquia: '' }));
        }
      }
    }
  }, [datos.canton, parroquias, cantones]);

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
    <div className="flex flex-col gap-4 page-transition">
      {/* ===== CARD 1: Datos Básicos ===== */}
      <div className="card">
        <div className="flex justify-between items-center flex-wrap gap-3" style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 style={{ margin: 0 }}>Paso 1: Datos del Caso Notarial</h2>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? <><Loader size={14} className="spin" /> Importando...</> : <><Upload size={14} /> Importar Excel</>}
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
          <div className="flex items-center justify-center gap-4 text-sm" style={{ marginBottom: '16px', padding: '10px', background: 'var(--bg-input)', borderRadius: '8px' }}>
            <span className="flex items-center gap-1" style={{ color: 'var(--verde)' }}><CheckCircle size={14} /> Importados: {importStats.imported}</span>
            <span className="flex items-center gap-1" style={{ color: 'var(--amarillo)' }}><AlertTriangle size={14} /> Inválidos: {importStats.invalid}</span>
            <span className="flex items-center gap-1" style={{ color: 'var(--rojo)' }}><XCircle size={14} /> Errores: {importStats.error}</span>
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
            <label>Cliente / Razón Social</label>
            <input type="text" className="input-field" name="cliente" value={datos.cliente} onChange={handleChange} placeholder="Escriba para buscar en historial..." />
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
              <p className="text-xs flex items-center gap-1 mt-2" style={{ color: validacionCedula.valido ? 'var(--verde)' : 'var(--rojo)' }}>
                <span>{validacionCedula.valido ? <CheckCircle size={12} /> : <XCircle size={12} />}</span>
                {validacionCedula.mensaje}
                {validacionCedula.tipo && <span className="text-muted" style={{ marginLeft: '4px' }}>({validacionCedula.tipo})</span>}
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
              <p className="text-sm text-muted mt-2">
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
      </div>

      {/* ===== CARD 2: Datos Complementarios ROS ===== */}
      <div className="card">
        <h3 style={{ fontSize: '1.05rem', marginBottom: '16px' }}>Datos Complementarios para ROS</h3>

        <div className="grid-2">
          <div className="form-group">
            <label>Tipo de Persona</label>
            <select className="input-field" name="tipoPersona" value={datos.tipoPersona} onChange={handleChange}>
              <option value="natural">Persona Natural</option>
              <option value="juridica">Persona Jurídica</option>
            </select>
          </div>
          <div className="form-group">
            <label>Nacionalidad</label>
            <select className="input-field" name="nacionalidad" value={datos.nacionalidad} onChange={handleChange}>
              {nacionalidades.length > 0 ? (
                nacionalidades.map(n => (
                  <option key={n.codigo} value={n.codigo}>{n.nombre}</option>
                ))
              ) : (
                <option value="ECU">ECUADOR</option>
              )}
            </select>
          </div>

          <div className="form-group">
            <label>Provincia</label>
            <select className="input-field" name="provincia" value={datos.provincia} onChange={handleChange}>
              <option value="">-- Seleccione --</option>
              {PROVINCIAS_ECUADOR.map(p => (
                <option key={p.codigo} value={p.codigo}>{p.nombre}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Cantón</label>
            <select className="input-field" name="canton" value={datos.canton} onChange={handleChange} disabled={!datos.provincia || cantones.length === 0}>
              <option value="">-- Seleccione --</option>
              {cantones.filter(c => datos.provincia && c.codigo.startsWith(datos.provincia.substring(0, 2))).map(c => (
                <option key={c.codigo} value={c.canton}>{c.canton}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Parroquia</label>
            <select className="input-field" name="parroquia" value={datos.parroquia} onChange={handleChange} disabled={!datos.canton || parroquias.length === 0}>
              <option value="">-- Seleccione --</option>
              {(() => {
                const cantonObj = cantones.find(c => c.canton === datos.canton);
                if (!cantonObj) return null;
                return parroquias.filter(p => p.codigo.startsWith(cantonObj.codigo)).map(p => (
                  <option key={p.codigo} value={p.parroquia}>{p.parroquia}</option>
                ));
              })()}
            </select>
          </div>
          <div className="form-group">
            <label>Actividad Económica Secundaria</label>
            <input type="text" className="input-field" name="actividadSecundaria" value={datos.actividadSecundaria} onChange={handleChange} placeholder="Opcional" />
          </div>

          {datos.tipoPersona === 'natural' && (
            <>
              <div className="form-group">
                <label>Ingreso Mensual Aprox. (USD)</label>
                <input type="number" className="input-field" name="ingresoMensual" value={datos.ingresoMensual} onChange={handleChange} min="0" />
              </div>
              <div className="form-group">
                <label>Estado Civil</label>
                <select className="input-field" name="estadoCivil" value={datos.estadoCivil} onChange={handleChange}>
                  <option value="">-- Seleccione --</option>
                  <option value="soltero">Soltero/a</option>
                  <option value="casado">Casado/a</option>
                  <option value="divorciado">Divorciado/a</option>
                  <option value="viudo">Viudo/a</option>
                  <option value="union_libre">Unión Libre</option>
                </select>
              </div>
            </>
          )}

          {datos.tipoPersona === 'juridica' && (
            <>
              <div className="form-group">
                <label>Ingreso Anual Aprox. (USD)</label>
                <input type="number" className="input-field" name="ingresoAnual" value={datos.ingresoAnual} onChange={handleChange} min="0" />
              </div>
              <div className="form-group">
                <label>Fecha de Constitución</label>
                <input type="date" className="input-field" name="fechaConstitucion" value={datos.fechaConstitucion} onChange={handleChange} />
              </div>
            </>
          )}
        </div>

        {datos.tipoPersona === 'natural' && datos.estadoCivil === 'casado' && (
          <div className="mt-4" style={{ padding: '12px 14px', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
            <h4 className="text-sm text-muted mb-2">Información del Cónyuge</h4>
            <div className="grid-2">
              <div className="form-group">
                <label>Nombre del Cónyuge</label>
                <input type="text" className="input-field" value={datos.conyuge.nombre} onChange={(e) => setDatos(prev => ({ ...prev, conyuge: { ...prev.conyuge, nombre: e.target.value } }))} />
              </div>
              <div className="form-group">
                <label>Cédula del Cónyuge</label>
                <input type="text" className="input-field" value={datos.conyuge.cedula} onChange={(e) => setDatos(prev => ({ ...prev, conyuge: { ...prev.conyuge, cedula: e.target.value } }))} />
              </div>
            </div>
          </div>
        )}

        {datos.tipoPersona === 'juridica' && (
          <div className="mt-4" style={{ padding: '12px 14px', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
            <h4 className="text-sm text-muted mb-2">Representante Legal</h4>
            <div className="grid-2">
              <div className="form-group">
                <label>Nombre</label>
                <input type="text" className="input-field" value={datos.representanteLegal.nombre} onChange={(e) => setDatos(prev => ({ ...prev, representanteLegal: { ...prev.representanteLegal, nombre: e.target.value } }))} />
              </div>
              <div className="form-group">
                <label>Cédula</label>
                <input type="text" className="input-field" value={datos.representanteLegal.cedula} onChange={(e) => setDatos(prev => ({ ...prev, representanteLegal: { ...prev.representanteLegal, cedula: e.target.value } }))} />
              </div>
            </div>
          </div>
        )}

        <div className="grid-2 mt-4">
          <div className="form-group">
            <label>Fecha de la Transacción</label>
            <input type="date" className="input-field" name="fechaTransaccion" value={datos.fechaTransaccion} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Tipo de Transacción</label>
            <select className="input-field" name="tipoTransaccion" value={datos.tipoTransaccion} onChange={handleChange}>
              <option value="">-- Seleccione --</option>
              <option value="compraventa">Compraventa</option>
              <option value="donacion">Donación</option>
              <option value="hipoteca">Hipoteca / Cancelación</option>
              <option value="poder">Poder / Mandato</option>
              <option value="constitucion">Constitución de Compañía</option>
              <option value="fideicomiso">Fideicomiso</option>
              <option value="otra">Otra</option>
            </select>
          </div>
        </div>
      </div>

      {/* ===== CARD 3: Forma de Pago y Banderas ===== */}
      <div className="card">
        <h3 style={{ fontSize: '1.05rem', marginBottom: '12px' }}>Forma de Pago</h3>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
            <input type="checkbox" name="usoEfectivo" checked={datos.usoEfectivo} onChange={handleChange} />
            ¿Usó efectivo?
          </label>
          {datos.usoEfectivo && (
            <div className="form-group" style={{ paddingLeft: '26px' }}>
              <label>Monto en efectivo (USD)</label>
              <input type="number" className="input-field" name="montoEfectivo" value={datos.montoEfectivo} onChange={handleChange} min="0" />
            </div>
          )}
          <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
            <input type="checkbox" name="billetesAltaDenominacion" checked={datos.billetesAltaDenominacion} onChange={handleChange} />
            ¿Billetes de alta denominación?
          </label>
          {datos.billetesAltaDenominacion && (
            <div className="form-group" style={{ paddingLeft: '26px' }}>
              <label>Monto en billetes alta denom. (USD)</label>
              <input type="number" className="input-field" name="montoBilletesAlta" value={datos.montoBilletesAlta} onChange={handleChange} min="0" />
            </div>
          )}
          <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
            <input type="checkbox" name="usoActivosVirtuales" checked={datos.usoActivosVirtuales} onChange={handleChange} />
            ¿Usó activos virtuales?
          </label>
          {datos.usoActivosVirtuales && (
            <div className="form-group" style={{ paddingLeft: '26px' }}>
              <label>Tipo de activo virtual</label>
              <input type="text" className="input-field" name="tipoActivoVirtual" value={datos.tipoActivoVirtual} onChange={handleChange} placeholder="Ej: Bitcoin" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 mt-4">
          <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
            <input type="checkbox" name="antecedentesPenales" checked={datos.antecedentesPenales} onChange={handleChange} />
            ¿Tiene antecedentes penales o judiciales?
          </label>
          <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
            <input type="checkbox" name="registradoInterpolONUOFAC" checked={datos.registradoInterpolONUOFAC} onChange={handleChange} />
            ¿Registrado en INTERPOL, ONU u OFAC?
          </label>
        </div>

        <hr className="section-divider" />

        <h3 style={{ fontSize: '1.05rem', marginBottom: '12px' }}>Banderas de Riesgo</h3>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
            <input type="checkbox" name="esPep" checked={datos.esPep} onChange={handleChange} />
            ¿El cliente es PEP (Persona Expuesta Políticamente)?
          </label>
          {datos.esPep && (
            <div className="form-group" style={{ paddingLeft: '26px' }}>
              <label style={{ color: 'var(--accent)' }}>Detalle obligatorio de la condición PEP:</label>
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
          <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
            <input type="checkbox" name="apoderado" checked={datos.apoderado} onChange={handleChange} />
            ¿Actúa mediante apoderado?
          </label>
          <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
            <input type="checkbox" name="reportesPrevios" checked={datos.reportesPrevios} onChange={handleChange} />
            ¿Tiene reportes previos ante la UAFE?
          </label>
        </div>
      </div>

      {/* ===== CARD 4: Verificaciones ===== */}
      <div className="card">
        <div className="flex justify-between items-center flex-wrap gap-3" style={{ marginBottom: '12px' }}>
          <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Verificación en Listas Restrictivas</h3>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleVerificarListas}
            disabled={verificando || !datos.cliente}
          >
            {verificando ? <><Loader size={12} className="spin" /> Verificando...</> : <><Search size={12} /> Verificar Ahora</>}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          {[
            { key: 'ofac', label: 'OFAC', url: 'https://sanctionssearch.ofac.treas.gov/' },
            { key: 'onu', label: 'ONU', url: 'https://www.un.org/securitycouncil/content/un-sc-consolidated-list' },
            { key: 'uafe', label: 'UAFE Ecuador', url: 'https://www.uafe.gob.ec' },
          ].map(({ key, label, url }) => {
            const verif = datos.verificaciones?.[key] || { estado: 'pendiente' };
            const style = getEstadoVerificacionStyle(verif.estado);
            return (
              <div key={key} style={{
                padding: '10px', background: style.bg, borderRadius: '8px',
                border: `1px solid ${style.color}20`
              }}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm" style={{ fontWeight: '600', color: style.color }}>{style.icon} {label}</span>
                  <span className="text-xs" style={{ color: style.color, fontWeight: '500' }}>{style.label}</span>
                </div>
                {verif.resultado && (
                  <p className="text-xs text-muted" style={{ lineHeight: '1.3' }}>{verif.resultado}</p>
                )}
                {verif.coincidencias?.length > 0 && (
                  <div className="mt-1" style={{ padding: '4px 6px', background: 'rgba(0,0,0,0.15)', borderRadius: '4px' }}>
                    {verif.coincidencias.slice(0, 2).map((coin, i) => (
                      <div key={i} className="text-xs flex justify-between" style={{ color: style.color }}>
                        <span>{coin.nombre}</span>
                        <span>{coin.confianza}%</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between items-center mt-2">
                  {verif.fecha && (
                    <span className="text-xs text-muted">{new Date(verif.fecha).toLocaleDateString('es-EC')}</span>
                  )}
                  <button className="btn-ghost" onClick={() => window.open(url, '_blank')}>
                    <ExternalLink size={10} /> Consultar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== CARD 5: Observaciones y Siguiente ===== */}
      <div className="card">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Observaciones generales</label>
          <textarea className="input-field" name="observaciones" value={datos.observaciones} onChange={handleChange} rows="3" placeholder="Añada cualquier información relevante..."></textarea>
        </div>
        <div className="flex justify-end mt-4">
          <button className="btn" onClick={onNext} disabled={!isComplete}>
            Siguiente Paso
          </button>
        </div>
      </div>
    </div>
  );
};
