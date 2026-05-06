import React, { useRef, useEffect, useState } from 'react';
import { Upload, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import { parseUAFEExcel } from '../utils/excelParser';
import { saveCase } from '../utils/storage';
import { useAuth } from '../context/AuthContext';
import { getNotaryProfile } from '../firebase/profileStore';

export const Step1Datos = ({ datos, setDatos, setEvaluaciones, setControlesEval, onNext }) => {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importStats, setImportStats] = useState(null);

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
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setDatos(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const isComplete = 
    datos.notaria?.trim() && 
    datos.notario?.trim() && 
    datos.cliente?.trim() && 
    datos.cedula?.trim().length >= 10 && 
    datos.acto && 
    datos.valor > 0 &&
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
        
        <div className="form-group">
          <label>Cliente (o Razón Social)</label>
          <input type="text" className="input-field" name="cliente" value={datos.cliente} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Cédula / RUC / Pasaporte</label>
           <input type="text" className="input-field" name="cedula" value={datos.cedula} onChange={handleChange} placeholder="Ej: 1712345678001" />

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

      <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #30363d', borderRadius: '8px' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '15px' }}>Verificaciones en Listas Restrictivas</h3>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <input type="checkbox" name="ofac" checked={datos.ofac} onChange={handleChange} /> OFAC
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <input type="checkbox" name="onu" checked={datos.onu} onChange={handleChange} /> ONU
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <input type="checkbox" name="pepUafe" checked={datos.pepUafe} onChange={handleChange} /> PEP UAFE
          </label>
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
