// Verificación de listas restrictivas.
//
// IMPORTANTE: esta utilidad NO contiene listas propias ni simula resultados.
// Para verificar de verdad hay que cargar las listas (OFAC, ONU, UK, lista
// interna de PEP) y pasarlas en el parámetro `fuentes`. Si no hay fuente
// configurada, el resultado es `no_configurado` y la UI debe mostrarlo como
// "sin verificar", nunca como "limpio".

// Umbrales de decisión sobre la similitud (0-100).
const UMBRAL_REVISION = 70;
const UMBRAL_ALERTA = 90;

const TIPOS_LISTA = ['ofac', 'onu', 'uk', 'uafe'];

/**
 * Normaliza un nombre para comparación: mayúsculas, sin tildes, sin
 * puntuación y con espacios colapsados.
 */
export function normalizarNombre(nombre) {
  return String(nombre || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calcula la distancia de Levenshtein entre dos strings
 */
export function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Similitud de Levenshtein normalizada entre 0 y 1.
 */
export function similarity(str1, str2) {
  const s1 = String(str1 || '').toLowerCase().trim();
  const s2 = String(str2 || '').toLowerCase().trim();
  if (s1 === s2) return 1;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  const dist = levenshteinDistance(s1, s2);
  return 1 - dist / maxLen;
}

/**
 * Similitud pensada para nombres de personas: combina Levenshtein con una
 * comparación por conjuntos de tokens, de modo que "JUAN PEREZ" y
 * "PEREZ JUAN" no se traten como personas distintas.
 */
export function similitudNombres(a, b) {
  const normA = normalizarNombre(a);
  const normB = normalizarNombre(b);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;

  const levenshtein = similarity(normA, normB);

  const tokensA = new Set(normA.split(' ').filter(Boolean));
  const tokensB = new Set(normB.split(' ').filter(Boolean));
  let interseccion = 0;
  tokensA.forEach(token => {
    if (tokensB.has(token)) interseccion++;
  });
  const tokenSet = tokensA.size + tokensB.size > 0
    ? (2 * interseccion) / (tokensA.size + tokensB.size)
    : 0;

  return Math.max(levenshtein, tokenSet);
}

/**
 * Busca coincidencias en una lista ya cargada.
 * @param {string} nombre - Nombre a buscar
 * @param {Array<{nombre: string}>} lista - Registros de la lista
 * @param {{umbral?: number, limite?: number}} opciones
 */
export function buscarEnLista(nombre, lista = [], opciones = {}) {
  const { umbral = 0.6, limite = 3 } = opciones;
  const resultados = [];

  for (const item of lista) {
    const sim = similitudNombres(nombre, item.nombre);
    if (sim >= umbral) {
      resultados.push({ ...item, confianza: Math.round(sim * 100) });
    }
  }

  resultados.sort((a, b) => b.confianza - a.confianza);
  return resultados.slice(0, limite);
}

const resultadoNoConfigurado = (tipo) => ({
  estado: 'no_configurado',
  fecha: new Date().toISOString(),
  coincidencias: [],
  mensaje: `Sin fuente de datos configurada para ${tipo.toUpperCase()}. No se realizó verificación.`,
  fuente: tipo.toUpperCase()
});

/**
 * Verifica un nombre contra las listas restrictivas suministradas.
 *
 * @param {string} nombre - Nombre del cliente
 * @param {'ofac'|'onu'|'uk'|'uafe'|'todos'} tipo
 * @param {Record<string, Array<{nombre: string}>>} fuentes - Listas cargadas
 * @returns {Promise<Record<string, object>>}
 */
export async function verificarListasRestrictivas(nombre, tipo = 'todos', fuentes = {}) {
  if (!nombre || nombre.trim().length < 3) {
    return { error: 'Nombre demasiado corto para verificar' };
  }

  const tipos = tipo === 'todos' ? TIPOS_LISTA : [tipo];
  const resultados = {};

  for (const t of tipos) {
    const lista = Array.isArray(fuentes[t]) ? fuentes[t] : null;

    if (!lista || lista.length === 0) {
      resultados[t] = resultadoNoConfigurado(t);
      continue;
    }

    const coincidencias = buscarEnLista(nombre, lista, {
      umbral: UMBRAL_REVISION / 100
    });
    const mejorConfianza = coincidencias[0]?.confianza ?? 0;

    let estado = 'no_encontrado';
    let mensaje = 'Sin coincidencias por encima del umbral de revisión.';
    if (mejorConfianza >= UMBRAL_ALERTA) {
      estado = 'coincidencia';
      mensaje = `Coincidencia prioritaria (${mejorConfianza}%). Requiere revisión y confirmación documental.`;
    } else if (mejorConfianza >= UMBRAL_REVISION) {
      estado = 'posible';
      mensaje = `Posible coincidencia (${mejorConfianza}%). Requiere revisión manual.`;
    }

    resultados[t] = {
      estado,
      fecha: new Date().toISOString(),
      coincidencias,
      mensaje,
      fuente: t.toUpperCase(),
      versionLista: fuentes[`${t}Version`] || null
    };
  }

  return resultados;
}

/**
 * Obtiene el color y icono según el estado de verificación
 */
export function getEstadoVerificacionStyle(estado) {
  const styles = {
    pendiente: { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', icon: '⏳', label: 'Pendiente' },
    verificando: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '🔍', label: 'Verificando...' },
    no_configurado: { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', icon: '⚪', label: 'Sin verificar' },
    no_encontrado: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', icon: '✅', label: 'Sin coincidencias' },
    posible: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '⚠️', label: 'Revisar' },
    coincidencia: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: '🚫', label: 'Coincidencia' },
    alerta: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: '🚨', label: 'Alerta' },
    limpio: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', icon: '✅', label: 'Limpio' },
    error: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: '❗', label: 'Error' }
  };
  return styles[estado] || styles.pendiente;
}
