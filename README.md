# Viáticos Heartland

App para cargar tickets de viáticos (foto + lectura con IA), agruparlos por concepto y generar al cierre del mes:
- **Excel** con el formato de reporte de gastos (una fila por grupo + hoja de detalle).
- **Word** con las fotos de los tickets, una página por grupo.

Incluye el calendario de reembolsos ARG 2026 y el motivo automático ("REPRESENTACIÓN COMERCIAL <MES> <AÑO>").

## Cómo funciona
- Página estática (GitHub Pages). Backend: Firebase proyecto `viaticos-heartland`, plan gratuito Spark.
  - Authentication (Google), solo permite la cuenta del dueño.
  - Firestore: `users/<uid>/meta/config`, `users/<uid>/meta/config/tickets/*`, `users/<uid>/fotos/*` (fotos JPEG comprimidas).
  - Firebase AI Logic con Gemini Developer API (plan gratis) para leer los tickets.
- `fb.bundle.js` es el SDK de Firebase empaquetado desde `src/fb.js`:
  `npm i && npx esbuild src/fb.js --bundle --format=iife --global-name=FB --minify --outfile=fb.bundle.js`
