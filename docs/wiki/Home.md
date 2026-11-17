# EMeter · wiki

Prototipo para **auditar boletas de servicios básicos**: mide, lee la boleta con OCR y —cuando
la capa de dinero esté completa— detecta cobros irregulares con un monto en disputa.

## Estado en una frase

La medición funciona y está probada; la auditoría de cobros todavía no existe. El plan para
llegar está en el [roadmap](https://github.com/cbinput/EMeter/blob/main/docs/ROADMAP.md).

## Navegación

| Página | Contenido |
| --- | --- |
| [Producto](Producto) | Problema, personas, principios y métricas |
| [Arquitectura](Arquitectura) | Monorepo, flujos, persistencia y capa de auditoría |
| [Operación](Operacion) | Cómo levantar el stack y qué revisar cuando falla |
| [Roadmap](Roadmap) | Fases, criterios de salida y esfuerzo |
| [Decisiones](Decisiones) | ADR: monorepo y capa de auditoría |

## Enlaces rápidos

- [Repositorio](https://github.com/cbinput/EMeter)
- [Tablero del roadmap](https://github.com/users/cbinput/projects/3)
- [Issues](https://github.com/cbinput/EMeter/issues)
- [Análisis de brechas](https://github.com/cbinput/EMeter/blob/main/docs/GAP-ANALYSIS.md)
- [Plan de ejecución con DeepSeek](https://github.com/cbinput/EMeter/blob/main/docs/DELIVERY-PLAN.md)

## Cómo se mantiene

El backlog vive versionado en `docs/backlog/` y se publica con
`scripts/github/sync.ps1`. La wiki resume decisiones estables; el detalle técnico vive en
`apps/api/docs/` y `apps/web/`.
