import React, { useState } from 'react';
import { Key, ExternalLink } from 'lucide-react';

export const ApiKeyModal = ({ setApiKey }) => {
  const [inputKey, setInputKey] = useState('');

  const handleSave = () => {
    if (inputKey.trim()) {
      sessionStorage.setItem('gemini_api_key', inputKey.trim());
      setApiKey(inputKey.trim());
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999
    }}>
      <div className="card" style={{ width: '400px', maxWidth: '90%' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
          <Key size={24} /> Configurar Gemini API
        </h2>
        <p style={{ color: 'var(--txt2)', fontSize: '0.9rem', marginBottom: '20px', lineHeight: '1.5' }}>
          Para generar los análisis jurídicos necesitas una API Key gratuita de Google Gemini (gemini-2.5-flash). 
          Esta clave se guarda únicamente en tu navegador (localStorage).
        </p>
        
        <a 
          href="https://aistudio.google.com/app/apikey" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--accent)', textDecoration: 'none', marginBottom: '20px', fontSize: '0.9rem' }}
        >
          Obtener API Key gratuita <ExternalLink size={14} />
        </a>

        <div className="form-group">
          <input 
            type="password" 
            className="input-field" 
            placeholder="Pega tu API Key aquí..." 
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
          />
        </div>

        <button 
          className="btn" 
          style={{ width: '100%', marginTop: '10px' }}
          onClick={handleSave}
          disabled={!inputKey.trim()}
        >
          Guardar y Continuar
        </button>
      </div>
    </div>
  );
};
