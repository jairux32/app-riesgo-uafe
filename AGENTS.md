# AGENTS.md

**app-riesgo-uafe** — Sistema de Análisis de Riesgo LA/FT con IA para el sector notarial ecuatoriano.

## Tech Stack
- React 19 + Vite 8
- JavaScript (no TypeScript)
- Firebase 12: Auth, Firestore, Cloud Functions, Cloud Messaging
- AI: Groq (`llama-3.3-70b-versatile`) vía Cloud Function autenticada
- Routing: react-router-dom
- Local Storage: IndexedDB (vía idb)
- Exports: jspdf, SheetJS 0.20.3, ROS
- Tests: vitest + @testing-library/react

## Commands
```bash
npm run dev        # Dev server (http://localhost:5173)
npm run build      # Build to dist/
npm run lint       # ESLint check
npm run preview    # Preview dist/ build
npm test           # Run tests (vitest)
npm run test:watch # Tests in watch mode
npm run test:rules # Tests de reglas con el emulador (requiere Java)
```

## Architecture & Flow
- **Entry**: `src/main.jsx` — BrowserRouter + AuthProvider + Service Worker
- **Router**: `src/App.jsx` — Rutas: `/` (wizard), `/dashboard`, `/profile`
- **State**: `src/context/CaseContext.jsx` — Context con useState + useMemo (caseId, análisis IA, autoguardado)
- **Auth**: `src/context/AuthContext.jsx` — Firebase Auth (login, register, logout)

### Wizard Steps
1. `src/views/Step1Datos` → Captura datos básicos + importación masiva Excel + DDC y beneficiario final
2. `src/views/Step2Senales` → Evaluación de 56 señales de alerta UAFE (7 categorías)
3. `src/views/Step3Controles` → Evaluación de 10 controles internos
4. `src/views/Step4Analisis` → Dictamen jurídico con IA + exportación PDF/Excel/ROS

### Utils (src/utils/)
- `storage.js` — Fachada Firestore + IndexedDB (offline-first)
- `calculations.js` — Scores inherente y residual (probabilidad 5/1, pesos normalizados)
- `geminiApi.js` — Cliente de la Cloud Function de análisis (Bearer token)
- `excelParser.js` — Parser reportes UAFE + auto-evaluación de 36 señales; 20 declaradas manuales
- `exportUtils.js` — Barrel re-export: `excelExport.js`, `pdfExport.js`, `rosExport.js`
- `auditSchema.js` — JSON Schema para salida estructurada del modelo
- `auditValidator.js` — Valida el dictamen del modelo contra el schema antes de usarlo
- `auditTransformer.js` — Transforma JSON del modelo a formato display
- `alertasInteligentes.js` — Alertas de portfolio (estancados, recurrentes, vencidos)
- `sanctionsCheck.js` — Screening con Levenshtein; `no_configurado` si no hay fuente
- `validators.js` — Cédula/RUC/pasaporte + límite de efectivo (100 SBU)
- `obligaciones.js` — Plazos y seguimiento de RESU/NO-RESU y ROS/NO-ROS
- `cumplimiento.js` — Código SISLAFT, OC, manual, EBR y capacitación con alertas de vencimiento
- `listasDB.js` — Snapshots de OFAC/ONU/UK/PEP en IndexedDB con versión, fecha y hash
- `revisionCoincidencias.js` — Ficha de descarte/confirmación y bloqueo de DDC
- `evidencias.js` — Expediente documental, hash SHA-256 y verificación de integridad
- `evidenciasDB.js` — Archivos de evidencia en IndexedDB (nunca se suben a la nube)
- `purgaEvidencias.js` — Detección y purga de archivos de evidencia huérfanos con periodo de gracia
- `perfilTransaccional.js` — Perfil del cliente y desviaciones de monto, acto, pago, origen y frecuencia
- `capacitacion.js` — Registros de capacitación anual, horas, participantes, vigencia y evidencia con hash
- `calidadModelo.js` — Tablero de calidad: distribución, señales de calibración, versiones de IA y tiempos de cierre
- `beneficiarioFinal.js` — Cadena de propiedad, participación efectiva y umbral del 10%
- `offlineSync.js` — Sincronización offline con IndexedDB
- `sincronizacion.js` — Atribución de borradores por usuario, reintentos idempotentes y detección de duplicados
- `monthlyReport.js` — Reporte mensual PDF
- `clientsDB.js` — Base local de clientes (IndexedDB), carga manual

