import { AUDIT_RESPONSE_SCHEMA } from './auditSchema';

/**
 * Validador mínimo de JSON Schema (subconjunto usado por AUDIT_RESPONSE_SCHEMA).
 *
 * No pretende sustituir a Ajv: cubre type, required, enum, pattern, límites y
 * arrays/objetos anidados, que es lo que necesita la salida del modelo. Evita
 * añadir una dependencia solo para rechazar dictámenes incompletos.
 *
 * @returns {string[]} Lista de errores; vacía si el valor cumple el esquema.
 */
export const validarContraEsquema = (valor, esquema, ruta = '$') => {
  const errores = [];
  if (!esquema || typeof esquema !== 'object') return errores;

  const { type } = esquema;

  if (type === 'object') {
    if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
      return [`${ruta}: se esperaba un objeto`];
    }

    if (Array.isArray(esquema.required)) {
      esquema.required.forEach(clave => {
        if (!(clave in valor)) errores.push(`${ruta}.${clave}: campo requerido`);
      });
    }

    Object.entries(esquema.properties || {}).forEach(([clave, subEsquema]) => {
      if (clave in valor) {
        errores.push(...validarContraEsquema(valor[clave], subEsquema, `${ruta}.${clave}`));
      }
    });

    return errores;
  }

  if (type === 'array') {
    if (!Array.isArray(valor)) {
      return [`${ruta}: se esperaba un arreglo`];
    }
    valor.forEach((item, indice) => {
      errores.push(...validarContraEsquema(item, esquema.items, `${ruta}[${indice}]`));
    });
    return errores;
  }

  if (type === 'string') {
    if (typeof valor !== 'string') return [`${ruta}: se esperaba un texto`];
    if (Array.isArray(esquema.enum) && !esquema.enum.includes(valor)) {
      errores.push(`${ruta}: valor "${valor}" fuera de ${esquema.enum.join(' | ')}`);
    }
    if (typeof esquema.maxLength === 'number' && valor.length > esquema.maxLength) {
      errores.push(`${ruta}: excede ${esquema.maxLength} caracteres`);
    }
    if (typeof esquema.pattern === 'string') {
      try {
        if (!new RegExp(esquema.pattern).test(valor)) {
          errores.push(`${ruta}: no cumple el patrón ${esquema.pattern}`);
        }
      } catch {
        // Patrón inválido en el esquema: no se puede validar.
      }
    }
    return errores;
  }

  if (type === 'number') {
    if (typeof valor !== 'number' || !Number.isFinite(valor)) {
      return [`${ruta}: se esperaba un número`];
    }
    if (typeof esquema.minimum === 'number' && valor < esquema.minimum) {
      errores.push(`${ruta}: menor que el mínimo ${esquema.minimum}`);
    }
    if (typeof esquema.maximum === 'number' && valor > esquema.maximum) {
      errores.push(`${ruta}: mayor que el máximo ${esquema.maximum}`);
    }
    return errores;
  }

  if (type === 'boolean' && typeof valor !== 'boolean') {
    return [`${ruta}: se esperaba un booleano`];
  }

  return errores;
};

/**
 * Valida la respuesta estructurada del modelo contra AUDIT_RESPONSE_SCHEMA.
 */
export const validarRespuestaAuditoria = (data) => {
  const errores = validarContraEsquema(data, AUDIT_RESPONSE_SCHEMA);
  return { valido: errores.length === 0, errores };
};
