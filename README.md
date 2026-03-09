# Foretell — Kalshi Opportunity Scanner

Live at: https://foretell-v2.vercel.app/

## Stack
- Vite + TypeScript (frontend, no framework)
- Vercel serverless functions (Node.js, `/api/`)
- Kalshi public trade API

## Project structure
```
foretell/
├── src/
│   ├── main.ts        ← UI, rendering, scoring logic
│   └── style.css      ← All styles (Prosper & Partners palette)
├── api/
│   ├── opportunities.js  ← Main endpoint: scores & returns top 20
│   ├── markets.js        ← Kalshi market proxy + dedup
│   ├── score.js          ← Debug scorer
│   └── debug.js          ← Debug endpoint
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vercel.json
```

## Deploy to Vercel
1. Push to GitHub
2. Import repo in Vercel
3. Framework preset: **Vite**
4. Build command: `npm run build`
5. Output directory: `dist`
6. No env vars required (uses Kalshi public API)

## Dev
```bash
npm install
npm run dev
```
