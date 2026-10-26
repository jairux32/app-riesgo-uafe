import { describe, it, expect } from 'vitest';
import {
  MODALIDADES_CAPACITACION,
  HORAS_RECOMENDADAS_ANUALES,
  normalizarParticipantes,
  esModalidadValida,
  etiquetaModalidad,
  crearRegistroCapacitacion,
  validarRegistroCapacitacion,
  evaluarVigenciaCapacitacion,
  fechaCapacitacionVigente,
  describirCapacitacion,
  filasCapacitacion,
  crearEvidenciaCapacitacion
} from '../utils/capacitacion';
import { evaluarCumplimientoInstitucional } from '../utils/cumplimiento';

const HASH_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const HOY = '2026-10-26';

const registro = (extra = {}) => crearRegistroCapacitacion({
  tema: 'Señales de alerta',
  fecha: '2026-05-01',
  horas: 4,
  modalidad: 'presencial',
  facilitador: 'UAFE',
  participantes: ['Ana Pérez', 'Luis Gómez'],
  responsable: 'Ana Pérez',
  ...extra
});

describe('normalizarParticipantes', () => {
  it('separa por saltos de línea, comas y punto y coma', () => {
    expect(normalizarParticipantes('Ana Pérez\nLuis Gómez, Marta Ruiz; Pedro Soto'))
      .toEqual(['Ana Pérez', 'Luis Gómez', 'Marta Ruiz', 'Pedro Soto']);
  });

  it('recorta espacios y elimina vacíos y duplicados sin distinguir mayúsculas', () => {
    expect(normalizarParticipantes(['  Ana  ', 'ana', '', 'LUIS']))
      .toEqual(['Ana', 'LUIS']);
  });

  it('acepta valores nulos', () => {
    expect(normalizarParticipantes(null)).toEqual([]);
    expect(normalizarParticipantes(undefined)).toEqual([]);
  });
});

describe('crearRegistroCapacitacion', () => {
  it('normaliza el registro y calcula las horas', () => {
    const creado = registro({ horas: '3.333', tema: '  Tema  ' });

    expect(creado.tema).toBe('Tema');
    expect(creado.fecha).toBe('2026-05-01');
    expect(creado.horas).toBe(3.33);
    expect(creado.modalidad).toBe('presencial');
    expect(creado.participantes).toEqual(['Ana Pérez', 'Luis Gómez']);
    expect(creado.responsable).toBe('Ana Pérez');
    expect(creado.id).toBeTruthy();
    expect(creado.evidencia).toBeNull();
  });

  it('normaliza una modalidad desconocida a presencial', () => {
    expect(registro({ modalidad: 'inexistente' }).modalidad).toBe('presencial');
  });

  it('acepta una evidencia con hash SHA-256 válido y descarta una inválida', () => {
    const conHash = registro({
      evidencia: { nombre: 'certificado.pdf', hash: HASH_ABC, tamano: 1024 }
    });
    const sinHash = registro({
      evidencia: { nombre: 'certificado.pdf', hash: 'malo', tamano: 1024 }
    });

    expect(conHash.evidencia).toMatchObject({
      nombre: 'certificado.pdf',
      hash: HASH_ABC,
      tamano: 1024
    });
    expect(sinHash.evidencia).toBeNull();
  });

  it('conserva un id existente', () => {
    expect(registro({ id: 'cap-1' }).id).toBe('cap-1');
  });
});

describe('validarRegistroCapacitacion', () => {
  it('acepta un registro completo', () => {
    expect(validarRegistroCapacitacion(registro())).toEqual({ valida: true, faltantes: [] });
  });

  it('rechaza registros sin tema, fecha, horas, participantes o responsable', () => {
    const resultado = validarRegistroCapacitacion(
      crearRegistroCapacitacion({ tema: '', fecha: 'no-es-fecha', horas: 0, participantes: [] })
    );

    expect(resultado.valida).toBe(false);
    const texto = resultado.faltantes.join(' ');
    expect(texto).toMatch(/tema/);
    expect(texto).toMatch(/fecha/);
    expect(texto).toMatch(/horas/);
    expect(texto).toMatch(/participantes/);
    expect(texto).toMatch(/responsable/);
  });

  it('exige un hash válido cuando hay evidencia', () => {
    const creado = registro();
    const resultado = validarRegistroCapacitacion({
      ...creado,
      evidencia: { nombre: 'x.pdf', hash: '123' }
    });

    expect(resultado.valida).toBe(false);
    expect(resultado.faltantes.join(' ')).toMatch(/hash/);
  });
});

