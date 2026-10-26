# app-riesgo-uafe

Sistema de Análisis de Riesgo LA/FT con IA para el sector notarial ecuatoriano.

## Descripción

Aplicación web para notarios públicos del Ecuador que permite analizar el riesgo de Lavado de Activos y Financiación del Terrorismo (LA/FT) en actos notariales, siguiendo la metodología EBR (Enfoque Basado en Riesgo) y la normativa de la UAFE (Unidad de Análisis Financiero y Económico).

## Tech Stack
- **React 19** + **Vite 8**
- **JavaScript** (no TypeScript)
- **Firebase 12**: Auth, Firestore, Cloud Functions, Cloud Messaging
- **Groq** (`llama-3.3-70b-versatile`) vía Cloud Function autenticada
- **IndexedDB** (vía `idb`) para persistencia offline
- **react-router-dom** para navegación
- **Exports**: jspdf (PDF), exceljs (Excel), ROS
- **recharts** para visualizaciones

## Comandos
```bash
npm run dev        # Dev server (http://localhost:5173)
npm run build      # Build a dist/
npm run lint       # ESLint check
npm run preview    # Preview dist/ build
npm test           # Ejecutar tests (vitest)
npm run test:watch # Tests en modo watch
npm run test:rules # Tests de reglas con el emulador (requiere Java)
npm run test:e2e   # Flujo e2e con Playwright y emuladores (requiere Java)
```

> **Instalación:** `npm ci` usa `.npmrc` con `legacy-peer-deps=true` por un fallo de npm 10 al resolver el peer opcional `canvas` de jsdom. Excel se genera y se lee con **exceljs**, que se carga en un chunk aparte solo al importar o exportar. `overrides` fija `uuid` para que `npm audit` quede en 0; verificar tras cualquier actualización.

## Configuración
1. Copiar `.env.example` a `.env` y completar las variables de Firebase
2. Configurar el secreto `GROQ_API_KEY` en Firebase Cloud Functions:
   ```bash
   firebase functions:secrets:set GROQ_API_KEY
   ```
3. Para notificaciones push, generar VAPID key en Firebase Console y agregarla a `.env`
4. Opcional: definir `ALLOWED_ORIGINS` (separados por coma) para restringir CORS de `analyzeCase`
5. Opcional: registrar App Check (reCAPTCHA v3) en Firebase Console, poner `VITE_APPCHECK_SITE_KEY` en `.env` y `ENFORCE_APP_CHECK=true` en Functions
6. Opcional: desplegar `logClientError` y poner su URL en `VITE_LOG_ENDPOINT` para recibir los errores del cliente en Cloud Logging (ver Observabilidad)

## Arquitectura

### Frontend
- **Entry**: `src/main.jsx` — ErrorBoundary + BrowserRouter + AuthProvider + Service Worker
- **Router**: `src/App.jsx` — Rutas `/` (wizard), `/dashboard`, `/profile`
- **Estado de caso**: `src/context/CaseContext.jsx` — Context + useState + useMemo
- **Auth**: `src/context/AuthContext.jsx` — Firebase Auth

### Wizard de 4 pasos
1. `Step1Datos` → Captura de datos + importación masiva Excel + DDC y beneficiario final
2. `Step2Senales` → Evaluación de señales de alerta UAFE (56 señales, 7 categorías)
3. `Step3Controles` → Evaluación de 10 controles internos
4. `Step4Analisis` → Dictamen jurídico con IA + exportación PDF/Excel/ROS

### Lógica
- `src/utils/calculations.js` — Scores de riesgo inherente y residual
- `src/utils/geminiApi.js` — Cliente de la Cloud Function de análisis
- `src/utils/excelParser.js` — Parser de reportes UAFE + auto-evaluación de 36 señales (20 manuales)
- `src/utils/exportUtils.js` — Barrel: excelExport, pdfExport, rosExport
- `src/utils/sanctionsCheck.js` — Screening de listas (sin fuentes ficticias)
- `src/utils/validators.js` — Cédula/RUC/pasaporte, límite de efectivo y DDC/BF
- `src/utils/obligaciones.js` — Plazos y seguimiento de RESU/NO-RESU y ROS/NO-ROS
- `src/utils/cumplimiento.js` — Código SISLAFT, OC, manual, EBR y capacitación con alertas
- `src/utils/listasDB.js` — Snapshots de OFAC/ONU/UK/PEP con versión, fecha y hash
- `src/utils/revisionCoincidencias.js` — Ficha de descarte o confirmación de coincidencias
- `src/utils/evidencias.js` — Expediente documental con hash SHA-256 y verificación de integridad
- `src/utils/evidenciasDB.js` — Archivos de evidencia en IndexedDB (solo en el dispositivo)
- `src/utils/purgaEvidencias.js` — Detección y purga de archivos de evidencia huérfanos
- `src/utils/perfilTransaccional.js` — Perfil del cliente y detección de desviaciones (monto, acto, pago, origen, frecuencia)
- `src/utils/capacitacion.js` — Registro de la capacitación anual: horas, participantes, vigencia y evidencia con hash
- `src/utils/calidadModelo.js` — Tablero de calidad, cobertura de IA, señales de calibración y tiempo de cierre
- `src/utils/beneficiarioFinal.js` — Cadena de propiedad y participación efectiva (art. 92)
- `src/data/constants.js` — Contexto legal, catálogos UAFE, factores de riesgo

