import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MODELO_IA, PROVEEDOR_IA } from '../data/constants';
import { transformAuditForDisplay } from '../utils/auditTransformer';

const leerFunctions = () =>
  readFileSync(resolve(process.cwd(), 'functions/index.js'), 'utf8');

describe('modelo de IA', () => {
  it('coincide con el modelo configurado en la Cloud Function', () => {
    const contenido = leerFunctions();
    const declarado = /const GROQ_MODEL\s*=\s*'([^']+)'/.exec(contenido);
    expect(declarado).not.toBeNull();
    expect(declarado[1]).toBe(MODELO_IA);
  });

  it('la Function llama a Groq, no a otro proveedor', () => {
    expect(leerFunctions()).toMatch(/api\.groq\.com/);
    expect(PROVEEDOR_IA).toBe('Groq');
  });

  it('no deja un modelo de Gemini como valor por defecto en el dictamen', () => {
    const transformada = transformAuditForDisplay({
      meta: { fecha_analisis: '2026-11-05', confianza_global: 80 }
    });
    expect(transformada.header.modelo).toBe(MODELO_IA);
    expect(transformada.header.modelo).not.toMatch(/gemini/i);
  });

  it('respeta el modelo que declara el propio dictamen', () => {
    const transformada = transformAuditForDisplay({
      meta: { fecha_analisis: '2026-11-05', confianza_global: 80, modelo_ia: 'otro-modelo' }
    });
    expect(transformada.header.modelo).toBe('otro-modelo');
  });
});
