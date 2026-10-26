import { describe, it, expect } from 'vitest';
import {
  nuevoIdCliente,
  perteneceAlUsuario,
  filtrarPendientesDeUsuario,
  conIdCliente,
  planDeSincronizacion,
  claveDuplicado,
  detectarDuplicados
} from '../utils/sincronizacion';
import { generarAlertas, getAlertaStyle } from '../utils/alertasInteligentes';

const caso = (id, extra = {}) => ({
  id,
  createdAt: '2026-10-05T10:00:00.000Z',
  datos: { cedula: '0102030405', acto: 'Compraventa', cliente: 'Ana Pérez', ...extra }
});

describe('nuevoIdCliente', () => {
  it('genera identificadores distintos y no vacíos', () => {
    const a = nuevoIdCliente();
    const b = nuevoIdCliente();

    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });
});

describe('perteneceAlUsuario', () => {
  it('solo acepta el dueño declarado', () => {
    expect(perteneceAlUsuario({ userId: 'alice' }, 'alice')).toBe(true);
    expect(perteneceAlUsuario({ userId: 'alice' }, 'bob')).toBe(false);
  });

  it('no atribuye registros sin dueño ni llamadas sin usuario', () => {
    expect(perteneceAlUsuario({}, 'alice')).toBe(false);
    expect(perteneceAlUsuario(null, 'alice')).toBe(false);
    expect(perteneceAlUsuario({ userId: 'alice' }, null)).toBe(false);
  });
});

describe('filtrarPendientesDeUsuario', () => {
  it('descarta los borradores de otras cuentas y los huérfanos', () => {
    const pendientes = [
      { id: 1, userId: 'alice' },
      { id: 2, userId: 'bob' },
      { id: 3 },
      { id: 4, userId: 'alice' }
    ];

    expect(filtrarPendientesDeUsuario(pendientes, 'alice').map(p => p.id)).toEqual([1, 4]);
    expect(filtrarPendientesDeUsuario(null, 'alice')).toEqual([]);
  });
});

describe('conIdCliente', () => {
  it('agrega un id estable si falta y conserva el existente', () => {
    const conId = conIdCliente({ userId: 'alice' });
    expect(conId.clientCaseId).toBeTruthy();
    expect(conId.userId).toBe('alice');

    const existente = conIdCliente({ clientCaseId: 'abc' });
    expect(existente.clientCaseId).toBe('abc');
  });
});

describe('planDeSincronizacion', () => {
  it('separa los que ya están en la nube por un reintento', () => {
    const plan = planDeSincronizacion(
      [
        { id: 1, clientCaseId: 'a' },
        { id: 2, clientCaseId: 'b' },
        { id: 3 }
      ],
      [{ clientCaseId: 'a' }, { clientCaseId: 'b' }]
    );

    expect(plan.yaEnNube.map(p => p.id)).toEqual([1, 2]);
    expect(plan.nuevos.map(p => p.id)).toEqual([3]);
  });

  it('sube todo cuando la nube está vacía', () => {
    const plan = planDeSincronizacion([{ id: 1, clientCaseId: 'a' }], []);
    expect(plan.nuevos).toHaveLength(1);
    expect(plan.yaEnNube).toHaveLength(0);
  });

  it('tolera listas nulas', () => {
    expect(planDeSincronizacion()).toEqual({ nuevos: [], yaEnNube: [] });
  });
});

describe('claveDuplicado', () => {
  it('normaliza el acto y usa el mes de creación', () => {
    expect(claveDuplicado(caso('1', { acto: '  Compraventa  ' })))
      .toBe('0102030405|compraventa|2026-10');
  });

  it('devuelve null sin cédula, sin acto o sin fecha', () => {
    expect(claveDuplicado({ datos: { acto: 'Compraventa' } })).toBeNull();
    expect(claveDuplicado({ datos: { cedula: '0102030405' } })).toBeNull();
    expect(claveDuplicado({ datos: { cedula: 'x', acto: 'y' } })).toBeNull();
  });

  it('acepta una fecha de referencia cuando el caso no la tiene', () => {
    expect(claveDuplicado(
      { datos: { cedula: '0102030405', acto: 'Compraventa' } },
      { ahora: '2026-03-01T00:00:00.000Z' }
    )).toBe('0102030405|compraventa|2026-03');
  });
});

describe('detectarDuplicados', () => {
  it('agrupa los casos del mismo cliente, acto y mes', () => {
    const grupos = detectarDuplicados([
      caso('c1'),
      caso('c2'),
      caso('c3', { acto: 'Poder' })
    ]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0]).toMatchObject({
      cedula: '0102030405',
      acto: 'Compraventa',
      mes: '2026-10',
      total: 2
    });
    expect(grupos[0].casos.map(c => c.id)).toEqual(['c1', 'c2']);
  });

  it('no mezcla meses distintos', () => {
    const grupos = detectarDuplicados([
      caso('c1'),
      { ...caso('c2'), createdAt: '2026-09-05T10:00:00.000Z' }
    ]);

    expect(grupos).toHaveLength(0);
  });

  it('excluye los borradores pendientes', () => {
    const grupos = detectarDuplicados([
      caso('c1'),
      caso('pending_7')
    ]);

    expect(grupos).toHaveLength(0);
  });

  it('devuelve una lista vacía sin casos', () => {
    expect(detectarDuplicados()).toEqual([]);
    expect(detectarDuplicados([{ id: 'x', datos: {} }])).toEqual([]);
  });
});

describe('alerta de posibles duplicados', () => {
  it('aparece en el portfolio y tiene estilo propio', () => {
    const alertas = generarAlertas([caso('c1'), caso('c2')]);
    const duplicado = alertas.find(a => a.tipo === 'posible_duplicado');

    expect(duplicado).toBeTruthy();
    expect(duplicado.mensaje).toMatch(/2 casos de "Compraventa"/);
    expect(duplicado.casos).toHaveLength(2);
    expect(getAlertaStyle('posible_duplicado').icon).toBe('📑');
  });

  it('no alerta cuando no hay duplicados', () => {
    const alertas = generarAlertas([caso('c1'), caso('c2', { acto: 'Poder' })]);
    expect(alertas.some(a => a.tipo === 'posible_duplicado')).toBe(false);
  });
});
