# Documentación de EMeter

Índice de la documentación de producto e ingeniería. La referencia técnica de cada aplicación
vive dentro de su carpeta.

## Producto y plan

| Documento | Para qué sirve |
| --- | --- |
| [Producto](PRODUCT.md) | Problema, personas, principios y métricas de éxito |
| [Análisis de brechas](GAP-ANALYSIS.md) | Qué funciona, qué falta para auditar cobros y qué defectos se reprodujeron |
| [Roadmap](ROADMAP.md) | Fases, dependencias, esfuerzo y criterio de salida de cada una |
| [Arquitectura](ARCHITECTURE.md) | Monorepo, flujos, persistencia y contratos |
| [Plan de ejecución con DeepSeek](DELIVERY-PLAN.md) | Enrutamiento de modelos, sesiones, presupuesto y guardrails |
| [Versionado](VERSIONING.md) | Versionado semántico, changelog y proceso de release |

## Backlog

El plan operativo vive en [`backlog/`](backlog/): un archivo markdown por fase. Cada sección
`## [Mx] Título` se convierte en un issue mediante `scripts/github/sync.ps1`, con sus etiquetas,
hito y esfuerzo. El tablero de GitHub Projects refleja el mismo estado.

## Decisiones

| ADR | Decisión |
| --- | --- |
| [0001](decisions/0001-monorepo.md) | Un monorepo con `apps/api` y `apps/web`, conservando historial |
| [0002](decisions/0002-capa-de-auditoria.md) | El dinero es una capa aparte: `Billing`, `Tariffs`, `Auditing` |

## Referencia técnica

- Backend: [`apps/api/docs/`](../apps/api/docs/README.md) — API, dominio, arquitectura, OCR, operación y ejecución.
- Frontend: [`apps/web/README.md`](../apps/web/README.md) — recorridos, contratos y verificación.
- Harness E2E: [`apps/web/e2e/README.md`](../apps/web/e2e/README.md) — modos aislado, full-stack y live.
