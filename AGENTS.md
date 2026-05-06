# AGENTS.md

**app-riesgo-uafe** — Sistema de Análisis de Riesgo LA/FD con IA (Gemini) para sector notarial ecuatoriano.

## Tech Stack
- React 19 + Vite 8
- JavaScript (no TypeScript)
- Local Storage: IndexedDB (vía storage.js)
- AI: Google Gemini (gemini-2.5-flash)
- Exports: jspdf, xlsx

## Commands
```bash
npm run dev      # Dev server (http://localhost:5173)
npm run build   # Build to dist/
npm run lint    # ESLint check
npm run preview # Preview dist/ build
```

## Architecture & Flow
- **Entry**: `src/App.jsx` — Orquestador del estado y flujo de pasos.
- **Wizard Steps**: 
  1. `Step1Datos` $\rightarrow$ Captura datos básicos + Importación masiva de Excel.
  2. `Step2Factores` $\rightarrow$ Calificación de Probabilidad e Impacto (Auto-evaluada).
  3. `Step3Controles` $\rightarrow$ Evaluación de controles internos.
  4. `Step4Analisis` $\rightarrow$ Generación de dictamen jurídico mediante IA.
- **Persistence**: `src/utils/storage.js` gestiona la base de datos local IndexedDB para guardar y recuperar casos.
- **Logic**: `src/utils/calculations.js` calcula scores inherentes y residuales.
- **AI Logic**: `src/utils/geminiApi.js` construye prompts basados en normativa ecuatoriana.

## Key Features (Advanced)
- **Excel Importer**: `src/utils/excelParser.js` procesa reportes de la UAFE, mapeando columnas dinámicamente.
- **Auto-Evaluation**: El sistema sugiere valores de riesgo basados en reglas (monto, PEP, actividad).
- **Batch Processing**: Análisis secuencial de múltiples casos desde el historial.
- **Legal Export**: Generación de PDF con formato de dictamen formal y bloques de firma.

## Important Constraints
- **Legal Context**: El contexto legal en `constants.js` es crítico y DEBE incluirse en cada prompt de IA.
- **API Key**: Almacenada en `sessionStorage` bajo `gemini_api_key`.
- **Build Output**: La carpeta `dist/` es la que se despliega en Firebase Hosting.

## Lint & Quality
Run `npm run lint` before commits. Config in `eslint.config.js`.
