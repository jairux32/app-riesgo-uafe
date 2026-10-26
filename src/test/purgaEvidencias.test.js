import { describe, it, expect, vi } from 'vitest';
import {
  DIAS_GRACIA_PURGA,
  idsEvidenciasReferenciadas,
  calcularEvidenciasHuerfanas,
  purgarEvidenciasHuerfanas,
  describirPurga
} from '../utils/purgaEvidencias';

const HOY = '2026-10-26T12:00:00.000Z';

const caso = (id, evidencias) => ({
  id,
  datos: { evidencias }
});

const registro = (id, diasAtras, tamano = 1024) => ({
  id,
  guardadoEn: new Date(Date.parse(HOY) - diasAtras * 24 * 60 * 60 * 1000).toISOString(),
  tamano
});

describe('idsEvidenciasReferenciadas', () => {
  it('reúne las evidencias de los casos y las capacitaciones del perfil', () => {
    const ids = idsEvidenciasReferenciadas(
      [
        caso('c1', [{ id: 'ev-1' }, { id: 'ev-2' }]),
        caso('c2', [{ id: 'ev-3' }])
      ],
      { capacitaciones: [{ id: 'cap-1' }] }
    );

    expect([...ids].sort()).toEqual(['cap-1', 'ev-1', 'ev-2', 'ev-3']);
  });

  it('tolera casos sin datos, evidencias nulas y valores repetidos', () => {
    const ids = idsEvidenciasReferenciadas(
      [null, {}, { datos: {} }, caso('c1', [{ id: 'ev-1' }, { id: 'ev-1' }, {}, null])],
      {}
    );

    expect([...ids]).toEqual(['ev-1']);
  });

  it('devuelve un conjunto vacío sin argumentos', () => {
    expect(idsEvidenciasReferenciadas().size).toBe(0);
    expect(idsEvidenciasReferenciadas(null, null).size).toBe(0);
  });
});

describe('calcularEvidenciasHuerfanas', () => {
  it('separa huérfanos de archivos todavía en gracia', () => {
    const resultado = calcularEvidenciasHuerfanas({
      registros: [registro('viejo', 30), registro('nuevo', 1), registro('referenciado', 90)],
      referenciadas: new Set(['referenciado']),
      hoy: HOY
    });

    expect(resultado.huerfanas.map(item => item.id)).toEqual(['viejo']);
    expect(resultado.enGracia.map(item => item.id)).toEqual(['nuevo']);
    expect(resultado.tamanoHuerfanas).toBe(1024);
    expect(resultado.diasGracia).toBe(DIAS_GRACIA_PURGA);
  });

  it('calcula los días sin uso y marca los registros sin fecha', () => {
    const resultado = calcularEvidenciasHuerfanas({
      registros: [registro('viejo', 21), { id: 'sin-fecha', tamano: 10 }],
      hoy: HOY
    });

    const viejo = resultado.huerfanas.find(item => item.id === 'viejo');
    const sinFecha = resultado.huerfanas.find(item => item.id === 'sin-fecha');

    expect(viejo.diasSinUso).toBe(21);
    expect(viejo.sinFecha).toBe(false);
    expect(sinFecha.sinFecha).toBe(true);
    expect(sinFecha.diasSinUso).toBeNull();
  });

  it('con gracia cero considera huérfano todo lo no referenciado', () => {
    const resultado = calcularEvidenciasHuerfanas({
      registros: [registro('hoy', 0)],
      hoy: HOY,
      diasGracia: 0
    });

    expect(resultado.huerfanas).toHaveLength(1);
    expect(resultado.enGracia).toHaveLength(0);
  });

  it('ignora ids vacíos, duplicados y valores inválidos', () => {
    const resultado = calcularEvidenciasHuerfanas({
      registros: [
        { id: '' },
        { id: null },
        registro('dup', 30),
        registro('dup', 30),
        null
      ],
      hoy: HOY
    });

    expect(resultado.huerfanas).toHaveLength(1);
    expect(resultado.huerfanas[0].id).toBe('dup');
  });

  it('acepta referenciadas como arreglo', () => {
    const resultado = calcularEvidenciasHuerfanas({
      registros: [registro('a', 30), registro('b', 30)],
      referenciadas: ['a'],
      hoy: HOY
    });

    expect(resultado.huerfanas.map(item => item.id)).toEqual(['b']);
  });

  it('devuelve un análisis vacío sin registros', () => {
    expect(calcularEvidenciasHuerfanas()).toEqual({
      huerfanas: [],
      enGracia: [],
      tamanoHuerfanas: 0,
      diasGracia: DIAS_GRACIA_PURGA
    });
  });
});