### Data (src/data/)
- `constants.js` — Contexto legal, catálogos UAFE, factores de riesgo, controles, SBU
- `demoCase.js` — Caso demo

### Firebase (src/firebase/)
- `config.js` — Configuración con variables de entorno (import.meta.env.VITE_*)
- `firestore.js` — Operaciones CRUD Firestore
- `auditStore.js` — Audit trail
- `profileStore.js` — Perfil de notaría
- `messaging.js` — Notificaciones push (FCM)

### Backend (functions/)
- `analyzeCase` (`onRequest`) — Proxy autenticado hacia Groq con `defineSecret('GROQ_API_KEY')`; exige Bearer token, CORS restringido, rate limit por usuario y App Check opcional (`ENFORCE_APP_CHECK=true`)
- `notifyHighRiskCase` (`onDocumentCreated`) — Push notification cuando score ≥ 20
- `auditCaseChanges` (`onDocumentWritten`) — Escribe `audit_logs` y `audit_heads` con cadena de hashes SHA-256; el cliente no puede escribir esas colecciones
- `legalContext.js` — Contexto legal inyectado como system prompt (copia de `constants.js`)

## Key Features (Advanced)
- **Excel Importer**: Procesa reportes UAFE con mapeo dinámico de columnas + auto-evaluación
- **Auto-Evaluation**: Sugiere valores con motivo trazable en 36 señales; 20 quedan marcadas como manuales
- **Batch Processing**: Análisis secuencial de múltiples casos desde el historial
- **Legal Export**: PDF con dictamen formal, bloques de firma, ROS estructurado
- **Offline**: caché persistente de Firestore (las escrituras se encolan y se envían al reconectar) más IndexedDB para los borradores creados sin conexión; la sincronización se atribuye al usuario que creó el borrador y es idempotente por `clientCaseId`
- **Structured AI Output**: JSON con schema de 11 secciones (dictamen, señales, fundamento legal, obligaciones, etc.)

## Important Constraints
- **Legal Context**: `CONTEXTO_LEGAL_COMPLETO_ECUADOR` vive en `src/data/constants.js` y se replica en `functions/legalContext.js`. Se inyecta server-side como system prompt; el test `src/test/legalContext.test.js` falla si divergen. Al modificarlo, subir `LEGAL_CONTEXT_VERSION` en `functions/index.js`.
- **Trazabilidad IA**: `analyzeCase` devuelve `meta` (modelo, `promptVersion`, `contextoVersion`, `generadoEn`); el cliente lo adjunta como `_meta` al dictamen, Step4 lo muestra y `auditCaseChanges` lo copia a `details` del audit trail. Al modificar el prompt o el schema, subir `PROMPT_VERSION` en `src/utils/geminiApi.js`.
- **API Key**: `GROQ_API_KEY` es un secreto de Cloud Functions (`defineSecret`). NUNCA exponer en el cliente.
- **Auth**: `analyzeCase` verifica el ID token de Firebase (incluida revocación) y aplica rate limit en memoria (`RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`); el cliente envía `Authorization: Bearer <token>`.
- **Audit Trail**: `audit_logs` y `audit_heads` son server-only (`firestore.rules`). Se escriben desde `auditCaseChanges`; el cliente solo lee y debe filtrar por `userId`.
- **Env Vars**: Configuración Firebase vía `import.meta.env.VITE_*` (ver `.env.example`).
- **Risk Weights**: Los pesos de `FACTORES_SENALES_UAFE` suman 0,999; se normalizan por su suma real en el motor.
- **DDC/BF**: Checklist de debida diligencia (art. 47) bloqueante y beneficiario final (art. 92) para personas jurídicas, con cadena de propiedad editable y participación efectiva calculada; se incluye en el prompt, PDF, Excel, ROS y audit trail
- **Workflow de reportes**: Panel en Step4 con plazos RESU/NO-RESU y ROS/NO-ROS, estados, responsable, fecha de envío y acuse
- **Screening con snapshots**: Importación de listas OFAC/ONU/UK/PEP (CSV/JSON) con versión, fecha y SHA-256; sin snapshot el estado es `no_configurado`
- **Ficha de falsos positivos**: toda coincidencia `posible`/`coincidencia` exige responsable, fecha y justificación antes de completar la DDC; se exporta y queda en el audit trail
- **Evidencias documentales**: cada archivo se identifica con su hash SHA-256; el archivo queda en IndexedDB y el hash en el caso, el PDF/Excel/ROS y el audit trail. La app verifica integridad, pero no certifica autenticidad. La purga de archivos huérfanos es manual, con vista previa, confirmación y periodo de gracia de 7 días
- **Perfil transaccional**: compara la operación con el historial del cliente (monto, acto, medio de pago, origen y frecuencia); muestra desviaciones en Step1 y en las alertas del portfolio, y las registra en el dictamen y el audit trail
- **Cumplimiento institucional**: Código SISLAFT, designación del OC, manual, EBR y capacitación anual con alertas de vencimiento en el perfil y el Dashboard
- **Capacitación anual**: registro detallado por jornada (tema, horas, participantes, facilitador y responsable) con certificado o lista de asistencia identificada por hash SHA-256; la vigencia usa el registro más reciente y el campo simple queda como respaldo
- **Calidad y calibración**: el Dashboard cruza score y decisión de reporte para señalar posibles subestimaciones (score bajo con ROS) y sobreestimaciones (score alto con NO-ROS), además de riesgo alto sin decisión, ROS vencidos, cobertura de IA, versiones y tiempo de cierre; no son tasas reales de FP/FN
- **Cash Limit**: Efectivo > 100 SBU (USD 48.200 con SBU 2026) bloquea el avance en `Step1Datos`.
- **PII**: `data-local/` y `public/data/clientes.json` están en `.gitignore`. No publicar bases de clientes en Hosting.
- **Build Output**: `dist/` se despliega en Firebase Hosting.
- **Dependencias**: SheetJS 0.20.3 se instala desde el tarball de `cdn.sheetjs.com`; `.npmrc` fija `legacy-peer-deps=true` por el peer opcional `canvas` de jsdom. `overrides` en `package.json` mantiene `npm audit` en 0 (frontend y `functions/`). `react-router-dom` y `react-is` son dependencias directas: no quitarlas.

