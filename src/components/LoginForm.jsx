import React, { useState } from 'react';
import { LogIn, UserPlus, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  const getErrorMessage = (code) => {
    const map = {
      'auth/invalid-credential': 'Correo o contraseña incorrectos.',
      'auth/user-not-found': 'No existe una cuenta con este correo.',
      'auth/wrong-password': 'Contraseña incorrecta.',
      'auth/invalid-email': 'El correo electrónico no es válido.',
      'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
      'auth/email-already-in-use': 'Ya existe una cuenta con este correo.',
      'auth/too-many-requests': 'Demasiados intentos fallidos. Intente más tarde.',
      'auth/network-request-failed': 'Error de conexión. Verifique su internet.'
    };
    return map[code] || 'Ocurrió un error. Intente nuevamente.';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        await register(email, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(getErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, var(--bg-app-1) 0%, var(--bg-app-2) 100%)',
      padding: '20px'
    }}>
      <div className="card" style={{ width: '420px', maxWidth: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <Shield size={48} color="var(--accent)" style={{ marginBottom: '15px' }} />
          <h1 style={{ fontSize: '1.5rem', marginBottom: '5px' }}>
            Análisis de Riesgo LA/FD
          </h1>
          <p style={{ color: 'var(--txt2)', fontSize: '0.9rem' }}>
            Sector Notarial Ecuatoriano
          </p>
        </div>

        <h2 style={{ marginBottom: '20px', textAlign: 'center' }}>
          {isRegister ? 'Crear Cuenta' : 'Iniciar Sesión'}
        </h2>

        {error && (
          <div style={{
            padding: '12px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid var(--rojo)',
            borderRadius: '8px',
            color: 'var(--rojo)',
            fontSize: '0.9rem',
            marginBottom: '15px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Correo Electrónico</label>
            <input
              type="email"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="notario@ejemplo.com"
              required
            />
          </div>

          <div className="form-group">
            <label>Contraseña</label>
            <input
              type="password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="btn"
            disabled={loading}
            style={{ width: '100%', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {isRegister ? <UserPlus size={18} /> : <LogIn size={18} />}
            {loading ? 'Procesando...' : isRegister ? 'Crear Cuenta' : 'Iniciar Sesión'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            className="btn btn-secondary"
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            style={{ width: '100%' }}
          >
            {isRegister ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
          </button>
        </div>
      </div>
    </div>
  );
};
