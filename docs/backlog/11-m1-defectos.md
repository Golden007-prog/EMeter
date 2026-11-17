# Backlog · M1 Defectos de corrección

Defectos reproducidos en la auditoría del backend. No son cosméticos: permiten que un dato
inválido entre al sistema o que una cifra se corrompa en silencio.

## [M1] Un período cerrado debe bloquear toda captura, aunque no declare período
labels: type:bug, area:api, prio:alta, fase:1
effort: 2
milestone: M1 · Números confiables

**Reproducido.** Con el período 1–31 de octubre cerrado, `POST /api/readings` con `measuredAt=2026-10-07` y **sin** `billingPeriodId` responde **201** y crea la lectura. `Mutable()` retorna sin validar cuando `BillingPeriodId` es nulo (`apps/api/src/Infrastructure/Databases/UtilityMeter/EntityFrameworkReadingWorkflow.cs:44-45`); solo se rechaza si el recálculo toca una lectura cerrada (`:72`). Contradice `docs/DOMAIN.md:20` y `AGENTS.md`.

**Criterios de aceptación.**
- [ ] Una lectura cuya fecha cae en un período cerrado se rechaza con 409, declare o no el período.
- [ ] La misma regla aplica a corrección, revisión, anulación y evidencia nueva.
- [ ] Prueba de integración que reproduce exactamente el 201 actual y espera 409.

## [M1] Rechazar períodos de facturación solapados
labels: type:bug, area:api, prio:alta, fase:1
effort: 1
milestone: M1 · Números confiables

**Reproducido.** `POST /api/billing-periods` acepta 15-oct→15-nov sobre un período existente 1-oct→1-nov (**201**) y luego una lectura se asigna indistintamente a cualquiera de los dos (`Catalog.cs:126-134`). El solapamiento hace que dos períodos reclamen la misma lectura y que el cierre de uno no proteja al otro.

**Criterios de aceptación.**
- [ ] Solapamiento (incluido contacto en el mismo instante) se rechaza con 409 y mensaje explicativo.
- [ ] También se valida al editar fechas de un período abierto.
- [ ] Prueba de integración con el caso exacto reproducido.

## [M1] La unidad del medidor debe ser válida para su recurso
labels: type:bug, area:api, prio:alta, fase:1
effort: 1
milestone: M1 · Números confiables

**Reproducido.** `POST /api/meters` con `resourceType=water` y `unit=kWh` responde **201** (`Catalog.cs:102-124` valida solo texto no vacío de hasta 50 caracteres). Como la unidad es texto libre, "m3", "M3" y "m³" separan cadenas de consumo sin aviso.

**Criterios de aceptación.**
- [ ] Catálogo cerrado de unidades por recurso, validado en catálogo y en lectura.
- [ ] Un medidor existente con unidad inválida se reporta y se migra, no se ignora.
- [ ] Prueba de integración del 400 esperado para agua con kWh.

## [M1] Un solo cálculo de consumo y prohibido devolver cero cuando es desconocido
labels: type:bug, area:api, prio:alta, fase:1
effort: 3
milestone: M1 · Números confiables

**Problema.** `Reading.CalculateConsumption` devuelve **0** cuando la lectura decrece (`src/Application/Readings/Entities/Reading.cs:27-32`), confundiendo desconocido con cero, y los reportes reimplementan la fórmula (`GetMonthlySummaryQuery.cs:22-25`, `CondominiumReconciliation.cs:53-56`): hay tres definiciones de consumo que pueden divergir.

**Criterios de aceptación.**
- [ ] Un único servicio de dominio calcula consumo y devuelve `null` cuando no es calculable.
- [ ] Los tres consumidores actuales usan ese servicio; no queda fórmula duplicada.
- [ ] Reportes y UI distinguen "no calculable" (nunca 0) y hay prueba que lo demuestra.
- [ ] La entidad `Consumption` sin uso se elimina o se usa, no queda muerta.

## [M1] Formato y redondeo deterministas en el servidor
labels: type:bug, area:api, prio:media, fase:1
effort: 2
milestone: M1 · Números confiables

**Problema.** `consumptions.Average()` sin redondeo (`src/Application/Readings/ReadingWorkflow.cs:52`) produce mensajes de alerta como "historical average of 26.666666666666666666666666667" (`Reading.cs:61`), y el texto se arma con la cultura del host. Un mensaje de alerta que no se puede leer ni reproducir resta credibilidad justo donde se decide si hay sobrecobro.

**Criterios de aceptación.**
- [ ] Todo número presentado se formatea con cultura invariante y la escala declarada.
- [ ] Las alertas muestran valores redondeados con la unidad, sin colas de decimales.
- [ ] Prueba que fija el texto exacto de una alerta de consumo alto y otra de lectura decreciente.

## [M1] El parser no debe corromper números con punto decimal
labels: type:bug, area:ocr, prio:alta, fase:1
effort: 2
milestone: M1 · Números confiables

**Problema.** `chilean_number` (`apps/api/services/ocr/bill_models.py:28-32`) asume que "." es separador de miles: `"8.80"` se convierte en **880** y `"0.5"` en **5**. Afecta `connectedPower` (`bill_providers/cge.py:40`) y `meterConstant` (`:61`), y nada valida el resultado. En una aplicación cuyo propósito es detectar cobros indebidos, un número corrompido en silencio es el peor defecto posible.

**Criterios de aceptación.**
- [ ] Regla explícita para decidir miles vs decimal según posición y contexto del campo.
- [ ] Casos de prueba: "8.80", "0.5", "1.234,56", "1.234", "12.345", "1.234.567".
- [ ] Valores fuera de rango plausible se rechazan y se marcan para revisión, no se proponen.

## [M1] Confirmación OCR idempotente con requestId
labels: type:bug, area:api, prio:media, fase:1
effort: 2
milestone: M1 · Números confiables

**Problema.** `ConfirmAsync` lanza `CreateReadingCommand` sin `RequestId` (`src/Infrastructure/Extraction/PostgresExtractionJobs.cs:103-104`) y solo evita el duplicado si `ConfirmedReadingId` ya está persistido (`:99-100`). Un fallo entre crear la lectura y marcar el trabajo duplica lecturas; en modo InMemory, sin transacción, es alcanzable.

**Criterios de aceptación.**
- [ ] La confirmación usa un `requestId` determinista derivado del trabajo y de la versión confirmada.
- [ ] Doble confirmación, incluso concurrente, produce una sola lectura.
- [ ] Prueba que simula el fallo entre ambos pasos y verifica que no hay duplicado.
