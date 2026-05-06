import React, { useRef, useState, useEffect } from 'react';
import { X, Pen, Trash2, Check } from 'lucide-react';

export const SignatureModal = ({ isOpen, onClose, onSave, title }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // Clear canvas when opened
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasDrawing(false);
    }
  }, [isOpen]);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawing(true);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
  };

  const handleSave = () => {
    if (!hasDrawing) return;
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10000, padding: '20px'
    }}>
      <div className="card" style={{ width: '500px', maxWidth: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Pen size={22} /> {title}
          </h2>
          <button className="btn btn-secondary" onClick={onClose}><X size={20} /></button>
        </div>

        <p style={{ color: 'var(--txt2)', fontSize: '0.9rem', marginBottom: '15px' }}>
          Firme en el área de abajo usando el mouse o tacto.
        </p>

        <div style={{
          border: '2px dashed var(--txt2)',
          borderRadius: '8px',
          background: 'white',
          overflow: 'hidden',
          cursor: 'crosshair'
        }}>
          <canvas
            ref={canvasRef}
            width={460}
            height={200}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={{ display: 'block', touchAction: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={clearCanvas} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Trash2 size={16} /> Borrar
          </button>
          <button
            className="btn"
            onClick={handleSave}
            disabled={!hasDrawing}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Check size={16} /> Guardar firma
          </button>
        </div>
      </div>
    </div>
  );
};
