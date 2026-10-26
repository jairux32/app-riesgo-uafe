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
- `excelParser.js` — Parser reportes UAFE + auto-evaluación de las 56 señales
- `exportUtils.js` — Barrel re-export: `excelExport.js`, `pdfExport.js`, `rosExport.js`
- `auditSchema.js` — JSON Schema para salida estructurada del modelo
- `auditValidator.js` — Valida el dictamen del modelo contra el schema antes de usarlo
- `auditTransformer.js` — Transforma JSON del modelo a formato display
- `alertasInteligentes.js` — Alertas de portfolio (estancados, recurrentes, vencidos)
- `sanctionsCheck.js` — Screening con Levenshtein; `no_configurado` si no hay fuente
- `validators.js` — Cédula/RUC/pasaporte + límite de efectivo (100 SBU)
- `obligaciones.js` — Plazos y seguimiento de RESU/NO-RESU y ROS/NO-ROS
- `cumplimiento.js` — Código SISLAFT, OC, manual, EBR y capacitación con alertas de vencimiento
- `offlineSync.js` — Sincronización offline con IndexedDB
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
- **Auto-Evaluation**: Sugiere valores de riesgo basados en reglas (monto, PEP, actividad, señales UAFE)
- **Batch Processing**: Análisis secuencial de múltiples casos desde el historial
- **Legal Export**: PDF con dictamen formal, bloques de firma, ROS estructurado
- **Offline**: IndexedDB para casos pendientes, sincronización automática al reconectar
- **Structured AI Output**: JSON con schema de 11 secciones (dictamen, señales, fundamento legal, obligaciones, etc.)

## Important Constraints
- **Legal Context**: `CONTEXTO_LEGAL_COMPLETO_ECUADOR` vive en `src/data/constants.js` y se replica en `functions/legalContext.js`. Se inyecta server-side como system prompt; el test `src/test/legalContext.test.js` falla si divergen.
- **API Key**: `GROQ_API_KEY` es un secreto de Cloud Functions (`defineSecret`). NUNCA exponer en el cliente.
- **Auth**: `analyzeCase` verifica el ID token de Firebase (incluida revocación) y aplica rate limit en memoria (`RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`); el cliente envía `Authorization: Bearer <token>`.
- **Audit Trail**: `audit_logs` y `audit_heads` son server-only (`firestore.rules`). Se escriben desde `auditCaseChanges`; el cliente solo lee y debe filtrar por `userId`.
- **Env Vars**: Configuración Firebase vía `import.meta.env.VITE_*` (ver `.env.example`).
- **Risk Weights**: Los pesos de `FACTORES_SENALES_UAFE` suman 0,999; se normalizan por su suma real en el motor.
- **DDC/BF**: Checklist de debida diligencia (art. 47) bloqueante y beneficiario final (art. 92) para personas jurídicas; se incluye en el prompt, PDF, Excel, ROS y audit trail
- **Workflow de reportes**: Panel en Step4 con plazos RESU/NO-RESU y ROS/NO-ROS, estados, responsable, fecha de envío y acuse
- **Cumplimiento institucional**: Código SISLAFT, designación del OC, manual, EBR y capacitación anual con alertas de vencimiento en el perfil y el Dashboard
- **Cash Limit**: Efectivo > 100 SBU (USD 48.200 con SBU 2026) bloquea el avance en `Step1Datos`.
- **PII**: `data-local/` y `public/data/clientes.json` están en `.gitignore`. No publicar bases de clientes en Hosting.
- **Build Output**: `dist/` se despliega en Firebase Hosting.
- **Dependencias**: SheetJS 0.20.3 se instala desde el tarball de `cdn.sheetjs.com`; `.npmrc` fija `legacy-peer-deps=true` por el peer opcional `canvas` de jsdom. `overrides` en `package.json` mantiene `npm audit` en 0 (frontend y `functions/`). `react-router-dom` y `react-is` son dependencias directas: no quitarlas.

## Lint & Quality
- Run `npm run lint` before commits. Config in `eslint.config.js`.
- Run `npm test` for unit tests. Config in `vite.config.js` (vitest).
- Tests en `src/test/`: validators, calculations, sanctionsCheck, legalContext, auditValidator, obligaciones (91 tests)

## Testing
- `src/test/setup.js` — Setup de vitest + jest-dom
- `src/test/validators.test.js` — Cédula/RUC/pasaporte + límite de efectivo + DDC/BF
- `src/test/calculations.test.js` — Riesgo inherente/residual
- `src/test/sanctionsCheck.test.js` — Levenshtein/similarity/listas/estados
- `src/test/legalContext.test.js` — Consistencia del contexto legal cliente/servidor
- `src/test/auditValidator.test.js` — Validación del JSON del dictamen de IA
- `src/test/obligaciones.test.js` — Plazos de RESU/NO-RESU y ROS/NO-ROS
- `src/test/cumplimiento.test.js` — Vigencia de los requisitos institucionales
