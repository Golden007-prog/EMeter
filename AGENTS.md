# EMeter · instrucciones para agentes

Monorepo del prototipo **UtilityMeter**: API .NET, Worker OCR y cliente web para auditar
consumos y boletas de agua, electricidad y gas.

## Objetivo del producto

Que una persona con una boleta de servicios básicos pueda **comprobar si le cobraron de
más** y tener evidencia para reclamar. Todo cambio se evalúa contra ese objetivo:
si no acerca a detectar, probar o reclamar un cobro irregular, es secundario.

## Mapa del repositorio

| Ruta | Responsabilidad |
| --- | --- |
| `apps/api/` | Backend .NET 10: `src/Application`, `src/Infrastructure`, `src/Presentation`, `src/Worker`, `services/ocr` (Python), `tests/` |
| `apps/web/` | Cliente React + TypeScript + Vite, contratos Zod, TanStack Query y harness Playwright en `e2e/` |
| `docs/` | Visión, análisis de brechas, roadmap, arquitectura del monorepo, ADR y plan de inversión |
| `.github/` | CI, plantillas de issue y de pull request |

Instrucciones específicas y más detalladas: `apps/api/AGENTS.md` y `apps/web/AGENTS.md`.
Ante conflicto, manda la instrucción más cercana al archivo que estás cambiando.

## Comandos

Desde la raíz del monorepo:

```powershell
# Backend
dotnet build apps/api/CleanMinimalApi.sln
dotnet test apps/api/tests/Application.Tests.Unit/Application.Tests.Unit.csproj
dotnet test apps/api/tests/Presentation.Tests.Unit/Presentation.Tests.Unit.csproj
python -m unittest discover -s apps/api/services/ocr -v

# Frontend
cd apps/web; npm ci; npm run lint; npm run build; npm run test:unit
```

Las pruebas de integración usan Testcontainers y requieren Docker. El stack completo
(`docker compose up -d --build` desde `apps/api`) es la única forma de ejercitar la cola
OCR durable, PostgreSQL y MinIO.

## Invariantes que no se negocian

- Medición, consumo, facturación, prorrateo y auditoría son conceptos separados.
- El consumo se calcula entre lecturas activas consecutivas del mismo medidor y origen;
  nunca se mezclan orígenes ni unidades, ni se presenta un consumo desconocido como cero.
- Los originales de evidencia son inmutables y viven en object storage, no en PostgreSQL.
- Un período cerrado es inmutable; se rechaza cualquier operación que lo altere.
- Se conservan revisiones, concurrencia optimista (`expectedVersion`), idempotencia
  (`requestId`) y recálculo transaccional del historial afectado.
- El OCR propone valores; una persona confirma antes de crear una lectura. Confirmar dos
  veces no puede duplicar la lectura.
- Un monto, una tarifa o un total sólo se muestran si están respaldados por un cálculo
  reproducible; nunca se inventan ni se rellenan con cero.

## Convenciones de trabajo

- Cambios pequeños y verificables; un issue por rama (`feat/…`, `fix/…`, `chore/…`).
- No renombres `CleanMinimalApi.sln` ni los namespaces `CleanMinimalApi.*` sin una tarea
  explícita que lo pida.
- No agregues carpetas de frontend dentro de `apps/api` ni código .NET dentro de `apps/web`.
- Actualiza `docs/` y `/docs/API.md` cuando cambie el comportamiento, y deja constancia de
  las verificaciones que no pudiste ejecutar.
- Nunca commitees secretos, datos personales ni boletas reales de terceros.