describe('evaluarVigenciaCapacitacion', () => {
  it('marca pendiente cuando no hay registros', () => {
    const resumen = evaluarVigenciaCapacitacion([], { hoy: HOY });

    expect(resumen.estado).toBe('pendiente');
    expect(resumen.vigente).toBe(false);
    expect(resumen.ultimaFecha).toBeNull();
    expect(resumen.horasUltimos12Meses).toBe(0);
  });

  it('marca vigente una capacitación reciente y suma las horas del año', () => {
    const resumen = evaluarVigenciaCapacitacion([
      registro({ fecha: '2026-05-01', horas: 4 }),
      registro({ fecha: '2026-09-15', horas: 4 })
    ], { hoy: HOY });

    expect(resumen.estado).toBe('vigente');
    expect(resumen.ultimaFecha).toBe('2026-09-15');
    expect(resumen.vence).toBe('2027-09-15');
    expect(resumen.horasUltimos12Meses).toBe(8);
    expect(resumen.cumpleHoras).toBe(true);
    expect(resumen.participantesUltima).toBe(2);
  });

  it('marca por vencer cuando la vigencia anual está dentro de 30 días', () => {
    const resumen = evaluarVigenciaCapacitacion(
      [registro({ fecha: '2025-11-15' })],
      { hoy: HOY }
    );

    expect(resumen.estado).toBe('por_vencer');
    expect(resumen.vigente).toBe(true);
    expect(resumen.dias).toBeLessThanOrEqual(30);
  });

  it('marca vencida una capacitación de hace más de 12 meses', () => {
    const resumen = evaluarVigenciaCapacitacion(
      [registro({ fecha: '2025-09-01' })],
      { hoy: HOY }
    );

    expect(resumen.estado).toBe('vencido');
    expect(resumen.vigente).toBe(false);
    expect(resumen.dias).toBeLessThan(0);
    expect(resumen.horasUltimos12Meses).toBe(0);
  });

  it('excluye las jornadas futuras del cálculo y las cuenta aparte', () => {
    const resumen = evaluarVigenciaCapacitacion([
      registro({ fecha: '2026-05-01' }),
      registro({ fecha: '2027-01-10' })
    ], { hoy: HOY });

    expect(resumen.total).toBe(2);
    expect(resumen.programadas).toBe(1);
    expect(resumen.ultimaFecha).toBe('2026-05-01');
    expect(resumen.horasUltimos12Meses).toBe(4);
  });

  it('avisa cuando las horas no alcanzan la referencia interna', () => {
    const resumen = evaluarVigenciaCapacitacion(
      [registro({ horas: 2 })],
      { hoy: HOY, horasMinimas: 8 }
    );

    expect(resumen.cumpleHoras).toBe(false);
    expect(resumen.horasMinimas).toBe(8);
    expect(HORAS_RECOMENDADAS_ANUALES).toBe(8);
  });

  it('usa la referencia por defecto cuando no se indica otra', () => {
    const resumen = evaluarVigenciaCapacitacion([registro({ horas: 10 })], { hoy: HOY });
    expect(resumen.horasMinimas).toBe(HORAS_RECOMENDADAS_ANUALES);
    expect(resumen.cumpleHoras).toBe(true);
  });
});

describe('fechaCapacitacionVigente', () => {
  it('usa el registro detallado más reciente', () => {
    expect(fechaCapacitacionVigente([
      registro({ fecha: '2025-04-01' }),
      registro({ fecha: '2026-05-01' })
    ], '2024-01-01', { hoy: HOY })).toBe('2026-05-01');
  });

  it('cae al campo simple cuando no hay registros', () => {
    expect(fechaCapacitacionVigente([], '2025-06-15', { hoy: HOY })).toBe('2025-06-15');
  });

  it('toma la más reciente entre el registro y el campo simple', () => {
    expect(fechaCapacitacionVigente(
      [registro({ fecha: '2025-03-01' })],
      '2026-02-01',
      { hoy: HOY }
    )).toBe('2026-02-01');
  });

  it('ignora fechas futuras y devuelve vacío sin datos', () => {
    expect(fechaCapacitacionVigente(
      [registro({ fecha: '2027-01-01' })],
      '',
      { hoy: HOY }
    )).toBe('');
    expect(fechaCapacitacionVigente()).toBe('');
  });
});

