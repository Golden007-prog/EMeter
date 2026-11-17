# EMeter · UtilityMeter

Prototipo para **auditar boletas de servicios básicos**: registra la medición de un medidor de
agua, electricidad o gas, lee la boleta con OCR, calcula consumos y concilia condominios.

El objetivo del proyecto no es medir por medir: es que una persona pueda **comprobar si su
boleta contiene cobros irregulares y tenga con qué reclamar**. Hoy el prototipo cubre la
medición; la capa de dinero está planificada y todavía no existe. Ver
[análisis de brechas](docs/GAP-ANALYSIS.md).

## Estado actual

**Funciona y está probado**

- Lecturas con evidencia inmutable, versiones, idempotencia, revisión, corrección y anulación.
- Cinco catálogos con detalle, filtros y paginación; períodos con cierre inmutable.
- OCR de boletas con cola durable (PostgreSQL + Worker), revisión humana y confirmación.
- Cinco reportes: pendientes, faltantes, anomalías, resumen mensual y conciliación de condominio.
- Cliente React con los seis flujos y harness Playwright de 45 operaciones.

**Todavía no existe**

- Persistencia de la boleta y sus cargos (hoy se descartan tras la revisión).
- Tarifas oficiales, cálculo de montos y detección de sobrecobro.
- Expediente de reclamo y su seguimiento.
- Autenticación, multi-tenant y aislamiento de datos.
- Conversión de unidades y soporte de más de un proveedor de boletas.

Es un prototipo **local y de un solo usuario**: no lo expongas a Internet.

## Inicio rápido

Requisitos: Docker para el stack completo, .NET SDK 10, Node.js 22.12+ y Python 3.12.

```powershell
# Stack completo: API, Worker, PostgreSQL, MinIO, OCR y Seq
cd apps/api
docker compose up -d --build
# Swagger en http://localhost:8080/swagger

# Cliente web
cd apps/web
npm ci
Copy-Item .env.example .env
npm run dev            # http://127.0.0.1:5173
```

Sin Docker, `dotnet run --project src/Presentation` arranca en modo memoria (sin Worker durable).

## Verificación

```powershell
dotnet build apps/api/CleanMinimalApi.sln
dotnet test apps/api/tests/Application.Tests.Unit/Application.Tests.Unit.csproj
dotnet test apps/api/tests/Presentation.Tests.Unit/Presentation.Tests.Unit.csproj
python -m unittest discover -s apps/api/services/ocr -v
cd apps/web; npm run lint; npm run build; npm run test:unit; npm run check:e2e
```

Las pruebas de integración de `Infrastructure` usan Testcontainers y requieren Docker.

## Estructura

| Ruta | Contenido |
| --- | --- |
| `apps/api/` | API .NET 10, Worker, Infrastructure, servicio OCR en Python |
| `apps/web/` | React + TypeScript + Vite, contratos Zod y harness E2E |
| `docs/` | Producto, brechas, roadmap, arquitectura, plan de entrega y ADR |
| `docs/backlog/` | Backlog versionado: un archivo por fase, del que nacen los issues |
| `scripts/github/` | Sincronización idempotente de etiquetas, hitos, issues y tablero |
| `.github/` | CI, plantillas de issue y de pull request |

## Roadmap

| Fase | Objetivo | Esfuerzo |
| --- | --- | --- |
| M0 | Monorepo, CI y documentación | 5 días · **hecho** |
| M1 | Números confiables: que ninguna cifra mienta | 21 días · **en curso** |
| M2 | La boleta como dato persistido | 15 días |
| M3 | Tarifas oficiales con vigencia | 11 días |
| M4 | Auditoría automática con monto en disputa | 22 días |
| M5 | Expediente de reclamo y seguimiento | 11 días |
| M6 | Identidad, multi-tenant y operación | 12 días |
| M7 | Cobertura OCR medida y captura móvil | 9 días |

Detalle, dependencias y criterios de salida: [docs/ROADMAP.md](docs/ROADMAP.md).
Cómo ejecutarlo con agentes: [docs/DELIVERY-PLAN.md](docs/DELIVERY-PLAN.md).

## Documentación

| Documento | Contenido |
| --- | --- |
| [Producto](docs/PRODUCT.md) | Problema, personas, principios y métricas |
| [Brechas](docs/GAP-ANALYSIS.md) | Qué existe, qué falta y qué defectos se reprodujeron |
| [Roadmap](docs/ROADMAP.md) | Fases, dependencias, esfuerzo y criterios de salida |
| [Arquitectura](docs/ARCHITECTURE.md) | Componentes, flujos y persistencia |
| [Plan de entrega](docs/DELIVERY-PLAN.md) | Cómo trabajar con DeepSeek sin perder calidad |
| [API](apps/api/docs/API.md) · [Dominio](apps/api/docs/DOMAIN.md) · [OCR](apps/api/docs/OCR.md) | Referencia técnica del backend |
| [Frontend](apps/web/README.md) · [Harness E2E](apps/web/e2e/README.md) | Cliente y pruebas de navegador |
| [Decisiones](docs/decisions/) | ADR: monorepo y capa de auditoría |

## Cómo se trabaja

1. El plan vive en [`docs/backlog/`](docs/backlog/). Cada archivo declara título, etiquetas,
   hito, esfuerzo y criterios de aceptación.
2. `./scripts/github/sync.ps1` crea o actualiza etiquetas, hitos, issues y el tablero. Es
   idempotente: se puede correr las veces que haga falta.
3. `./scripts/github/sync-project-fields.ps1` completa los campos `Fase` y `Esfuerzo (días)` de
   cada elemento del tablero. Espacia las mutaciones para no chocar con el límite de la API.
4. `./scripts/publish-wiki.ps1` publica [`docs/wiki/`](docs/wiki/) en la wiki de GitHub; requiere
   que la wiki tenga su primera página creada desde la interfaz.
5. Un issue por rama y por sesión de trabajo. Ver [CONTRIBUTING.md](CONTRIBUTING.md).
6. Nada se declara terminado sin una verificación ejecutada.

## Licencia

[MIT](LICENSE.md). Se conserva la atribución del template original `CleanMinimalApi`.
