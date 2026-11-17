# Backlog · M2 La boleta como dato

Hoy el OCR devuelve `charges` en memoria y la aplicación los pierde al cerrar la pantalla.
Sin boleta persistida no hay nada que auditar ni que reclamar.

## [M2] Modelo persistente de boleta y cargos
labels: type:story, area:api, area:data, fase:2, prio:alta
effort: 3
milestone: M2 · La boleta como dato

**Alcance.**
- `Bill`: proveedor, número de documento, cliente, dirección de suministro, sector y tarifa contratada, potencia conectada, medidor y constante, período facturado (inicio/fin), fecha de emisión y vencimiento, moneda, `totalAmount`, tipo de lectura (real/estimada), código de pago y enlace a `Evidence`.
- `BillLineItem`: concepto, categoría, cantidad, unidad, precio unitario, monto, moneda, página, origen (OCR/manual), confianza.
- Vínculos opcionales a `UtilityProperty`, `BillingPeriod` y `Meter`, con las mismas reglas de período cerrado que las lecturas.

**Criterios de aceptación.**
- [ ] Migración EF Core versionada; nada de `EnsureCreated`.
- [ ] Los cargos suman al total o la diferencia se guarda explícitamente (`roundingDifference`).
- [ ] Una boleta en período cerrado es inmutable.
- [ ] Pruebas de integración de persistencia y de inmutabilidad.

## [M2] API de boletas: alta, consulta y vínculo
labels: type:story, area:api, fase:2, prio:alta
effort: 2
milestone: M2 · La boleta como dato

**Alcance.** Endpoints MediatR para crear una boleta con cargos, consultar por id, listar con filtros (propiedad, período, proveedor, estado de auditoría) y corregir antes del cierre. Contratos en `docs/API.md` y OpenAPI.

**Criterios de aceptación.**
- [ ] `POST /api/bills` idempotente por `requestId`.
- [ ] 409 al modificar una boleta de período cerrado; 400 con ProblemDetails ante unidad o moneda inválida.
- [ ] Paginación explícita con `hasNextPage`.
- [ ] Pruebas HTTP de contrato, error y conflicto.

## [M2] Confirmar OCR crea una boleta idempotente
labels: type:story, area:api, area:web, fase:2, prio:alta
effort: 3
milestone: M2 · La boleta como dato

**Alcance.** La confirmación humana de una extracción crea `Bill` + `BillLineItem` en una transacción, conserva el JSON original del OCR como evidencia y no duplica al reintentar. Registrar el parser que produjo el resultado y su versión.

**Criterios de aceptación.**
- [ ] Confirmar dos veces la misma extracción no crea dos boletas.
- [ ] Se conserva la trazabilidad OCR → propuesta → valor confirmado (quién y cuándo en modo multiusuario).
- [ ] Los cargos sin categoría quedan marcados para revisión, no se descartan.

## [M2] UI de carga y revisión de boleta
labels: type:story, area:web, fase:2, prio:media
effort: 3
milestone: M2 · La boleta como dato

**Alcance.** Pantalla que muestra el original y la boleta estructurada lado a lado, permite corregir cargos, ve el total facturado y muestra la diferencia contra la suma de cargos.

**Criterios de aceptación.**
- [ ] Errores de suma visibles en la propia pantalla, sin abrir un reporte.
- [ ] Montos con formato local y moneda explícita; nunca dos decimales inventados.
- [ ] Estado vacío y de carga explícitos; el original se descarga si el navegador no lo previsualiza.

## [M2] Soporte multi-proveedor de boletas
labels: type:task, area:ocr, fase:2, prio:media
effort: 4
milestone: M2 · La boleta como dato

**Contexto.** `bill_providers/registry.py` tiene un solo parser real (CGE) y un detector por nombre.

**Criterios de aceptación.**
- [ ] Contrato de parser documentado (campos mínimos, moneda, unidad, página, confianza).
- [ ] Al menos dos proveedores adicionales con pruebas sobre documentos sintéticos anonimizados.
- [ ] Un documento desconocido no se fuerza a un proveedor: se marca `providerUnknown`.
- [ ] La extracción declara qué parser y versión la produjo.
