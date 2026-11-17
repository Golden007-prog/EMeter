# UtilityMeter · Web

Cliente React + TypeScript + Vite del monorepo **EMeter**. Vive en `apps/web`; el backend
está en `apps/api`.

## Límites

- Trabaja desde `apps/web`. No muevas código web a `apps/api` ni crees `apps/api/frontend`.
- El backend es la autoridad de las reglas: ante duda, lee `apps/api/docs/API.md` y
  `apps/api/docs/DOMAIN.md` antes de integrar un endpoint.
- El harness Playwright está en `e2e/` y sus artefactos en `e2e/artifacts/` (ignorados por
  git). El modo aislado inicia `../api/src/Presentation`; los modos live y full-stack usan
  la API existente o un Compose efímero.

## Verificación

```powershell
cd apps/web
npm ci
npm run lint
npm run build
npm run test:unit
npm run check:e2e
npm run test:e2e        # requiere Chromium: npx playwright install chromium
```

## Reglas de interfaz

- Nunca muestres un `null` como cero: un consumo no calculable se anuncia como tal.
- Separa lectura acumulada, consumo calculado y montos de boleta; no los sumes entre sí.
- Conserva `expectedVersion` y `requestId` al reintentar; no reintentes mutaciones solas.
- Fechas en `America/Santiago` con su offset real; no asumas un offset fijo.
- Mantén `reviewStatus` separado de `status`: una lectura confirmada puede tener advertencias.
