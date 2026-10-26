# Auditoría integral — `app-riesgo-uafe`

**Fecha:** 23 de octubre de 2026
**Alcance:** código, configuración y normativa LA/FT de Ecuador (2024–2026)
**Modo:** solo lectura. No se modificó ningún archivo de la aplicación.
**Método:** revisión estática del repositorio, ejecución de `npm run lint`, `npm test`, `npm run build`, `npm audit`, y cinco investigaciones paralelas (marco legal, UAFE/SISLAFT, tipologías notariales, listas restrictivas y contraste código↔normativa).

---

## Índice

1. [Veredicto](#1-veredicto)
2. [Estado de higiene técnica](#2-estado-de-higiene-técnica)
3. [Marco normativo verificado](#3-marco-normativo-verificado)
4. [Errores en el contexto legal embebido](#4-errores-en-el-contexto-legal-embebido)
5. [El motor de riesgo](#5-el-motor-de-riesgo)
6. [Screening de listas](#6-screening-de-listas)
7. [Seguridad y datos personales](#7-seguridad-y-datos-personales)
8. [Trazabilidad y gobierno de IA](#8-trazabilidad-y-gobierno-de-ia)
9. [Bugs funcionales](#9-bugs-funcionales)
10. [Matriz de brechas normativas](#10-matriz-de-brechas-normativas)
11. [Roadmap P0/P1/P2](#11-roadmap)
12. [Funcionalidades nuevas recomendadas](#12-funcionalidades-nuevas-recomendadas)
13. [Discrepancias entre investigaciones](#13-discrepancias-entre-investigaciones-resueltas)
14. [Límites de esta auditoría](#14-límites-de-esta-auditoría)
15. [Anexo: comandos de verificación](#15-anexo-comandos-de-verificación)

---

## 1. Veredicto

La aplicación tiene una arquitectura razonable y un catálogo de señales amplio, pero **hoy no es apta para uso legal operativo**. Tres fallos estructurales la invalidan:

1. **El score no discrimina riesgo.** El máximo real es 5 y los umbrales empiezan en 8: todo caso sale BAJO.
2. **El screening de listas es ficticio** y genera alertas inventadas a partir de la cédula.
3. **Hay 36.981 registros de PII servidos públicamente** sin autenticación.

Ninguno es un detalle de pulido: los tres afectan directamente a decisiones jurídicas y a la protección de datos de terceros.

| # | Hallazgo | Severidad | Evidencia |
|---|---|---|---|
| 1 | Score máximo real 5 vs. umbrales 8/14/19/25 | Crítico | `src/utils/calculations.js:25,31`; `src/views/Step2Senales.jsx:33` |
| 2 | PII de 36.981 clientes en hosting público | Crítico | `public/data/clientes.json`; `src/main.jsx:30` |
| 3 | Screening simulado y alertas inventadas | Crítico | `src/utils/sanctionsCheck.js:5-34,139-144` |
| 4 | `allow list` abierto a cualquier usuario autenticado | Crítico | `firestore.rules:6,24` |
| 5 | Cloud Function de IA sin autenticación | Crítico | `functions/index.js:15-17` |
| 6 | Contexto legal con errores materiales | Alto | `src/data/constants.js:1-131` |
| 7 | Trazabilidad forjable e incompleta | Alto | `src/firebase/auditStore.js:14-27`; `firestore.rules:27-28` |
| 8 | Análisis de IA no persistido | Alto | `src/views/Step4Analisis.jsx:29-41` |
| 9 | Bugs de guardado, offline y Dashboard | Medio-Alto | ver §9 |
| 10 | Documentación desalineada del código | Medio | `README.md`, `AGENTS.md` |

---

## 2. Estado de higiene técnica

| Comprobación | Resultado |
|---|---|
| `npm run build` | OK (≈2,7 s) |
| `npm test` | 36/36 OK |
| `npm run lint` | 0 errores, 4 warnings (`react-refresh` ×2, `exhaustive-deps` en `Step1Datos.jsx:59,73`) |
| `npm audit` (frontend) | 6 vulnerabilidades: `xlsx` **sin fix**, `protobufjs`, `websocket-driver` (crítico) |
| `npm audit` (`functions/`) | 17 vulnerabilidades (2 críticas) en dependencias transitivas de `firebase-admin` |
| Bundle | `xlsx` 425 kB, `jspdf` 399 kB, `Dashboard` 385 kB, `auditStore` 349 kB |
| CI | Solo compila y despliega Hosting; **no ejecuta lint, tests, functions ni rules** |

**Riesgo específico:** `xlsx@0.18.5` tiene CVEs públicos de prototype pollution y ReDoS y **no tiene parche disponible**. La app lo usa para procesar archivos Excel subidos por el usuario, por lo que la superficie de ataque es real. Migrar a `exceljs` o a la distribución oficial actual de SheetJS.

---

## 3. Marco normativo verificado

Corte al 23-oct-2026.

| Norma | Referencia | Estado |
|---|---|---|
| Ley Orgánica de Prevención, Detección y Combate del Delito de LA y Financiación de Otros Delitos | R.O. 4S-610, **29-jul-2024** | Vigente desde **29-jul-2025**; deroga la ley de 2016 |
| Reglamento General | **D.E. 298**, R.O. 3S-216, **2-feb-2026** | Vigente |
| Resolución UAFE-DG-2026-0007 | 29-abr-2026 (R.O. 291, 26-may-2026) | Vigente para ROS / NO ROS |
| Resolución UAFE-DG-2024-0621 | 2-oct-2024 | Capacitación; habría derogado la 2024-0245 |
| Resolución UAFE-DG-2023-0689 | 2023 | Dictada bajo la ley anterior; aplicable solo en lo no sustituido |
| COIP Art. 317 | — | **5–22 años** según monto, asociación delictiva o función pública |
| COIP Art. 318 | — | **Derogado** por la ley LA/FT |
| Decreto Ley 477 | R.O. 700-5S, 10-dic-2024 | **Inconstitucional** (Sent. 94-24-IN/25): no citar sus reformas |

### Plazos y umbrales vigentes

| Obligación | Plazo / umbral |
|---|---|
| ROS | **5 días** desde el conocimiento + **3 días** de prórroga |
| RESU (operaciones ≥ USD 10.000) | Primeros **15 días** del mes siguiente |
| NO-ROS / NO-RESU | **10 días** tras el cierre mensual |
| Conservación documental | **10 años** (art. 48) |
| Sanciones administrativas | **1–10 / 11–20 / 21–40 SBU** |
| SBU 2026 | **USD 482** (Acuerdo MDT-2025-195); 2025 = USD 470 |

**Sanciones en USD (SBU 2026):** leves 482–4.820 · graves 5.302–9.640 · muy graves 10.122–19.280.

### Notas específicas del sector notarial

- **Supervisor:** el **Consejo de la Judicatura** (Ley art. 65), no la UAFE directamente. La UAFE recibe los reportes vía SISLAFT.
- **Ley Notarial art. 19.m:** identificar el medio de pago en actos desde **USD 10.000**.
- **Ley Notarial art. 20.8:** prohibido recibir efectivo por más de **100 SBU** (USD 48.200 con SBU 2026 de USD 482).
- **Art. 47:** sin debida diligencia completa no se inicia la relación ni la transacción; si ya inició, se termina y se reporta.
- **Art. 92:** beneficiario final = quien posee directa o indirectamente **≥10%** del capital o derechos, quien ejerce control efectivo, o el gerente de mayor rango si no se identifica a nadie más.
- **PEP:** condición por **2 años** tras el cese; familiares hasta 4.º grado de consanguinidad y 2.º de afinidad, y asociados cercanos. Exige EDD reforzada y aprobación de alta gerencia. **No es motivo para negar el servicio.**
- **Art. 62 / Reglamento art. 68:** **reserva del ROS**; prohibido revelar su existencia.

---

## 4. Errores en el contexto legal embebido

`CONTEXTO_LEGAL_COMPLETO_ECUADOR` alimenta cada prompt de IA, por lo que un error aquí contamina todos los dictámenes.

| Línea | Dice | Realidad |
|---|---|---|
| 6 | Publicada 28-jul-2024 | **29-jul-2024** |
| 10 | Graves 10–50 SBU | **11–20 SBU** |
| 13 | Muy graves: cancelación del código | **21–40 SBU**; no existe cancelación autónoma |
| 34 | Arts. 52–54 de la 2023-0689 aplican a notarios | Aplican a **abogados y contadores**; notarios = **art. 47** |
| 44–49 | Res. 2025-0007 "reforma integral" | Solo **prórroga** del informe anual a 31-mar-2025 |
| 30 | 2011-054 reformada por 2025-0005 | La 2025-0005 reforma la 2011-**0062** (registradores) |
| 116 | Conservar **7 años** | **10 años** (art. 48) |
| 120 | COIP art. 317: 1–13 años | **5–22 años** |
| 121 | Art. 318 vigente, 3–5 años | **Derogado** |
| 127–131 | SBU USD 460 | **470 (2025) / 482 (2026)** |
| 85 | Señal: compraventa > USD 100.000 | El umbral legal de identificación de medio de pago es **USD 10.000** |
| 27 | Cita `UAF-DG-2011-054` | No localizada en fuente oficial; retirar o marcar como no verificada |

**Ausencias graves:**

- No menciona el **Reglamento D.E. 298 de 2026** ni sus disposiciones sobre oficial de cumplimiento propio por notaría y ROS con independencia del monto.
- No cita la **Ley Notarial art. 19.m** ni el **art. 20.8**.
- No incorpora el **art. 47** (sin DDC completa no se inicia la operación).
- No fija el **beneficiario final ≥10%** (art. 92).
- No recoge la **reserva del ROS** (art. 62).
- No advierte sobre la **inconstitucionalidad del Decreto Ley 477**.

**Precisión importante:** el umbral de reporte de **USD 10.000 sí está correcto** en `constants.js:14` y `:109`. El problema es la *señal de riesgo* de la línea 85, que usa 100.000 como criterio de alerta y está 10× por encima del umbral legal.

### Acciones sobre el prompt de IA

1. Inyectar el texto consolidado a 03-X-2025 como fuente única.
2. Prohibir inferir artículos o montos: si no consta, responder "no verificable".
3. Fijar la reserva del ROS para que el modelo no reproduzca ni aluda a reportes existentes.
4. Incluir el umbral de 100 SBU en efectivo y la identificación del medio de pago desde USD 10.000.
5. Parametrizar el SBU por año en lugar de fijarlo en el texto.

---

## 5. El motor de riesgo

### 5.1 Verificación numérica

`calculations.js:25` calcula `prob × imp`; `Step2Senales.jsx:33` asigna `prob: presente ? 1 : 0`; `imp` llega a 5; los pesos suman **0,999** (`constants.js:364`).

| Escenario | Resultado | Nivel |
|---|---|---|
| 56 señales, P=5, I=5 (inalcanzable desde la UI) | 25 | ALTO |
| UI: todas presentes, gravedad 5 | **5** | BAJO |
| UI: todas presentes, gravedad 1 | 1 | BAJO |
| Una señal crítica de identidad | 0 | BAJO |
| Tres señales críticas de bienes raíces | 0 | BAJO |
| Importador con sus 14 reglas al máximo | 0,90 | BAJO |
| Inherente 25 + 10 controles perfectos | 13 | MEDIO |

Con cortes **8/14/19/25** (`constants.js:142-145`), **todo caso cae en BAJO** y `notifyHighRiskCase` (umbral 20, `functions/index.js:86`) nunca se dispara.

### 5.2 Defectos de diseño

- **Dilución:** divide por `factor.subcriterios.length` aunque falten señales (`calculations.js:31`). Lo no evaluado baja el riesgo en vez de marcarse "no verificado".
- **Residual artificial:** `efectividad / controlesExistentes` (`calculations.js:84`). Un solo control perfecto reduce 20 → 10 y "compensa" nueve ausentes.
- **Redondeo antes de clasificar** (`calculations.js:45`), con saltos en los límites.
- **Doble conteo:** SA23 (fraccionamiento) y SA75 (compras múltiples) activan el mismo hecho.
- **Escalas mezcladas:** probabilidad binaria × impacto ordinal, sin anclas de frecuencia ni calibración.

### 5.3 Fórmula corregida

```text
R_f   = Σ(P_i · I_i) / n_f          // P_i, I_i ∈ [1,5]
Score = round( Σ( (w_f / Σw) · R_f ) )
```

Normalizar los pesos por su suma real, no redondear hasta el final, y tratar las señales no evaluadas como "no verificadas" (elevan el nivel, no lo bajan). En la UI binaria actual: `P_i = 5` si está presente, `1` si no. Alternativa para evitar dilución: `R_f = 0,5·max(P_i·I_i) + 0,5·mean(P_i·I_i)`.

Residual:

```text
E        = Σ(existe ? efectividad/3 : 0) / total_controles
residual = round( inherente · (1 − 0,5·E) )
```

### 5.4 Knock-outs (reglas duras fuera del score)

Deben forzar debida diligencia reforzada con independencia del score:

- PEP (no implica negar el servicio: sí EDD reforzada + aprobación de alta gerencia).
- Beneficiario final no identificado tras 2 requerimientos → no iniciar.
- Efectivo ≥ 100 SBU → impedir protocolización.
- País en lista FATF o paraíso fiscal.
- ≥3 actos < USD 10.000 que sumen ≥ USD 30.000 en 30 días.
- Pagador ≠ comprador sin vínculo declarado.
- Empresa < 12 meses + objeto genérico + activo > USD 100.000.
- Reventa < 12 meses con plusvalía > 30%.
- Desviación precio vs. avalúo > 30%.
- Pago en activos virtuales.

---

## 6. Screening de listas

`src/utils/sanctionsCheck.js` no hace screening:

- `LISTAS_EJEMPLO` con nombres verosímiles que pueden coincidir con personas reales.
- `verificarDocumentoUAFE()` marca alerta según los **dos últimos dígitos de la cédula**. Genera falsos positivos difamatorios y falsos "limpios" con apariencia de verificación.
- Levenshtein sobre la cadena completa castiga el orden de nombres ("JUAN PEREZ" vs "PEREZ JUAN"), los alias y los nombres compuestos: exactamente la realidad ecuatoriana.

### Fuentes realmente disponibles (23-oct-2026)

| Fuente | Acceso | Coste | Veredicto |
|---|---|---|---|
| OFAC SDN / Consolidated | CSV/XML oficial; sin API REST documentada | Gratis | Imprescindible |
| ONU Consolidated | XML, regenerado a diario | Gratis | Imprescindible |
| UK Sanctions List | CSV/XML, OGL v3.0 (la OFSI Consolidated dejó de actualizarse el 28-ene-2026) | Gratis | Recomendada |
| UE FSF | Requiere token; sin token devuelve 403 | Gratis con registro | Útil si hay nexo UE |
| **PEP Ecuador** | **No existe lista nominal pública ni API**; solo catálogo de cargos de 2022 | — | Lista interna + declaración jurada |
| INTERPOL | Sin API y **prohíbe uso comercial** | — | **No automatizar** |
| OpenSanctions | API + bulk + self-hosting; CC BY-NC | Licencia comercial | Mejor relación coste/cobertura |
| ComplyAdvantage | API | Desde USD 99/mes | Puente razonable |

### Arquitectura recomendada

```text
Scheduler diario → Cloud Function de ingesta
  → snapshot crudo inmutable en GCS (hash + fecha)
  → parser/normalizador → Firestore (metadatos, versiones)
  → índice Typesense/Elasticsearch (candidatos)
  → API callable (Auth + App Check) → UI de revisión
  → audit log append-only
```

**Normalización:** mayúsculas, NFKD, eliminación de tildes, `Ñ→N` solo en la clave, colapso de espacios, eliminación de puntuación, sufijos societarios (`S.A.`, `CÍA. LTDA.`), partículas (`DE`, `DEL`, `LA`) como tokens de bajo peso. Generar permutaciones de orden (dos nombres + dos apellidos; apellido primero), alias e iniciales.

**Matching en dos etapas:** blocking por prefijos de tokens y clave fonética española (Soundex inglés funciona mal en español), luego ensemble Jaro-Winkler + token-set ratio + Levenshtein normalizado, con coincidencia exacta de cédula/RUC/pasaporte como señal fuerte.

**Umbrales de partida (a calibrar):** <70 descartar · 70–89 revisión manual · ≥90 revisión prioritaria. Nunca bloqueo automático sin revisión humana.

**Auditoría:** guardar consulta, versión/hash de lista, puntuación, candidatos, decisión y revisor. Re-screening automático al cambiar la versión de lista.

---

## 7. Seguridad y datos personales

| Hallazgo | Evidencia | Riesgo |
|---|---|---|
| **36.981 registros PII** (nombre, cédula, correo, teléfono) en 3,7 MB público | `public/data/clientes.json`, cargado en `src/main.jsx:30` | **Crítico** (LOPDP) |
| `allow list` para cualquier usuario autenticado | `firestore.rules:6,24` | **Crítico**: enumera casos y logs ajenos |
| `analyzeCase` abierta | `functions/index.js:15-17`: `onRequest`, `cors: true`, sin ID token, App Check ni rate limit | **Crítico**: abuso de cuota y prompt injection |
| Registro abierto + scores forjables | `src/context/AuthContext.jsx:30-31`; las reglas no validan `scores` ni `evaluaciones` | **Alto** |
| Borrador con PII en `sessionStorage` | `src/context/CaseContext.jsx:70`, cada 10 s | **Alto** |
| Audit log forjable | `firestore.rules:27-28`; el cliente crea el documento | **Alto** |
| `xlsx@0.18.5` | CVEs de prototype pollution y ReDoS, **sin fix** | **Medio-Alto** |
| Sin CSP ni cabeceras de seguridad | `firebase.json` | **Medio** |
| Push roto | No existe `public/firebase-messaging-sw.js`; `src/firebase/messaging.js:40` pide token igualmente | **Medio** |
| API key de Firebase hardcodeada como fallback | `src/firebase/config.js:5` | **Medio** (clave web pública, pero riesgo operativo) |

**Positivo:** la clave de Groq es un secreto de Cloud Functions, no está en el cliente. No se encontró `dangerouslySetInnerHTML`.

---

## 8. Trazabilidad y gobierno de IA

- Solo se registra `CASE_CREATED` (`src/utils/storage.js:64`). `CASE_UPDATED`, `CASE_DELETED`, `ANALYSIS_GENERATED` y `EXPORTED_PDF` están definidos (`src/firebase/auditStore.js:84-89`) pero **nunca se emiten**.
- **`auditSchema.js` está muerto**: nadie lo importa. La salida del LLM se procesa con `JSON.parse` sin validación (`src/utils/geminiApi.js:176-180`), y `meta.modelo_ia` lo declara el propio modelo (`src/utils/auditTransformer.js:12`).
- El análisis individual **no se persiste** (`src/views/Step4Analisis.jsx:29-41`); se pierde al recargar y el PDF puede incluir contenido no guardado. El batch sí guarda (`src/App.jsx:198`), pero sin auditoría ni validación de esquema.
- `datos.ofac/onu/pepUafe` nunca se actualizan tras verificar, así que el prompt siempre envía "No verificado" (`src/views/Step1Datos.jsx:254-276`; `src/utils/geminiApi.js:106`).
- El contexto legal está **duplicado** en `src/data/constants.js` y `functions/legalContext.js` (7.485 caracteres idénticos): dos fuentes que pueden divergir.
- No hay campo de beneficiario final, ni carga de evidencias documentales, ni estado de envío ROS, ni revisión periódica programada.

---

## 9. Bugs funcionales

| Bug | Evidencia | Impacto |
|---|---|---|
| Guardados duplicados | `src/context/CaseContext.jsx:152-155` + `src/firebase/firestore.js:8` (`addDoc`) | Cada guardado crea un caso; no hay edición real |
| Autoguardado espera 12 controles | `src/context/CaseContext.jsx:68` vs 10 en `constants.js` | Nunca se cumple la condición |
| Borrado offline erróneo | `src/utils/storage.js:59,101-103` vs `offlineSync.js:12` | No borra el pendiente de IndexedDB |
| Pendientes invisibles online | `src/utils/storage.js:83-87` | Casos offline desaparecen al reconectar |
| Botones del Dashboard muertos | `src/views/Dashboard.jsx:365,373,381` | Abrir/analizar/exportar no hacen nada |
| Factores mal clasificados | `src/views/Dashboard.jsx:94-97` | Todas las SA* caen en CUMPLIMIENTO; gráficos falsos |
| Filtro OFAC nunca coincide | `src/components/CaseManager.jsx:84-85` vs `Step1Datos.jsx:254-276` | Filtro siempre vacío |
| Plantilla pisa el monto | `src/views/Step1Datos.jsx:128-132,151` | Cambia el valor por 25k/50k/100k |
| Importación O(n²) y stats falsos | `src/views/Step1Datos.jsx:322-336` → `getAllCases` por fila; `skipped.duplicate` nunca incrementa | Lentitud y reporte de importación incorrecto |
| Verificación arrastrada | `src/views/Step1Datos.jsx:213-229` | Un cliente hereda el screening del anterior |
| Reporte mensual incoherente | `src/utils/monthlyReport.js:29,43,55` | Suma `prob×imp` (máx. 280) y lo etiqueta `/25`; trunca a 50 casos |

**Cobertura del catálogo:** solo **14 de 56 señales** se autoevalúan desde Excel (`src/utils/excelParser.js:25-92`). Las otras 42 quedan en 0 sin advertencia.

**Documentación vs. código:**

| Tema | Documentación | Código real |
|---|---|---|
| Motor de IA | Gemini 2.5 Flash, `onCall`, `GEMINI_API_KEY` | Groq `llama-3.3-70b-versatile`, `onRequest`, `GROQ_API_KEY` |
| Salida estructurada | Schema de 11 secciones | `auditSchema.js` sin usar; solo `JSON.parse` |
| Controles | 10 | 10 en `constants.js`, pero el autoguardado exige 12 |
| Pesos | Suma 1.0 | 0,999 |
| Estado | `useReducer` | `useState` |

---

## 10. Matriz de brechas normativas

| Requisito | Estado en código | Riesgo | Recomendación |
|---|---|---|---|
| Enfoque basado en riesgos calibrado (Reglamento art. 29) | Score por señal 0/1 → 5/1, impacto y peso normalizado; tablero de calidad con señales de sub/sobrestimación y tiempo de cierre | **Medio** | Acumular ROS históricos etiquetados para calibrar pesos |
| DDC y beneficiario final (arts. 47, 92) | Checklist DDC bloqueante, BF con cadena de propiedad y expediente de evidencias con hash SHA-256 | **Bajo** | Verificación periódica de integridad |
| PEP y listas restrictivas | Snapshots locales de OFAC/ONU/UK/PEP con versión, fecha y hash; estados `no_configurado`/`no_encontrado`/`posible`/`coincidencia` | **Medio** | Carga periódica de listas y revisión humana documentada |
| Señales no deducibles del reporte | 20 señales marcadas como manuales en Step2 | **Bajo** | Entrevista y documentación soporte |
| RESU/NO-RESU (USD 10.000; 15/10 días) | Calculadora de plazos y seguimiento (estado, responsable, envío, acuse) | **Medio** | Integración real con SISLAFT (P2) |
| ROS/NO-ROS (5+3 días; reserva art. 62) | Panel de seguimiento con plazo, prórroga, estado y acuse; el PDF ROS sigue siendo el documento a presentar | **Medio** | Firma electrónica y acuse automatizado (P2) |
| Conservación 10 años y trazabilidad | Audit trail server-side con SHA-256 encadenado; el cliente solo lee | **Medio** | Política de retención, respaldo y verificación periódica |
| Protección de datos (LOPDP) | JSON público + `sessionStorage` | **Crítico** | Retirar JSON, controlar acceso, cifrar |
| Código SISLAFT, OC, Manual, EBR anual | Panel en el perfil con fechas de designación, manual, EBR y capacitación, y alertas de vencimiento | **Bajo** | Confirmar requisitos en el portal UAFE |
| Capacitación (Res. 2024-0621) | Registro por jornada con horas, participantes, responsable y certificado con hash SHA-256; vigencia anual calculada | **Bajo** | Cargar el plan anual y conservar certificados |
| Prohibición de efectivo > 100 SBU | No implementada | **Alto** | Bloqueo en el flujo de protocolización |
| Gobierno de IA y no repudio | Salida validada y versionada: `_meta` con modelo, prompt, contexto legal y fecha, visible en Step4, PDF/Excel y audit trail | **Bajo** | Mantener el versionado al cambiar prompt o contexto |

---

## 11. Roadmap

### P0 — antes de cualquier piloto (0–30 días)

| Acción | Esfuerzo | Impacto |
|---|---|---|
| Retirar `public/data/clientes.json` del hosting y purgar la PII | S | Elimina exposición crítica |
| Endurecer `firestore.rules`: quitar `allow list`, validar schema y scores, cerrar registro abierto | M | Evita fuga y forja |
| Autenticar `analyzeCase` con ID token + App Check + rate limit | M | Cierra proxy abierto |
| Corregir scoring, residual, umbrales y notificación; tests de regresión | M | Restaura la lógica LA/FT |
| Desactivar screening simulado y eliminar `verificarDocumentoUAFE` | S | Evita decisiones legales falsas |
| Corregir contexto legal (10 años, sanciones, COIP, SBU 482, Reglamento 298, Ley Notarial) | S | Dictámenes correctos |
| Bloquear avance sin DDC completa y sin BF; impedir efectivo > 100 SBU | M | Cumple art. 47 y art. 20.8 |

### P1 — 60–90 días

- ~~Persistir el análisis de IA, validar con `AUDIT_RESPONSE_SCHEMA` y versionar prompt/modelo/contexto~~: implementado con `_meta`, validación previa y trazabilidad en PDF, Excel y audit trail.
- ~~Audit trail server-side, append-only y con hash encadenado~~: `auditCaseChanges` escribe `audit_logs` y `audit_heads` con SHA-256; el cliente solo lee.
- ~~Workflow ROS/NO-ROS/RESU/NO-RESU con estados, responsable, plazo y acuse~~: panel en Step4 y cálculo de plazos en `obligaciones.js`.
- ~~Corregir duplicados y offline~~: caché persistente de Firestore, borradores atribuidos a su usuario, sincronización idempotente por `clientCaseId` y alerta de posibles duplicados en el portfolio. El Dashboard y el filtro OFAC se corrigieron en los bloques anteriores; queda revisar el reporte mensual.
- ~~Screening real OFAC + ONU + UK con snapshots versionados~~ y ficha de descarte de falsos positivos: implementado para OFAC, ONU, UK (Name 1..N) y lista PEP interna con hash, con revisión documentada y bloqueo de la DDC.
- ~~Ampliar el parser a las 56 señales o declarar explícitamente las no soportadas~~: 36 auto-evaluadas con motivo y 20 declaradas manuales.
- ~~Módulo de beneficiario final con cadena de propiedad~~: implementado con participación efectiva, umbral del 10% y fallback al gerente de mayor rango.
- ~~Módulo de cumplimiento: código SISLAFT, OC, Manual y EBR anual con alertas de vencimiento~~: implementado en el perfil y el Dashboard; solo alerta, no bloquea.

### P2 — 3–12 meses

- ~~Perfil transaccional y monitoreo continuo de desviaciones~~: perfil por cliente (monto, acto, pago, origen y frecuencia), alertas en Step1 y en el portfolio, y registro en el dictamen y el audit trail.
- ~~Tablero de calidad del modelo~~: cruza score y decisión de reporte para señalar posibles subestimaciones y sobreestimaciones, riesgo alto sin decisión, ROS vencidos, cobertura de IA, versiones y tiempo de cierre. Falta acumular ROS históricos etiquetados para calibrar pesos.
- ~~Gestión documental con evidencias y hash~~: expediente con SHA-256, verificación de integridad, exportación y registro en el audit trail; los archivos permanecen en el dispositivo.
- ~~Módulo de capacitación con registro y evidencias~~: registro por jornada con horas, participantes, responsable y certificado o lista de asistencia con hash SHA-256; vigencia anual calculada y alerta de horas.
- ~~Tests de reglas con emulador~~: `tests/rules/` cubre aislamiento por usuario, filtro `userId` y audit trail server-only; el CI ejecuta `npm run test:rules` además de lint, tests, auditorías y build. Faltan e2e y observabilidad.
- Alinear `README.md` y `AGENTS.md` con el código; unificar el contexto legal.
- ~~Purga de archivos de evidencia huérfanos en IndexedDB~~: análisis con vista previa, confirmación explícita y periodo de gracia de 7 días; conserva los borradores pendientes como referencia. Falta la política formal de retención y la evaluación de impacto en protección de datos.
- Migrar `xlsx` a `exceljs` o a SheetJS actualizado.
- ~~Cobertura e2e del flujo crítico~~: Playwright contra los emuladores de Auth y Firestore, con job propio en CI; cubre login, wizard, exportación PDF y guardado del caso. Falta observabilidad de errores del cliente y de Functions.

---

## 12. Funcionalidades nuevas recomendadas

1. **Panel de cumplimiento institucional** — estado del código SISLAFT, oficial de cumplimiento designado, Manual registrado, EBR anual, con alertas de vencimiento. Es lo que un supervisor pediría primero y hoy no existe.
2. **Motor de knock-outs** separado del score: reglas duras que fuerzan EDD reforzada o impiden protocolizar.
3. **Perfil transaccional + monitoreo** — comparar cada operación contra el perfil declarado y alertar desviaciones.
4. **ROS asistido** con narrativa, anexos y campos alineados a la Res. 2026-0007, más calendario de plazos.
5. ~~**Expediente digital con evidencias** — escrituras, identificaciones, avalúos, origen de fondos, con hash y sello temporal~~: implementado con SHA-256 local; falta el sello temporal de un tercero de confianza.
6. **Formulario de cliente** (PEP, origen de fondos, BF) que alimente el caso y quede firmado.
7. **Re-screening automático** al actualizar una lista, con cola de revisión y ficha de descarte de falsos positivos.
8. ~~**Tablero de calidad del modelo** — precisión, falsos positivos, casos estancados, tiempos de cierre~~: implementado como señales de revisión, no como tasas reales de FP/FN mientras no haya verdad de referencia.
9. **Integración con el sistema notarial** (API) para no duplicar captura.
10. **Modo multi-notaría** con roles (notario, oficial de cumplimiento, analista) y separación de deberes.

---

## 13. Discrepancias entre investigaciones (resueltas)

| Punto | Contradicción | Resolución |
|---|---|---|
| Nomenclatura RESU | Un informe pedía renombrar "RESU"; otro confirma que es el nombre oficial | **RESU/NO-RESU son correctos**. La app ya los usa bien en `constants.js:14-16` |
| Umbral USD 100.000 | Un informe lo señaló como umbral legal erróneo | El umbral legal (10.000) **está correcto**; el problema es la *señal de riesgo* de `constants.js:85` |
| Resolución de capacitación | 2024-0245 vs 2024-0621 | La **0621 (oct-2024) derogaría la 0245**; verificar en SISLAFT antes de fijarla como regla |
| Fecha Res. 2026-0007 | 29-abr-2026 vs R.O. 291 del 26-may-2026 | Compatible: emitida en abril, publicada en mayo |
| Conservación | 7 vs 10 años | **10 años**, unánime (art. 48) |

---

## 14. Límites de esta auditoría

- Sin acceso runtime a Firebase, Groq ni a SISLAFT; no hubo pentest.
- La explotabilidad de `xlsx@0.18.5` se asume porque procesa archivos del usuario.
- No existe confirmación pública de una resolución del Consejo de la Judicatura que fije el procedimiento notarial de reporte (disposición transitoria segunda del Reglamento). Es un vacío normativo real.
- Los requisitos de Oficial de Cumplimiento y código SISLAFT deben confirmarse en el portal antes de convertirlos en validaciones duras.
- Los resultados numéricos provienen de una reimplementación del cálculo y de la ejecución local de tests y lint; no de datos reales de producción.

---

## 15. Anexo: comandos de verificación

> Estado **al momento de la auditoría**. Para el estado actual, ver la sección 16.

```bash
npm run lint     # 0 errores, 4 warnings
npm test         # 36/36
npm run build    # OK
npm audit        # 6 vulnerabilidades (frontend)
cd functions && npm audit   # 17 vulnerabilidades
```

**Verificación manual del bug de scoring:** en `Step2Senales.jsx:33` la probabilidad es `presente ? 1 : 0`; en `calculations.js:25` se multiplica por `imp` (máx. 5); los pesos suman 0,999. Por tanto el máximo real es `Σ(5 × peso) = 4,995 → 5`, frente a umbrales de 8/14/19/25.

---

## 16. Estado de las correcciones (actualización posterior)

Aplicado en los 19 commits posteriores a `c1af54c`, de `e909d25` a `0f12c98`: scoring y residual (`e909d25`), seguridad y reglas (`9638a21`), DDC/BF (`995a9b5`), workflow RESU/ROS (`24584f6`), cumplimiento (`a23357a`), snapshots de listas (`abeba78`), parser de señales (`8485a88`), versionado IA (`1560ea5`), cadena de propiedad (`86f9284`), lista UK (`816ed84`), revisión de falsos positivos (`7aa89fa`), evidencias con hash (`361be9d`), CI (`78159f8`), perfil transaccional (`19604dd`), capacitación (`22aed50`), calidad del modelo (`6043cdb`) y tests de reglas (`0f12c98`). Verificación actual: `npm test` 245/245 + 13 de reglas, `npm run lint` 0 errores (4 warnings preexistentes), `npm run build` OK y `npm audit` **0 vulnerabilidades** (frontend y `functions/`).

| Hallazgo | Estado | Nota |
|---|---|---|
| Scoring colapsado (máx. real 5/25) | **Corregido** | Señal presente = prob. 5, ausente = 1; mezcla 50% media + 50% máximo por factor; pesos normalizados por su suma real |
| Residual mal calculado | **Corregido** | Denominador fijo de 10 controles y reducción máxima del 50% |
| Contexto legal desactualizado | **Corregido** | Ley LA/FT 2024, Reglamento D.E. 298, COIP 317/318 derogado, sanciones 1–10/11–20/21–40 SBU, retención 10 años, efectivo 100 SBU = USD 48.200 |
| Deriva cliente/servidor del contexto legal | **Corregido** | `functions/legalContext.js` replicado y test anti-deriva |
| Screening con listas ficticias y verificación por cédula | **Corregido** | Sin fuente configurada el estado es `no_configurado`; nunca “limpio”. Snapshots oficiales de OFAC, ONU, UK y PEP con versión, fecha y SHA-256, más ficha de descarte de falsos positivos con responsable y justificación |
| PII pública (`clientes.json`) | **Corregido** | Retirado de `public/`; carga manual desde archivo local; `data-local/` ignorado |
| Reglas Firestore demasiado abiertas | **Corregido** | `list/get` exigen `userId`; `audit_logs`/`audit_heads` solo los escribe la Function. Falta probar con emulador |
| `analyzeCase` abierta a Internet | **Corregido** | Bearer token con revocación, POST, CORS, límites y rate limit por usuario. App Check opcional disponible (`ENFORCE_APP_CHECK=true`) |
| Efectivo > 100 SBU | **Corregido** | Bloqueo en `Step1Datos` + validación de medio de pago desde USD 10.000 |
| Duplicados, offline y Dashboard | **Corregido** | Guardado por `updateCase`, pendientes visibles/actualizables, navegación real, análisis IA persistido |
| Parser de 56 señales | **Corregido (parcial)** | Inicializa las 56; 36 se auto-evalúan con reglas trazables y motivo visible, 20 se marcan como manuales porque requieren documentos o entrevista |
| `xlsx@0.18.5` con CVEs sin parche npm | **Corregido** | Migrado a SheetJS 0.20.3 (tarball oficial) más overrides de `websocket-driver`, `zod` y `@grpc/grpc-js`; `npm audit` en 0 |
| Dependencias sin declarar | **Corregido** | `react-router-dom` y `react-is` no figuraban en `package.json`; ahora son dependencias directas |
| Audit trail server-side con hash | **Corregido** | `auditCaseChanges` registra cada escritura con SHA-256 encadenado; el cliente no puede crear ni alterar logs |
| Salida de IA sin validar | **Corregido** | `auditValidator.js` valida el JSON contra `AUDIT_RESPONSE_SCHEMA` antes de mostrarlo o exportarlo |
| Versionado del dictamen | **Corregido** | `_meta` con modelo, `promptVersion`, `contextoVersion` y fecha; se muestra en Step4, se exporta en PDF/Excel y queda en `audit_logs` |
| DDC/BF (arts. 47, 92) | **Corregido (parcial)** | Checklist DDC bloqueante, BF con cadena de propiedad y participación efectiva, y evidencias documentales con hash SHA-256; todo se incluye en prompt, PDF, Excel, ROS y audit trail. Falta sello temporal de tercero |
| RESU/NO-RESU y ROS/NO-ROS como workflow | **Corregido (parcial)** | Panel en Step4 con plazo calculado, estados, responsable, fecha de envío y acuse; falta integración con SISLAFT |
| Código SISLAFT, OC, Manual, EBR y capacitación | **Corregido** | `cumplimiento.js` evalúa vigencia anual y alerta vencimientos en el perfil y el Dashboard; la capacitación tiene registro detallado con evidencia y hash. No bloquea operaciones |

**Acciones inmediatas recomendadas tras el despliegue de estas correcciones:**

1. Purgar copias del antiguo `clientes.json` en cachés CDN, `dist/` y respaldos; rotar cualquier credencial que haya estado expuesta.
2. Desplegar `firestore.rules` y las Functions juntas: el cliente ya envía el token, pero una Function vieja seguiría aceptando llamadas sin él.
3. Configurar `ALLOWED_ORIGINS` con el dominio real de la notaría.

---

*Este informe es técnico y no constituye asesoría legal. Los umbrales, plazos y requisitos deben validarse con el oficial de cumplimiento y un abogado ecuatoriano antes de convertirlos en reglas duras del sistema.*
