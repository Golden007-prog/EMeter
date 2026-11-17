# Backlog · M4 Auditoría automática

El corazón del producto: reglas deterministas que comparan lo facturado contra lo que debería
facturarse y producen un hallazgo explicable, con monto en disputa.

## [M4] Motor de auditoría y modelo de hallazgos
labels: type:story, area:api, fase:4, prio:alta
effort: 4
milestone: M4 · Auditoría automática

**Alcance.**
- `AuditFinding`: regla, severidad (informativa, advertencia, crítica), esperado, facturado, diferencia en CLP, unidad, explicación, referencias a boleta/cargo/lectura, estado (abierta, aceptada, descartada, reclamada).
- `AuditRun`: boleta, versión de reglas, fecha, resultado y entrada usada (tarifa, lecturas).
- Contrato de regla: identificador estable, precondiciones, cálculo determinista, tolerancia, explicación en español.

**Criterios de aceptación.**
- [ ] Reejecutar una auditoría no duplica hallazgos abiertos.
- [ ] Un hallazgo sin datos suficientes no se emite: se informa como "no evaluable" con motivo.
- [ ] La explicación permite reproducir el cálculo a mano.
- [ ] Pruebas de regla por caso límite y de determinismo.

## [M4] Reglas de cuadre: suma, período y duplicados
labels: type:story, area:api, fase:4, prio:alta
effort: 3
milestone: M4 · Auditoría automática

**Reglas.** La suma de cargos debe igualar el total declarado (±1 CLP por redondeo); el período facturado debe tener duración plausible y no solaparse con la boleta anterior; un mismo concepto no puede cobrarse dos veces en el período; los ajustes de redondeo en efectivo deben estar identificados y ser menores a la unidad de la moneda.

**Criterios de aceptación.**
- [ ] Cada regla tiene caso positivo y negativo con montos exactos en las pruebas.
- [ ] La diferencia por redondeo se informa como tolerancia, no como cobro indebido.
- [ ] Un cargo duplicado produce un hallazgo crítico con el monto exacto.

## [M4] Reglas de tarifa: cargo fijo y variable
labels: type:story, area:api, fase:4, prio:alta
effort: 4
milestone: M4 · Auditoría automática

**Reglas.** Cargo fijo facturado contra el del pliego vigente para el ámbito; precio por unidad facturado contra el cargo variable aplicable (con IVA y tramos si corresponde); coherencia entre potencia conectada, tarifa contratada y cargos de potencia.

**Criterios de aceptación.**
- [ ] La comparación usa la tarifa del período facturado, no la última cargada.
- [ ] La diferencia se expresa en CLP y como porcentaje, con la tolerancia declarada.
- [ ] Si falta la tarifa o la comuna, el hallazgo es "no evaluable" con el dato faltante nombrado.

## [M4] Reglas de consumo: facturado contra medido
labels: type:story, area:api, fase:4, prio:alta
effort: 4
milestone: M4 · Auditoría automática

**Reglas.** El consumo facturado debe coincidir con la diferencia entre lectura actual y anterior del mismo medidor; la constante o multiplicador del medidor debe estar aplicado; una lectura estimada debe estar marcada y no puede repetirse indefinidamente; una reliquidación o cobro retroactivo debe respetar el máximo de meses permitido y justificarse.

**Criterios de aceptación.**
- [ ] Se distingue "consumo no coincide" de "no hay lectura para comparar".
- [ ] Lectura estimada seguida de real: se evalúa el ajuste, no se presume error.
- [ ] El cobro retroactivo fuera de norma es un hallazgo crítico con el período afectado.

## [M4] Revisión de boleta con monto en disputa
labels: type:story, area:web, fase:4, prio:alta
effort: 4
milestone: M4 · Auditoría automática

**Alcance.** Pantalla de auditoría: estado general, lista de hallazgos ordenados por monto en disputa, cálculo reproducible, evidencia enlazada y acción para aceptar o descartar con motivo.

**Criterios de aceptación.**
- [ ] El total en disputa se calcula sumando hallazgos abiertos y se muestra con moneda.
- [ ] Cada hallazgo muestra qué se esperaba, qué se cobró y de dónde sale el dato esperado.
- [ ] Descartar exige motivo y queda auditado.
- [ ] Sin boleta auditada no se muestra un "0" de sobrecobro: se muestra "sin auditar".

## [M4] Ejecución asíncrona y recálculo de auditorías
labels: type:task, area:api, fase:4, prio:media
effort: 3
milestone: M4 · Auditoría automática

**Alcance.** Reutilizar la cola durable del Worker para auditar al confirmar una boleta, al cargar una tarifa y al corregir lecturas relacionadas. Reintentos y lease iguales a los del OCR.

**Criterios de aceptación.**
- [ ] La auditoría no bloquea la respuesta HTTP.
- [ ] Un fallo deja la boleta en "auditoría fallida", visible y reintentable.
- [ ] Cambiar una tarifa reaudita solo las boletas afectadas y conserva el histórico.
