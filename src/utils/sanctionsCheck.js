// Sistema de verificación de listas restrictivas
// Arquitectura preparada para integración con APIs reales de OFAC, ONU y UAFE

// Listas de ejemplo para demostración (en producción se consumirían de APIs oficiales)
const LISTAS_EJEMPLO = {
  ofac: [
    { nombre: 'JOAQUIN GODOY', tipo: 'SDNT', programa: 'Narcotráfico' },
    { nombre: 'MARIA FERNANDA SALAZAR', tipo: 'Individual', programa: 'Crimen Organizado' },
    { nombre: 'CORPORACION LATINOAMERICANA S.A.', tipo: 'Entity', programa: 'Proliferación' },
    { nombre: 'CARLOS ALBERTO RUIZ', tipo: 'Individual', programa: 'Terrorismo' },
    { nombre: 'LOS LOBOS S.A.', tipo: 'Entity', programa: 'Narcotráfico' },
    { nombre: 'EMPRESA CONSTRUCTORA DEL NORTE', tipo: 'Entity', programa: 'Corruptción' },
    { nombre: 'PEDRO JOSE MENDOZA', tipo: 'Individual', programa: 'Crimen Organizado' },
    { nombre: 'BANCO INTERNACIONAL S.A.', tipo: 'Entity', programa: 'Lavado de Activos' },
  ],
  onu: [
    { nombre: 'ISIS', tipo: 'Grupo Terrorista', lista: '1267' },
    { nombre: 'AL QAEDA', tipo: 'Grupo Terrorista', lista: '1267' },
    { nombre: 'MOHAMED AL FAKIR', tipo: 'Individual', lista: '1988' },
    { nombre: 'GRUPO TALIBAN', tipo: 'Grupo Terrorista', lista: '1988' },
    { nombre: 'AL SHABAAB', tipo: 'Grupo Terrorista', lista: '751' },
    { nombre: 'BOKO HARAM', tipo: 'Grupo Terrorista', lista: '751' },
    { nombre: 'REBELDES DE KIVU', tipo: 'Grupo Armado', lista: '1533' },
    { nombre: 'GRUPO WAGNER', tipo: 'Empresa Militar', lista: '2583' },
  ],
  uafe: [
    { nombre: 'JUAN PEREZ GARCIA', tipo: 'PEP', alerta: 'Reporte anterior' },
    { nombre: 'EMPRESA XYZ S.A.', tipo: 'Entidad', alerta: 'Operación sospechosa' },
    { nombre: 'MARIA LOPEZ TORRES', tipo: 'PEP', alerta: 'Vinculación política' },
    { nombre: 'CONSORCIO ABC', tipo: 'Entidad', alerta: 'Estructura compleja' },
    { nombre: 'ROBERTO GARCIA SANCHEZ', tipo: 'PEP', alerta: 'Reporte anterior' },
    { nombre: 'GRUPO FINANCIERO DEL PACIFICO', tipo: 'Entidad', alerta: 'Operación sospechosa' },
  ]
};

/**
 * Calcula la distancia de Levenshtein entre dos strings
 */
function levenshteinDistance(str1, str2) {
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
 * Calcula similitud entre 0 y 1
 */
function similarity(str1, str2) {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  if (s1 === s2) return 1;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  const dist = levenshteinDistance(s1, s2);
  return 1 - dist / maxLen;
}

/**
 * Busca coincidencias en una lista local
 */
function buscarEnLista(nombre, lista) {
  const resultados = [];
  const nombreNormalizado = nombre.toLowerCase().trim();

  for (const item of lista) {
    const sim = similarity(nombreNormalizado, item.nombre);
    if (sim >= 0.6) {
      resultados.push({ ...item, confianza: Math.round(sim * 100) });
    }
  }

  // Ordenar por confianza descendente
  resultados.sort((a, b) => b.confianza - a.confianza);
  return resultados.slice(0, 3);
}

/**
 * Verifica un nombre contra listas restrictivas
 * @param {string} nombre - Nombre del cliente a verificar
 * @param {string} tipo - 'ofac', 'onu', 'uafe', o 'todos'
 */
export async function verificarListasRestrictivas(nombre, tipo = 'todos') {
  if (!nombre || nombre.trim().length < 3) {
    return { error: 'Nombre demasiado corto para verificar' };
  }

  const tipos = tipo === 'todos' ? ['ofac', 'onu', 'uafe'] : [tipo];
  const resultados = {};

  // Simular delay de red (200-500ms)
  await new Promise(r => setTimeout(r, 200 + Math.random() * 300));

  for (const t of tipos) {
    const coincidencias = buscarEnLista(nombre, LISTAS_EJEMPLO[t]);
    const encontrado = coincidencias.length > 0 && coincidencias[0].confianza >= 80;
    const posible = coincidencias.length > 0 && coincidencias[0].confianza >= 60 && !encontrado;

    resultados[t] = {
      estado: encontrado ? 'coincidencia' : posible ? 'posible' : 'no_encontrado',
      fecha: new Date().toISOString(),
      coincidencias: coincidencias,
      mensaje: encontrado
        ? `Coincidencia confirmada (${coincidencias[0].confianza}% de confianza)`
        : posible
        ? `Posible coincidencia (${coincidencias[0].confianza}% de confianza) - Requiere revisión manual`
        : 'No se encontraron coincidencias',
      fuente: t.toUpperCase()
    };
  }

  return resultados;
}

/**
 * Verifica si una cédula/ruc está en listas de alerta UAFE
 * En producción conectaría con API de UAFE
 */
export async function verificarDocumentoUAFE(cedula) {
  if (!cedula || cedula.length < 10) {
    return { error: 'Documento inválido' };
  }

  await new Promise(r => setTimeout(r, 150 + Math.random() * 200));

  // Simulación: algunos números terminados en 99 o 00 generan alerta
  const ultimosDos = cedula.slice(-2);
  const esAlerta = ['99', '00', '11'].includes(ultimosDos);

  return {
    estado: esAlerta ? 'alerta' : 'limpio',
    fecha: new Date().toISOString(),
    mensaje: esAlerta
      ? 'Documento asociado a reportes previos en sistema UAFE'
      : 'Documento sin alertas registradas',
    fuente: 'UAFE_EC'
  };
}

/**
 * Obtiene el color y icono según el estado de verificación
 */
export function getEstadoVerificacionStyle(estado) {
  const styles = {
    pendiente: { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', icon: '⏳', label: 'Pendiente' },
    verificando: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '🔍', label: 'Verificando...' },
    no_encontrado: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', icon: '✅', label: 'Limpio' },
    posible: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '⚠️', label: 'Revisar' },
    coincidencia: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: '🚫', label: 'Coincidencia' },
    alerta: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: '🚨', label: 'Alerta' },
    limpio: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', icon: '✅', label: 'Limpio' },
  };
  return styles[estado] || styles.pendiente;
}
