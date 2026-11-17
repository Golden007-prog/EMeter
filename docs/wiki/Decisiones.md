# Decisiones

| ADR | Decisión | Estado |
| --- | --- | --- |
| [0001](https://github.com/cbinput/EMeter/blob/main/docs/decisions/0001-monorepo.md) | Un monorepo con `apps/api` y `apps/web`, conservando el historial de ambos proyectos | aceptado |
| [0002](https://github.com/cbinput/EMeter/blob/main/docs/decisions/0002-capa-de-auditoria.md) | El dinero es una capa aparte: `Billing`, `Tariffs`, `Auditing` | aceptado |

## Por qué un monorepo

Un cambio de contrato se revisa y se prueba en un solo pull request, y la documentación de
producto tiene un único lugar. Costo aceptado: CI más grande y un commit de migración de rutas.

## Por qué el dinero va aparte

Una medición se corrige o se anula; una boleta emitida no cambia, se reclama. Mezclar ambas en
una sola entidad obliga a reescribir la boleta cada vez que cambia una regla y hace imposible
congelar los hallazgos de un reclamo ya presentado.

## Cómo se agrega una decisión nueva

1. Copiar la plantilla de un ADR existente en `docs/decisions/`.
2. Escribir contexto, decisión, consecuencias y alternativas descartadas.
3. Enlazarla desde `docs/decisions/` y desde esta página.
