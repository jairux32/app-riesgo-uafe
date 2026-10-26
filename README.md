# app-riesgo-uafe

Sistema de Análisis de Riesgo LA/FD con IA (Gemini) para el sector notarial ecuatoriano.

## Descripción

Aplicación web para notarios públicos del Ecuador que permite analizar el riesgo de Lavado de Activos y Financiación del Delito (LA/FD) en actos notariales, siguiendo la metodología EBR (Enfoque Basado en Riesgo) y la normativa de la UAFE (Unidad de Análisis Financiero y Económico).

## Tech Stack
- **React 19** + **Vite 8**
- **JavaScript** (no TypeScript)
- **Firebase 12**: Auth, Firestore, Cloud Functions, Cloud Messaging
- **Google Gemini** (gemini-2.5-flash) vía Cloud Function segura
- **IndexedDB** (vía `idb`) para persistencia offline
- **react-router-dom** para navegación
- **Exports**: jspdf (PDF), xlsx (Excel)
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

## Configuración
1. Copiar `.env.example` a `.env` y completar las variables de Firebase
2. Configurar el secreto `GEMINI_API_KEY` en Firebase Cloud Functions:
   ```bash
   firebase functions:secrets:set GEMINI_API_KEY
   ```
3. Para notificaciones push, generar VAPID key en Firebase Console y agregarla a `.env`

## Arquitectura

### Frontend
- **Entry**: `src/main.jsx` — BrowserRouter + AuthProvider + Service Worker
- **Router**: `src/App.jsx` — Rutas `/` (wizard), `/dashboard`, `/profile`
- **Estado de caso**: `src/context/CaseContext.jsx` — Context + useReducer + useMemo
- **Auth**: `src/context/AuthContext.jsx` — Firebase Auth

### Wizard de 4 pasos
1. `Step1Datos` → Captura de datos + importación masiva Excel
2. `Step2Senales` → Evaluación de señales de alerta UAFE (56 señales, 7 categorías)
3. `Step3Controles` → Evaluación de 10 controles internos
4. `Step4Analisis` → Dictamen jurídico con IA + exportación PDF/Excel/ROS

### Lógica
- `src/utils/calculations.js` — Scores de riesgo inherente y residual
- `src/utils/geminiApi.js` — Integración con Gemini vía Cloud Function
- `src/utils/excelParser.js` — Parser de reportes UAFE + auto-evaluación
- `src/utils/exportUtils.js` — Barrel: excelExport, pdfExport, rosExport
- `src/data/constants.js` — Contexto legal, catálogos UAFE, factores de riesgo

### Backend
- `functions/index.js`:
  - `analyzeCase` (onCall) — Proxy seguro para Gemini con `defineSecret`
  - `notifyHighRiskCase` (onDocumentCreated) — Notificación push para riesgo ALTO

### Persistencia
- `src/utils/storage.js` — Fachada Firestore + IndexedDB (offline)
- `src/utils/offlineSync.js` — Sincronización offline con `idb`
- `src/firebase/firestore.js` — Operaciones Firestore
- `src/firebase/auditStore.js` — Audit trail

## Testing
Tests con **vitest** + **@testing-library/react**:
- `src/test/validators.test.js` — Validación de cédula/RUC/pasaporte
- `src/test/calculations.test.js` — Cálculos de riesgo
- `src/test/sanctionsCheck.test.js` — Búsqueda fuzzy en listas restrictivas

## Despliegue
La carpeta `dist/` se despliega en **Firebase Hosting**. CI/CD vía GitHub Actions (`.github/workflows/`).