### Backend
- `functions/index.js`:
  - `analyzeCase` (`onRequest`) — Proxy autenticado (Bearer token) hacia Groq, con rate limit por usuario y App Check opcional; devuelve `meta` (modelo, versión de prompt y del contexto legal)
  - `notifyHighRiskCase` (`onDocumentCreated`) — Notificación push para riesgo ALTO
  - `auditCaseChanges` (`onDocumentWritten`) — Audit trail server-side con cadena de hashes SHA-256; registra la trazabilidad del dictamen (modelo, prompt y contexto)
- `functions/legalContext.js` — Copia del contexto legal inyectado como system prompt (`LEGAL_CONTEXT_VERSION`)

### Persistencia
- `src/utils/storage.js` — Fachada Firestore + IndexedDB (offline)
- `src/utils/offlineSync.js` — Sincronización offline con `idb`
- `src/utils/sincronizacion.js` — Reglas de atribución por usuario, reintentos idempotentes y duplicados
- `src/firebase/firestore.js` — Operaciones Firestore
- `src/firebase/auditStore.js` — Audit trail

### Datos personales
La base de clientes **no se publica** en el hosting. `data-local/` está ignorado por git y la carga se hace manualmente desde la UI (archivo JSON local → IndexedDB).

### Trazabilidad del dictamen
Cada análisis de IA guarda `_meta` con el modelo usado, la versión del prompt (`PROMPT_VERSION` en `src/utils/geminiApi.js`), la versión del contexto legal (`LEGAL_CONTEXT_VERSION` en `functions/index.js`) y la fecha de generación. La metadata se muestra en Step4, se incluye en el PDF/Excel y queda en el audit trail (`audit_logs`). Al cambiar el prompt o el contexto legal hay que subir la versión correspondiente.

### Perfil transaccional
Con las operaciones previas del mismo cliente se calcula su perfil (promedio, máximo, actos, medios de pago, origen y frecuencia). La app compara la operación en curso y alerta desviaciones de monto, acto, medio de pago, origen o frecuencia; el notario decide si las documenta o evalúa un ROS. El resultado se guarda al avanzar de paso y se incluye en el prompt, el PDF, el Excel y el audit trail.

### Calidad y calibración del modelo
El Dashboard cruza el score con la decisión de reporte registrada (ROS/NO-ROS) y muestra señales de posible subestimación (score bajo con ROS enviado) o sobreestimación (score alto con NO-ROS), además de casos de riesgo alto sin decisión de reporte, ROS vencidos, cobertura de dictamen IA, versiones usadas y tiempo de cierre. No calcula falsos positivos o negativos reales porque no hay una verdad de referencia etiquetada: son señales para revisión humana.

### Capacitación anual
El perfil de la notaría permite registrar cada jornada de capacitación con tema, fecha, horas, modalidad, facilitador, participantes, responsable y el hash SHA-256 del certificado o la lista de asistencia. La app calcula la vigencia anual con el registro más reciente, acumula las horas de los últimos 12 meses y muestra una alerta —no un bloqueo— cuando están por debajo de la referencia interna. El campo simple de fecha se conserva para perfiles anteriores y se toma la fecha más reciente entre ambos. El certificado permanece en el dispositivo (IndexedDB).

### Evidencias documentales
Cada archivo adjunto se identifica con su hash SHA-256. El archivo se guarda solo en el dispositivo (IndexedDB) y el caso conserva el nombre, tipo, tamaño y hash; el hash también se exporta y queda en el audit trail. La app puede verificar que el archivo no cambió, pero no certifica su autenticidad ni sustituye la revisión del notario.

El perfil incluye un mantenimiento del almacenamiento local: compara los archivos guardados con las referencias de los casos, los borradores pendientes y las capacitaciones, y muestra qué quedó huérfano. No borra nada sin confirmación y respeta un periodo de gracia de 7 días, porque un archivo recién cargado puede pertenecer a un caso que todavía no se guardó. Al borrar el archivo, el caso conserva el hash pero ya no se puede verificar el documento.

