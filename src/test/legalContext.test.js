import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONTEXTO_LEGAL_COMPLETO_ECUADOR } from '../data/constants';

const extraerContexto = (ruta) => {
  const contenido = readFileSync(ruta, 'utf8');
  const inicio = contenido.indexOf('`');
  const fin = contenido.lastIndexOf('`');
  return contenido.slice(inicio + 1, fin);
};

describe('contexto legal', () => {
  it('el contexto de la Cloud Function coincide con constants.js', () => {
    const contextoFuncion = extraerContexto(resolve(process.cwd(), 'functions/legalContext.js'));
    expect(contextoFuncion).toBe(CONTEXTO_LEGAL_COMPLETO_ECUADOR);
  });

  it('no cita el Art. 318 del COIP como vigente', () => {
    expect(CONTEXTO_LEGAL_COMPLETO_ECUADOR).toMatch(/Art\. 318: DEROGADO/);
  });

  it('mantiene la retención en 10 años y las sanciones en SBU correctas', () => {
    expect(CONTEXTO_LEGAL_COMPLETO_ECUADOR).toMatch(/por 10 años/);
    expect(CONTEXTO_LEGAL_COMPLETO_ECUADOR).toMatch(/11 a 20 SBU/);
    expect(CONTEXTO_LEGAL_COMPLETO_ECUADOR).toMatch(/21 a 40 SBU/);
    expect(CONTEXTO_LEGAL_COMPLETO_ECUADOR).not.toMatch(/cancelación del código de registro SISLAFT\s*$/m);
  });
});
