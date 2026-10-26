# AGENTS.md

**app-riesgo-uafe** — Sistema de Análisis de Riesgo LA/FD con IA (Gemini) para sector notarial ecuatoriano.

## Tech Stack
- React 19 + Vite 8
- JavaScript (no TypeScript)
- Firebase 12: Auth, Firestore, Cloud Functions, Cloud Messaging
- AI: Google Gemini (gemini-2.5-flash) vía Cloud Function segura
- Routing: react-router-dom
- Local Storage: IndexedDB (vía idb)
- Exports: jspdf, xlsx
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
- **State**: `src/context/CaseContext.jsx` — Context con useReducer + useMemo para estado del caso
- **Auth**: `src/context/AuthContext.jsx` — Firebase Auth (login, register, logout)

### Wizard Steps
1. `src/views/Step1Datos` → Captura datos básicos + importación masiva Excel
2. `src/views/Step2Senales` → Evaluación de 56 señales de alerta UAFE (7 categorías)
3. `src/views/Step3Controles` → Evaluación de 10 controles internos
4. `src/views/Step4Analisis` → Dictamen jurídico con IA + exportación PDF/Excel/ROS

### Utils (src/utils/)
- `storage.js` — Fachada Firestore + IndexedDB (offline-first)
- `calculations.js` — Scores inherente y residual con pesos ponderados
- `geminiApi.js` — Integración Gemini vía httpsCallable (Cloud Function)
- `excelParser.js` — Parser reportes UAFE + auto-evaluación con señales SA01-SA201
- `exportUtils.js` — Barrel re-export: `excelExport.js`, `pdfExport.js`, `rosExport.js`
- `auditSchema.js` — JSON Schema para salida estructurada de Gemini
- `auditTransformer.js` — Transforma JSON de Gemini a formato display
- `alertasInteligentes.js` — Alertas de portfolio (estancados, recurrentes, vencidos)
- `sanctionsCheck.js` — Verificación en listas OFAC/ONU/UAFE (Levenshtein)
- `validators.js` — Validación cédula/RUC/pasaporte ecuatoriano
- `offlineSync.js` — Sincronización offline con IndexedDB
- `monthlyReport.js` — Reporte mensual PDF

### Data (src/data/)
- `constants.js` — Contexto legal, catálogos UAFE, factores de riesgo, controles
- `demoCase.js` — Caso demo

### Firebase (src/firebase/)
- `config.js` — Configuración con variables de entorno (import.meta.env.VITE_*)
- `firestore.js` — Operaciones CRUD Firestore
- `auditStore.js` — Audit trail
- `profileStore.js` — Perfil de notaría
- `messaging.js` — Notificaciones push (FCM)

### Backend (functions/)
- `analyzeCase` (onCall) — Proxy seguro para Gemini API con defineSecret('GEMINI_API_KEY')
- `notifyHighRiskCase` (onDocumentCreated) — Push notification cuando score ≥ 20

## Key Features (Advanced)
- **Excel Importer**: Procesa reportes UAFE con mapeo dinámico de columnas + auto-evaluación
- **Auto-Evaluation**: Sugiere valores de riesgo basados en reglas (monto, PEP, actividad, señales UAFE)
- **Batch Processing**: Análisis secuencial de múltiples casos desde el historial
- **Legal Export**: PDF con dictamen formal, bloques de firma, ROS estructurado
- **Offline**: IndexedDB para casos pendientes, sincronización automática al reconectar
- **Structured AI Output**: Gemini devuelve JSON con schema de 11 secciones (dictamen, señales, fundamento legal, obligaciones, etc.)

## Important Constraints
- **Legal Context**: El `CONTEXTO_LEGAL_COMPLETO_ECUADOR` en `constants.js` DEBE incluirse en cada prompt de IA
- **API Key**: GEMINI_API_KEY es un secreto de Cloud Functions (defineSecret). NUNCA exponer en el cliente
- **Env Vars**: Configuración Firebase vía `import.meta.env.VITE_*` (ver `.env.example`)
- **Risk Weights**: Pesos de `FACTORES_SENALES_UAFE` están normalizados a suma 1.0
- **Build Output**: `dist/` se despliega en Firebase Hosting

## Lint & Quality
- Run `npm run lint` before commits. Config in `eslint.config.js`.
- Run `npm test` for unit tests. Config in `vite.config.js` (vitest).
- Tests en `src/test/`: validators, calculations, sanctionsCheck (36 tests)

## Testing
- `src/test/setup.js` — Setup de vitest + jest-dom
- `src/test/validators.test.js` — Cédula/RUC/pasaporte (17 tests)
- `src/test/calculations.test.js` — Riesgo inherente/residual (7 tests)
- `src/test/sanctionsCheck.test.js` — Levenshtein/similarity/listas (12 tests)
