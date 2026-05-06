import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { saveNotaryProfile, getNotaryProfile } from '../firebase/profileStore';
import { Building2, UserCheck, Save, RefreshCw } from 'lucide-react';

export const NotaryProfile = ({ onClose }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState({
    notaria: '',
    numeroNotaria: '',
    canton: '',
    provincia: '',
    codigoSISLAFT: '',
    direccion: '',
    telefono: '',
    email: '',
    notario: '',
    cedulaNotario: '',
    oficialCumplimiento: '',
    cargoOficial: '',
    emailOficial: ''
  });

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    const data = await getNotaryProfile(user.uid);
    if (data) setProfile(prev => ({ ...prev, ...data }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!profile.notaria || !profile.notario || !profile.oficialCumplimiento) {
      toast.error('Complete al menos: Nombre de Notaría, Notario y Oficial de Cumplimiento');
      return;
    }
    setLoading(true);
    try {
      await saveNotaryProfile(user.uid, profile);
      setSaved(true);
      toast.success('Perfil guardado correctamente');
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toast.error('Error al guardar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #30363d', paddingBottom: '10px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent)' }}>
          <Building2 size={24} /> Perfil de la Notaría
        </h2>
        {onClose && <button className="btn btn-secondary" onClick={onClose}>Volver</button>}
      </div>

      <p style={{ color: 'var(--txt2)', marginBottom: '20px', fontSize: '0.9rem' }}>
        Configure los datos institucionales. Estos se usarán automáticamente en cada caso y en los reportes oficiales.
      </p>

      <h3 style={{ fontSize: '1rem', color: 'var(--accent)', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Building2 size={18} /> Datos de la Notaría
      </h3>

      <div className="grid-2">
        <div className="form-group">
          <label>Nombre Oficial de la Notaría *</label>
          <input type="text" className="input-field" name="notaria" value={profile.notaria} onChange={handleChange} placeholder="Ej: Notaría Primera del Cantón Guayaquil" />
        </div>
        <div className="form-group">
          <label>Número de Notaría</label>
          <input type="text" className="input-field" name="numeroNotaria" value={profile.numeroNotaria} onChange={handleChange} placeholder="Ej: 001" />
        </div>
        <div className="form-group">
          <label>Cantón</label>
          <input type="text" className="input-field" name="canton" value={profile.canton} onChange={handleChange} placeholder="Ej: Guayaquil" />
        </div>
        <div className="form-group">
          <label>Provincia</label>
          <input type="text" className="input-field" name="provincia" value={profile.provincia} onChange={handleChange} placeholder="Ej: Guayas" />
        </div>
        <div className="form-group">
          <label>Código de Registro SISLAFT</label>
          <input type="text" className="input-field" name="codigoSISLAFT" value={profile.codigoSISLAFT} onChange={handleChange} placeholder="Código asignado por UAFE" />
        </div>
        <div className="form-group">
          <label>Dirección Física</label>
          <input type="text" className="input-field" name="direccion" value={profile.direccion} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Teléfono</label>
          <input type="text" className="input-field" name="telefono" value={profile.telefono} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Correo Electrónico Oficial</label>
          <input type="email" className="input-field" name="email" value={profile.email} onChange={handleChange} />
        </div>
      </div>

      <h3 style={{ fontSize: '1rem', color: 'var(--accent)', margin: '25px 0 15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <UserCheck size={18} /> Responsables
      </h3>

      <div className="grid-2">
        <div className="form-group">
          <label>Notario/a *</label>
          <input type="text" className="input-field" name="notario" value={profile.notario} onChange={handleChange} placeholder="Nombre completo del notario" />
        </div>
        <div className="form-group">
          <label>Cédula del Notario</label>
          <input type="text" className="input-field" name="cedulaNotario" value={profile.cedulaNotario} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Oficial de Cumplimiento *</label>
          <input type="text" className="input-field" name="oficialCumplimiento" value={profile.oficialCumplimiento} onChange={handleChange} placeholder="Nombre completo (Obligatorio UAFE)" />
        </div>
        <div className="form-group">
          <label>Cargo del Oficial</label>
          <input type="text" className="input-field" name="cargoOficial" value={profile.cargoOficial} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Email del Oficial</label>
          <input type="email" className="input-field" name="emailOficial" value={profile.emailOficial} onChange={handleChange} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '30px', gap: '10px' }}>
        <button className="btn btn-secondary" onClick={loadProfile} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <RefreshCw size={16} /> Restaurar
        </button>
        <button className="btn" onClick={handleSave} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          {saved ? '✅ Guardado' : <><Save size={16} /> Guardar Perfil</>}
        </button>
      </div>
    </div>
  );
};