## Observabilidad
Los errores no controlados del navegador, los fallos de la IA, de exportación y de sincronización se registran con `src/utils/observabilidad.js`. Antes de registrar o enviar nada se aplican dos barreras: una redacción de correos, identificaciones y tokens, y una lista blanca de claves de contexto técnico. El prompt, el dictamen y los datos del cliente nunca salen del navegador.

Sin `VITE_LOG_ENDPOINT` los eventos solo van a la consola y a una cola en memoria de 50 elementos (útil en desarrollo). Para centralizarlos, desplegar la Function `logClientError` y definir:

```bash
VITE_LOG_ENDPOINT=https://us-central1-<proyecto>.cloudfunctions.net/logClientError
```

La Function no exige sesión —un error puede ocurrir antes del login— pero valida el evento, vuelve a redactarlo, limita el tamaño a 16 KB y aplica un rate limit por IP (`LOG_RATE_LIMIT_MAX`, por defecto 60 por minuto). Si llega un ID token válido, el evento queda atribuido al usuario. Cada traza es una línea JSON con `severity`, `logType` y campos técnicos, legible directamente en Cloud Logging.

`analyzeCase` registra además una traza por llamada: resultado (`ok`, `rechazado`, `error_proveedor`, `sin_contenido`, `excepcion`), motivo, código HTTP, modelo, versión del prompt y duración. No registra el contenido del prompt ni del dictamen.

## CI
Los workflows de `.github/workflows/` ejecutan con Node 22: `npm ci`, `npm run lint`, `npm test`, tests de reglas con el emulador, `npm audit` (frontend y `functions/`) y `npm run build`. Un job aparte (`e2e`) instala Chromium, levanta los emuladores de Auth y Firestore y corre Playwright. El deploy a Firebase Hosting espera a que pasen `quality` y `e2e`.

## Testing
Tests con **vitest** + **@testing-library/react** (311 tests de unidad):
- `src/test/validators.test.js` — Cédula/RUC/pasaporte, límite de efectivo y DDC/BF
- `src/test/monthlyReport.test.js` — Periodo mensual local, niveles, obligaciones y casos sin evaluar
- `src/test/obligaciones.test.js` — Plazos RESU/NO-RESU y ROS/NO-ROS
- `src/test/cumplimiento.test.js` — Vigencia del cumplimiento institucional
- `src/test/listasDB.test.js` — Parseo de CSV/JSON de listas restrictivas
- `src/test/excelParser.test.js` — Auto-evaluación de señales y parseo UAFE
- `src/test/beneficiarioFinal.test.js` — Cadena de propiedad y beneficiario final
- `src/test/revisionCoincidencias.test.js` — Ficha de descarte de falsos positivos
- `src/test/evidencias.test.js` — Hash SHA-256, integridad y evidencias mínimas
- `src/test/purgaEvidencias.test.js` — Archivos huérfanos, periodo de gracia y purga
- `src/test/sincronizacion.test.js` — Borradores por usuario, reintentos idempotentes y duplicados
- `src/test/perfilTransaccional.test.js` — Perfil del cliente y desviaciones
- `src/test/capacitacion.test.js` — Registros, vigencia y evidencia de capacitación
- `src/test/calidadModelo.test.js` — Distribución, calibración, versiones y tiempos
- `src/test/observabilidad.test.js` — Redacción de PII, contexto permitido, deduplicación y límites
- `src/test/excelExport.test.js` — Exportación del dictamen y del resumen, verificada releyendo el .xlsx

### Flujo e2e
`npm run test:e2e` compila la app, la sirve con `vite preview` y ejecuta Playwright contra los emuladores de Firebase (Auth y Firestore), sin tocar el proyecto real. Cubre el flujo crítico: iniciar sesión, completar los cuatro pasos del wizard y exportar el dictamen en PDF, guardar el caso y verlo reflejado en el Dashboard, y generar el reporte mensual ocultando el recordatorio. La IA no se prueba: la Cloud Function no corre en local.

### Reglas de Firestore
`npm run test:rules` levanta el emulador con `firebase emulators:exec` (vía `npx`, requiere Java) y ejecuta 13 pruebas en `tests/rules/`: aislamiento de casos y perfiles por usuario, filtro obligatorio `userId` en listados, y prohibición de que el cliente escriba `audit_logs` o `audit_heads`.
- `src/test/calculations.test.js` — Cálculos de riesgo inherente/residual
- `src/test/sanctionsCheck.test.js` — Búsqueda fuzzy en listas restrictivas
- `src/test/legalContext.test.js` — Consistencia del contexto legal cliente/servidor
- `src/test/auditValidator.test.js` — Validación del JSON del dictamen de IA

## Despliegue
La carpeta `dist/` se despliega en **Firebase Hosting**. CI/CD vía GitHub Actions (`.github/workflows/`).