## Lint & Quality
- Run `npm run lint` before commits. Config in `eslint.config.js`.
- Run `npm test` for unit tests. Config in `vite.config.js` (vitest).
- CI (`.github/workflows/`): Node 22, `npm ci`, lint, tests, tests de reglas con el emulador, `npm audit` (frontend y `functions/`) y build; el deploy de Hosting espera a que pase el job `quality`.
- `tests/rules/firestore.rules.test.js` se ejecuta solo con `npm run test:rules` (emulador de Firestore y Java); no forma parte de `npm test`.
- Tests en `src/test/`: validators, calculations, sanctionsCheck, legalContext, auditValidator, obligaciones, cumplimiento, listasDB, excelParser, beneficiarioFinal, revisionCoincidencias, evidencias, perfilTransaccional, capacitacion, calidadModelo, purgaEvidencias, sincronizacion (262 tests)
- Tests de reglas en `tests/rules/` (13 tests): aislamiento por usuario, filtro `userId` y audit trail server-only

## Testing
- `src/test/setup.js` — Setup de vitest + jest-dom
- `src/test/validators.test.js` — Cédula/RUC/pasaporte + límite de efectivo + DDC/BF
- `src/test/calculations.test.js` — Riesgo inherente/residual
- `src/test/sanctionsCheck.test.js` — Levenshtein/similarity/listas/estados
- `src/test/legalContext.test.js` — Consistencia del contexto legal cliente/servidor
- `src/test/auditValidator.test.js` — Validación del JSON del dictamen de IA
- `src/test/obligaciones.test.js` — Plazos de RESU/NO-RESU y ROS/NO-ROS
- `src/test/cumplimiento.test.js` — Vigencia de los requisitos institucionales
- `src/test/listasDB.test.js` — Parseo de listas restrictivas CSV/JSON
- `src/test/beneficiarioFinal.test.js` — Cadena de propiedad y beneficiario final
- `src/test/revisionCoincidencias.test.js` — Ficha de descarte de falsos positivos
- `src/test/evidencias.test.js` — Hash SHA-256, integridad y evidencias mínimas
- `src/test/purgaEvidencias.test.js` — Archivos huérfanos, periodo de gracia y purga
- `src/test/sincronizacion.test.js` — Borradores por usuario, reintentos idempotentes y duplicados
- `src/test/perfilTransaccional.test.js` — Perfil del cliente y desviaciones
- `src/test/capacitacion.test.js` — Registros, vigencia y evidencia de capacitación
- `src/test/calidadModelo.test.js` — Distribución, calibración, versiones y tiempos de cierre
- `src/test/excelParser.test.js` — Auto-evaluación de señales y parseo UAFE
