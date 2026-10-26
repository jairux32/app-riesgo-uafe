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
- **Exports**: jspdf (PDF), SheetJS 0.20.3 (Excel), ROS
- **recharts** para visualizaciones

## Comandos
```bash
npm run dev        # Dev server (http://localhost:5173)
npm run build      # Build a dist/
npm run lint       # ESLint check
npm run preview    # Preview dist/ build
npm test           # Ejecutar tests (vitest)
npm run test:watch # Tests en modo watch
```

> **Instalación:** `npm ci` usa `.npmrc` con `legacy-peer-deps=true` por un fallo de npm 10 al resolver el peer opcional `canvas` de jsdom. SheetJS se instala desde el tarball oficial `cdn.sheetjs.com` (la versión npm está congelada en 0.18.5 con CVEs). `npm audit` debe quedar en 0; verificar tras cualquier actualización.

## Configuración
1. Copiar `.env.example` a `.env` y completar las variables de Firebase
2. Configurar el secreto `GROQ_API_KEY` en Firebase Cloud Functions:
   ```bash
   firebase functions:secrets:set GROQ_API_KEY
   ```
3. Para notificaciones push, generar VAPID key en Firebase Console y agregarla a `.env`
4. Opcional: definir `ALLOWED_ORIGINS` (separados por coma) para restringir CORS de `analyzeCase`
5. Opcional: registrar App Check (reCAPTCHA v3) en Firebase Console, poner `VITE_APPCHECK_SITE_KEY` en `.env` y `ENFORCE_APP_CHECK=true` en Functions

## Arquitectura

### Frontend
- **Entry**: `src/main.jsx` — BrowserRouter + AuthProvider + Service Worker
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
- `src/utils/excelParser.js` — Parser de reportes UAFE + auto-evaluación
- `src/utils/exportUtils.js` — Barrel: excelExport, pdfExport, rosExport
- `src/utils/sanctionsCheck.js` — Screening de listas (sin fuentes ficticias)
- `src/utils/validators.js` — Cédula/RUC/pasaporte, límite de efectivo y DDC/BF
- `src/utils/obligaciones.js` — Plazos y seguimiento de RESU/NO-RESU y ROS/NO-ROS
- `src/utils/cumplimiento.js` — Código SISLAFT, OC, manual, EBR y capacitación con alertas
- `src/data/constants.js` — Contexto legal, catálogos UAFE, factores de riesgo

### Backend
- `functions/index.js`:
  - `analyzeCase` (`onRequest`) — Proxy autenticado (Bearer token) hacia Groq, con rate limit por usuario y App Check opcional
  - `notifyHighRiskCase` (`onDocumentCreated`) — Notificación push para riesgo ALTO
  - `auditCaseChanges` (`onDocumentWritten`) — Audit trail server-side con cadena de hashes SHA-256
- `functions/legalContext.js` — Copia del contexto legal inyectado como system prompt

### Persistencia
- `src/utils/storage.js` — Fachada Firestore + IndexedDB (offline)
- `src/utils/offlineSync.js` — Sincronización offline con `idb`
- `src/firebase/firestore.js` — Operaciones Firestore
- `src/firebase/auditStore.js` — Audit trail

### Datos personales
La base de clientes **no se publica** en el hosting. `data-local/` está ignorado por git y la carga se hace manualmente desde la UI (archivo JSON local → IndexedDB).

## Testing
Tests con **vitest** + **@testing-library/react** (91 tests):
- `src/test/validators.test.js` — Cédula/RUC/pasaporte, límite de efectivo y DDC/BF
- `src/test/obligaciones.test.js` — Plazos RESU/NO-RESU y ROS/NO-ROS
- `src/test/cumplimiento.test.js` — Vigencia del cumplimiento institucional
- `src/test/calculations.test.js` — Cálculos de riesgo inherente/residual
- `src/test/sanctionsCheck.test.js` — Búsqueda fuzzy en listas restrictivas
- `src/test/legalContext.test.js` — Consistencia del contexto legal cliente/servidor
- `src/test/auditValidator.test.js` — Validación del JSON del dictamen de IA

## Despliegue
La carpeta `dist/` se despliega en **Firebase Hosting**. CI/CD vía GitHub Actions (`.github/workflows/`).
