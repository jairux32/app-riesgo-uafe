import React, { useState } from 'react';
import { HelpCircle, X, FileSpreadsheet, PlayCircle, Download } from 'lucide-react';

export const HelpModal = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button className="btn btn-secondary" onClick={() => setIsOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <HelpCircle size={16} /> Ayuda
      </button>

      {isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="card" style={{ width: '700px', maxWidth: '90%', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>Guía de Uso del Sistema</h2>
              <button className="btn btn-secondary" onClick={() => setIsOpen(false)}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
              <section>
                <h3 style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileSpreadsheet size={20} /> 1. Importación de Datos
                </h3>
                <p style={{ color: 'var(--txt2)', fontSize: '0.95rem' }}>
                  En el <b>Paso 1</b>, utiliza el botón "Importar Excel". El sistema leerá el archivo de la UAFE, 
                  mapeará los datos automáticamente y guardará todos los registros en el historial local.
                </p>
              </section>

              <section>
                <h3 style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FolderOpen size={20} /> 2. Gestión del Historial
                </h3>
                <p style={{ color: 'var(--txt2)', fontSize: '0.95rem' }}>
                  Haz clic en "Historial" para ver todos tus casos. Puedes cargar un caso específico para analizarlo 
                  o seleccionar múltiples casos para realizar un análisis masivo.
                </p>
              </section>

              <section>
                <h3 style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <PlayCircle size={20} /> 3. Análisis por Lotes (Batch)
                </h3>
                <p style={{ color: 'var(--txt2)', fontSize: '0.95rem' }}>
                  En el historial, selecciona los casos deseados y haz clic en "Analizar Casos". 
                  La IA procesará cada caso secuencialmente y guardará los dictámenes jurídicos automáticamente.
                </p>
              </section>

              <section>
                <h3 style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Download size={20} /> 4. Exportación y Firmas
                </h3>
                <p style={{ color: 'var(--txt2)', fontSize: '0.95rem' }}>
                  En el Paso 4, una vez generado el análisis, puedes exportar el reporte a PDF o Excel. 
                  El PDF incluye un bloque de firmas formal para la validación del notario y el oficial de cumplimiento.
                </p>
              </section>
            </div>

            <div style={{ marginTop: '30px', textAlign: 'right' }}>
              <button className="btn" onClick={() => setIsOpen(false)}>Entendido</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
