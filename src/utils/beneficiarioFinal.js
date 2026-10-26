// Reconstrucción de la cadena de propiedad del beneficiario final
// (Ley LA/FT art. 92; Reglamento D.E. 298 art. 31).
//
// La app no puede inferir quién controla una sociedad: el usuario declara
// cada nivel de la cadena y el sistema calcula la participación efectiva
// multiplicando los porcentajes. La cadena es lineal: cada nivel posee el
// porcentaje indicado sobre el nivel inmediatamente inferior. Para ramas
// múltiples se repite la cadena con el propietario correspondiente.
//
// El beneficiario final es la persona natural que alcanza al menos el 10%
// del capital o derechos, o quien ejerce control efectivo. Si nadie alcanza
// ese umbral, la ley prevé acudir al gerente de mayor rango.

export const UMBRAL_BENEFICIARIO_FINAL = 10;

export const NIVEL_PROPIEDAD_INICIAL = {
  nombre: '',
  identificacion: '',
  tipo: 'natural',
  porcentaje: ''
};

const redondear = (valor) => Math.round(valor * 100) / 100;

/**
 * Calcula la participación efectiva de cada nivel de la cadena.
 * El primer nivel es el propietario directo de la sociedad; el segundo
 * posee un porcentaje de ese propietario, y así sucesivamente.
 *
 * @param {Array<{porcentaje: number|string}>} cadena
 * @returns {Array<object>} Niveles con `participacionEfectiva` (null si el
 *   porcentaje es inválido o si un nivel anterior lo invalidó).
 */
export const calcularParticipacionEfectiva = (cadena = []) => {
  let acumulado = 100;
  let rota = false;

  return cadena.map((nivel) => {
    const porcentaje = Number(nivel?.porcentaje);
    const valido = !rota
      && Number.isFinite(porcentaje)
      && porcentaje > 0
      && porcentaje <= 100;

    if (valido) {
      acumulado = acumulado * (porcentaje / 100);
    } else {
      rota = true;
    }

    return {
      ...nivel,
      participacionEfectiva: valido ? redondear(acumulado) : null
    };
  });
};

const texto = (valor) => String(valor || '').trim();

/**
 * Evalúa la cadena de propiedad y determina los beneficiarios finales.
 *
 * @param {Array<object>} cadena Niveles declarados por el usuario
 * @param {{umbral?: number}} opciones
 * @returns {{
 *   niveles: Array<object>,
 *   beneficiarios: Array<object>,
 *   incompletos: Array<object>,
 *   totalDirecto: number,
 *   alcanzaUmbral: boolean,
 *   umbral: number
 * }}
 */
export const evaluarCadenaPropiedad = (cadena = [], opciones = {}) => {
  const umbral = opciones.umbral ?? UMBRAL_BENEFICIARIO_FINAL;
  const niveles = calcularParticipacionEfectiva(Array.isArray(cadena) ? cadena : []);

  const incompletos = niveles.filter(nivel =>
    !texto(nivel.nombre)
    || !texto(nivel.identificacion)
    || nivel.participacionEfectiva === null
  );

  const beneficiarios = niveles.filter(nivel =>
    nivel.tipo === 'natural'
    && nivel.participacionEfectiva !== null
    && nivel.participacionEfectiva >= umbral
  );

  const totalDirecto = niveles.length > 0
    ? Number(niveles[0].porcentaje) || 0
    : 0;

  return {
    niveles,
    beneficiarios,
    incompletos,
    totalDirecto,
    alcanzaUmbral: beneficiarios.length > 0,
    umbral
  };
};

/**
 * Describe la cadena en texto para el prompt, el PDF y el audit trail.
 */
export const describirCadenaPropiedad = (cadena = []) => {
  if (!Array.isArray(cadena) || cadena.length === 0) return null;

  return calcularParticipacionEfectiva(cadena)
    .map((nivel, indice) => {
      const efectiva = nivel.participacionEfectiva === null
        ? 'participación no calculable'
        : `${nivel.participacionEfectiva}% efectivo`;
      const tipo = nivel.tipo === 'juridica' ? 'persona jurídica' : 'persona natural';
      return `Nivel ${indice + 1}: ${texto(nivel.nombre) || 'sin nombre'} (${texto(nivel.identificacion) || 'sin ID'}, ${tipo}) — ${nivel.porcentaje || '—'}% del nivel inferior — ${efectiva}`;
    })
    .join(' | ');
};

/**
 * Convierte la cadena en filas planas para Excel/PDF.
 */
export const filasCadenaPropiedad = (cadena = []) => calcularParticipacionEfectiva(cadena).map((nivel, indice) => ({
  nivel: indice + 1,
  nombre: texto(nivel.nombre) || '—',
  identificacion: texto(nivel.identificacion) || '—',
  tipo: nivel.tipo === 'juridica' ? 'Persona jurídica' : 'Persona natural',
  porcentaje: nivel.porcentaje === '' || nivel.porcentaje == null ? '—' : `${nivel.porcentaje}%`,
  participacionEfectiva: nivel.participacionEfectiva === null ? '—' : `${nivel.participacionEfectiva}%`
}));
