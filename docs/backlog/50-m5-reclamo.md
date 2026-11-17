# Backlog · M5 Reclamo y evidencia

Detectar no sirve si la persona no puede reclamar. Esta fase convierte los hallazgos en un
documento presentable y en un seguimiento del reclamo hasta la respuesta.

## [M5] Expediente de reclamo exportable
labels: type:story, area:api, area:web, fase:5, prio:alta
effort: 4
milestone: M5 · Reclamo y evidencia

**Alcance.** Generación de un PDF (y CSV de respaldo) con: identificación del suministro, período, montos facturados y esperados por hallazgo, cálculo reproducible, lecturas y evidencias adjuntas, y trazabilidad de cuándo se generó. El documento no inventa datos: si falta un dato, lo declara.

**Criterios de aceptación.**
- [ ] El PDF se genera desde el servidor con los mismos números que muestra la UI.
- [ ] Cada hallazgo incluye la fuente del valor esperado (tarifa, lectura, norma o pliego).
- [ ] Los originales de boleta y medidor se adjuntan o se referencian con hash.
- [ ] Sin hallazgos abiertos no se ofrece un expediente de reclamo.

## [M5] Seguimiento de reclamos y escalamiento
labels: type:story, area:api, area:web, fase:5, prio:media
effort: 4
milestone: M5 · Reclamo y evidencia

**Alcance.** `Claim` con estado (borrador, presentado, en respuesta, resuelto, escalado), fecha, monto reclamado, respuesta del proveedor y resultado. Registro del escalamiento al organismo fiscalizador cuando la respuesta no es satisfactoria.

**Criterios de aceptación.**
- [ ] Un reclamo conserva los hallazgos y montos con los que se presentó, aunque después cambien.
- [ ] Se registran fechas y plazos; la UI avisa cuando un plazo está por vencer.
- [ ] El resultado (reajuste, rechazo, silencio) alimenta las estadísticas del producto.

## [M5] Serie histórica y detección de saltos
labels: type:story, area:web, area:api, fase:5, prio:media
effort: 3
milestone: M5 · Reclamo y evidencia

**Alcance.** Serie multiperíodo por propiedad: consumo, monto facturado y monto esperado, con comparación contra el mismo mes del año anterior y contra el promedio propio. Detección de saltos anómalos como insumo de auditoría.

**Criterios de aceptación.**
- [ ] Los períodos sin datos aparecen como hueco, no como cero.
- [ ] La comparación interanual no se hace si falta la base o la unidad difiere.
- [ ] Un salto anómalo abre un hallazgo con la serie que lo sustenta.
