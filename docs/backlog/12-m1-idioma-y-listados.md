# Backlog · M1 Idioma y listados

Hallazgos que aparecieron al capturar la interfaz con datos reales de demostración. Son
pequeños, pero afectan la comprensión justo cuando el usuario revisa un número.

## [M1] Los estados y mensajes del dominio deben verse en español
labels: type:bug, area:web, area:api, prio:alta, fase:1
effort: 2
milestone: M1 · Números confiables

**Problema.** La interfaz está en español, pero los valores del dominio se muestran crudos:
en el detalle de una lectura aparecen `Revisión: Pending`, `Estado del cálculo: Warning`,
`Acción: Created` y `Motivo: Reading registered`. La alerta de consumo alto dice
`Consumption of 520.0 is more than 50% above the historical average of 140.0`, y la conciliación
explica `Reconciliation complete: Consumption reconciled using the selected source and
compatible units`. Para una persona que audita su boleta, un mensaje en inglés es una barrera
concreta.

**Criterios de aceptación.**
- [ ] Estados de revisión, cálculo, acción de auditoría y severidad se traducen en un solo lugar.
- [ ] Los mensajes de alerta y de conciliación se generan en español desde el backend, con el
      valor y la unidad formateados.
- [ ] El texto no se duplica entre backend y frontend: la UI traduce enums, el backend redacta
      explicaciones.
- [ ] Prueba que falla si aparece un enum del dominio sin traducción en la tabla de estados.

## [M1] La lista de lecturas debe identificar medidor y propiedad
labels: type:bug, area:web, prio:alta, fase:1
effort: 1
milestone: M1 · Números confiables

**Problema.** En `Lecturas`, con el período seleccionado, la tabla muestra fecha, lectura
acumulada, origen, revisión y estado, pero **no dice de qué medidor ni de qué propiedad es cada
fila**. Con un medidor general y varios submedidores, las cuatro lecturas del período son
indistinguibles; el panel «Lecturas confirmadas» del resumen del período muestra los valores sin
identificar el medidor. El dato existe (el detalle lo muestra), sólo no se presenta.

**Criterios de aceptación.**
- [ ] Cada fila muestra medidor (serie) y propiedad, con enlace a su detalle.
- [ ] La lista permite filtrar por medidor y por propiedad sin salir de la página.
- [ ] El panel de lecturas confirmadas del resumen también identifica el medidor.
- [ ] Prueba de navegador que verifica que dos medidores distintos son distinguibles en la tabla.
