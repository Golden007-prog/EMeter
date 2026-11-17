# Backlog · M1 Números confiables

Objetivo de la fase: que ninguna cifra de la aplicación pueda leerse como un dato que no es.
Sin esta base, cualquier cálculo de sobrecobro será desconfiable.

## [M1] No presentar datos desconocidos como cero en reportes
labels: type:bug, area:web, area:api, fase:1, prio:alta
effort: 1
milestone: M1 · Números confiables

**Problema.** `uncalculableReadingCount` se declara `z.number().default(0)` en `apps/web/src/features/reports/api.ts:33`: si el backend omite el campo, la interfaz afirma "0 lecturas sin consumo calculable" y presenta un período incompleto como completo. Los totales nulos (`totalsBySource`, `totalsByUnit`) se pintan como tabla vacía (`ReportPanels.tsx:87,110`), que se lee como cero.

**Criterios de aceptación.**
- [ ] Un campo ausente o nulo se muestra como "No disponible", nunca como `0`.
- [ ] El resumen distingue "sin datos", "datos parciales" y "total completo" con texto explícito.
- [ ] Si `isComplete` es falso, la UI lo dice junto al total, no en una nota al pie.
- [ ] Prueba de contrato que falla si un campo numérico obligatorio llega ausente.

**Verificación.** Test unitario del esquema + prueba de navegador con el reporte incompleto del seed.

## [M1] Normalizar unidades y formato decimal en toda la interfaz
labels: type:bug, area:web, area:api, fase:1, prio:alta
effort: 2
milestone: M1 · Números confiables

**Problema.** La unidad del medidor es texto libre (`MetersPage.tsx:309-318`): "m3", "m³" y "M3 " son medidores distintos para la conciliación, que exige unidad idéntica. El detalle y el espacio de período imprimen `value.toString()` (`ReadingDetailPage.tsx:236,301,398`, `PeriodWorkspacePage.tsx:133`) mientras los reportes usan `formatDecimalInput`: conviven "1234.5" y "1234,5". `decimalToMinorUnits` (`readings/api.ts:164-167`) asume 2 decimales y trunca en silencio con 3.

**Criterios de aceptación.**
- [ ] Catálogo cerrado de unidades por recurso (kWh, m³, L, gas m³) validado en API y en formulario.
- [ ] Un único formateador de decimales para lectura, consumo y montos; sin `.toString()` en vistas.
- [ ] Conversión a unidades menores exacta para cualquier escala declarada o error explícito.
- [ ] Migración que normaliza unidades existentes y deja constancia de las corregidas.

**Verificación.** Pruebas unitarias del formateador y de la normalización; `workflows.spec.ts` con unidad incompatible.

## [M1] Precargar la confirmación OCR con las propuestas extraídas
labels: type:story, area:web, fase:1, prio:alta
effort: 1
milestone: M1 · Números confiables

**Problema.** `DocumentDetailPage.tsx:33-38` inicializa `value`, `date` y `meter` vacíos y no aplica las propuestas del OCR. El usuario transcribe a mano lo que el sistema ya leyó: el OCR no ahorra trabajo y agrega riesgo de error de tipeo.

**Criterios de aceptación.**
- [ ] Los campos se precargan con la propuesta de mayor confianza y muestran su procedencia (página, origen).
- [ ] Si hay candidatos en conflicto, la UI los ofrece y no elige uno en silencio.
- [ ] Lo precargado es editable y la confirmación sigue siendo explícita.
- [ ] El valor enviado es el que el usuario ve, con su unidad.

**Verificación.** Prueba de navegador con una boleta sintética: los valores del OCR aparecen precargados y confirmar crea una lectura con ellos.

## [M1] Distinguir lecturas estimadas de reales y bloquear confirmaciones incoherentes
labels: type:story, area:api, area:web, fase:1, prio:alta
effort: 3
milestone: M1 · Números confiables

**Problema.** Ninguna lectura se marca como estimada, aunque la boleta trae `fecha estimada próxima lectura` como texto (`ExtractionResultPanel.tsx:41`). Confirmar un OCR permite elegir cualquier medidor y le impone su unidad (`DocumentDetailPage.tsx:89-97`): una confirmación descuidada crea una lectura verosímil y falsa. Unidad y medidor deben cotejarse antes de crear.

**Criterios de aceptación.**
- [ ] `Reading` distingue origen del valor: `Measured` o `Estimated`, con source de la marca.
- [ ] La API rechaza confirmar un OCR cuyo medidor, unidad o recurso no coincidan con la propuesta.
- [ ] Dos lecturas estimadas consecutivas generan alerta; una estimada no se presenta como medida.
- [ ] Reportes y conciliación informan cuántas lecturas son estimadas.

**Verificación.** Pruebas de integración de rechazo por unidad incompatible y de alerta por estimadas consecutivas.

## [M1] Foco visible y teclado en los flujos críticos
labels: type:bug, area:web, fase:1, prio:media
effort: 1
milestone: M1 · Números confiables

**Problema.** `.main-content:focus { outline: none }` (`apps/web/src/styles/global.css:158-160`) anula el foco programático que el layout mueve al cambiar de ruta (`Layout.tsx:38-42`): quien navega con teclado o lector de pantalla pierde el punto de referencia. El historial de lecturas no tiene `aria-label` (`ReadingDetailPage.tsx:446`). La documentación admite que no hubo auditoría de accesibilidad.

**Criterios de aceptación.**
- [ ] Foco visible en todos los controles interactivos, incluido el salto al contenido tras navegar.
- [ ] Recorrido completo de captura y confirmación OCR sólo con teclado.
- [ ] Tablas e íconos con nombre accesible; contraste verificado.
- [ ] ESLint con reglas de accesibilidad (`jsx-a11y`) en CI.