describe('describirCapacitacion y filasCapacitacion', () => {
  it('describe una capacitación vigente', () => {
    const texto = describirCapacitacion([registro()], { hoy: HOY });

    expect(texto).toContain('1 capacitación(es) registrada(s)');
    expect(texto).toContain('2026-05-01');
    expect(texto).toContain('Señales de alerta');
    expect(texto).toContain('vigente hasta 2027-05-01');
  });

  it('describe una capacitación vencida y la ausencia de registros', () => {
    expect(describirCapacitacion([registro({ fecha: '2025-09-01' })], { hoy: HOY }))
      .toMatch(/vencida/);
    expect(describirCapacitacion([], { hoy: HOY })).toBe('Sin registros de capacitación.');
  });

  it('genera filas planas para exportación', () => {
    const [fila] = filasCapacitacion([registro({
      evidencia: { nombre: 'certificado.pdf', hash: HASH_ABC, tamano: 10 }
    })]);

    expect(fila).toMatchObject({
      fecha: '2026-05-01',
      tema: 'Señales de alerta',
      horas: 4,
      modalidad: 'Presencial',
      facilitador: 'UAFE',
      participantes: 'Ana Pérez, Luis Gómez',
      responsable: 'Ana Pérez',
      evidencia: 'certificado.pdf',
      hash: HASH_ABC
    });
  });
});

describe('crearEvidenciaCapacitacion', () => {
  it('calcula el hash de un archivo', async () => {
    const archivo = new File(['abc'], 'certificado.pdf', { type: 'application/pdf' });
    const evidencia = await crearEvidenciaCapacitacion(archivo);

    expect(evidencia).toMatchObject({
      nombre: 'certificado.pdf',
      hash: HASH_ABC,
      tamano: 3
    });
    expect(evidencia.cargadaEn).toBeTruthy();
  });

  it('devuelve null sin archivo', async () => {
    await expect(crearEvidenciaCapacitacion(null)).resolves.toBeNull();
  });
});

describe('modalidades', () => {
  it('valida y etiqueta las modalidades conocidas', () => {
    expect(esModalidadValida('virtual')).toBe(true);
    expect(esModalidadValida('otra')).toBe(false);
    expect(etiquetaModalidad('mixta')).toBe('Mixta');
    expect(etiquetaModalidad('otra')).toBe('otra');
    expect(MODALIDADES_CAPACITACION.map(m => m.valor)).toContain('autoestudio');
  });
});

describe('integración con el cumplimiento institucional', () => {
  const PERFIL = {
    codigoSISLAFT: 'UAFE-12345',
    oficialCumplimiento: 'Ana Pérez',
    fechaDesignacionOC: '2025-03-01',
    manualAprobado: true,
    manualFecha: '2025-02-15',
    ebrFecha: '2026-05-01'
  };

  it('usa el registro detallado aunque el campo simple esté vencido', () => {
    const resultado = evaluarCumplimientoInstitucional({
      ...PERFIL,
      capacitacionFecha: '2024-01-01',
      capacitaciones: [registro({ fecha: '2026-05-01' })]
    }, { hoy: HOY });

    const capacitacion = resultado.items.find(item => item.clave === 'capacitacion');
    expect(capacitacion.estado).toBe('vigente');
    expect(capacitacion.registros).toBe(1);
    expect(capacitacion.horasUltimos12Meses).toBe(4);
    expect(resultado.cumple).toBe(true);
  });

  it('mantiene el comportamiento del campo simple sin registros detallados', () => {
    const resultado = evaluarCumplimientoInstitucional({
      ...PERFIL,
      capacitacionFecha: '2026-04-10'
    }, { hoy: HOY });

    const capacitacion = resultado.items.find(item => item.clave === 'capacitacion');
    expect(capacitacion.estado).toBe('vigente');
    expect(capacitacion.registros).toBe(0);
    expect(capacitacion.cumpleHoras).toBeNull();
    expect(resultado.alertasCapacitacion).toHaveLength(0);
  });

  it('alerta por horas insuficientes sin bloquear el cumplimiento', () => {
    const resultado = evaluarCumplimientoInstitucional({
      ...PERFIL,
      capacitaciones: [registro({ horas: 2 })]
    }, { hoy: HOY });

    expect(resultado.cumple).toBe(true);
    expect(resultado.requiereAtencion).toBe(false);
    expect(resultado.alertasCapacitacion).toHaveLength(1);
    expect(resultado.alertasCapacitacion[0]).toMatch(/2 h registradas/);
  });
});