describe('purgarEvidenciasHuerfanas', () => {
  const listar = () => Promise.resolve([
    registro('ev-1', 30),
    registro('ev-2', 40),
    registro('ev-3', 1),
    registro('cap-1', 60)
  ]);

  it('en modo vista previa no borra nada', async () => {
    const eliminar = vi.fn();
    const resultado = await purgarEvidenciasHuerfanas({
      casos: [caso('c1', [{ id: 'ev-1' }])],
      perfil: { capacitaciones: [{ id: 'cap-1' }] },
      hoy: HOY,
      listar,
      eliminar
    });

    expect(resultado.confirmado).toBe(false);
    expect(resultado.huerfanas.map(item => item.id)).toEqual(['ev-2']);
    expect(resultado.enGracia.map(item => item.id)).toEqual(['ev-3']);
    expect(resultado.revisadas).toBe(4);
    expect(eliminar).not.toHaveBeenCalled();
  });

  it('borra solo los huérfanos al confirmar', async () => {
    const eliminar = vi.fn().mockResolvedValue(undefined);
    const resultado = await purgarEvidenciasHuerfanas({
      casos: [caso('c1', [{ id: 'ev-1' }])],
      perfil: { capacitaciones: [{ id: 'cap-1' }] },
      hoy: HOY,
      confirmar: true,
      listar,
      eliminar
    });

    expect(resultado.eliminadas).toEqual(['ev-2']);
    expect(eliminar).toHaveBeenCalledTimes(1);
    expect(eliminar).toHaveBeenCalledWith('ev-2');
  });

  it('incluye los borradores pendientes como referencias', async () => {
    const eliminar = vi.fn();
    const resultado = await purgarEvidenciasHuerfanas({
      casos: [],
      casosPendientes: [{ datos: { evidencias: [{ id: 'ev-1' }] } }],
      perfil: { capacitaciones: [{ id: 'cap-1' }] },
      hoy: HOY,
      listar,
      eliminar
    });

    expect(resultado.huerfanas.map(item => item.id)).toEqual(['ev-2']);
  });

  it('registra los errores de borrado sin detener el resto', async () => {
    const eliminar = vi.fn()
      .mockRejectedValueOnce(new Error('bloqueado'))
      .mockResolvedValueOnce(undefined);

    const resultado = await purgarEvidenciasHuerfanas({
      casos: [],
      hoy: HOY,
      confirmar: true,
      listar: () => Promise.resolve([registro('ev-1', 30), registro('ev-2', 30)]),
      eliminar
    });

    expect(resultado.eliminadas).toEqual(['ev-2']);
    expect(resultado.fallidas).toEqual([{ id: 'ev-1', error: 'bloqueado' }]);
  });

  it('informa un error si no puede leer el almacenamiento', async () => {
    const resultado = await purgarEvidenciasHuerfanas({
      listar: () => Promise.reject(new Error('IndexedDB bloqueado')),
      confirmar: true
    });

    expect(resultado.error).toMatch(/IndexedDB bloqueado/);
    expect(resultado.eliminadas).toEqual([]);
  });
});

describe('describirPurga', () => {
  it('explica el resultado del análisis', () => {
    expect(describirPurga({ revisadas: 0 })).toMatch(/No hay archivos/);
    expect(describirPurga({ revisadas: 3, huerfanas: [], enGracia: [] }))
      .toMatch(/están referenciados/);
    expect(describirPurga({
      revisadas: 3,
      huerfanas: [{ id: 'a', tamano: 2048 }],
      enGracia: [{ id: 'b' }],
      tamanoHuerfanas: 2048,
      confirmado: false
    })).toMatch(/1 archivo\(s\) sin referencia \(2 KB\)/);
    expect(describirPurga({
      revisadas: 3,
      huerfanas: [{ id: 'a' }],
      confirmado: true,
      eliminadas: ['a'],
      fallidas: []
    })).toMatch(/Se eliminaron 1 archivo/);
    expect(describirPurga({
      revisadas: 3,
      huerfanas: [{ id: 'a' }],
      confirmado: true,
      eliminadas: [],
      fallidas: [{ id: 'a', error: 'x' }]
    })).toMatch(/no se pudieron borrar/);
  });

  it('propaga el mensaje de error', () => {
    expect(describirPurga({ error: 'falló' })).toBe('falló');
  });
});
