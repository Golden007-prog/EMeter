# Backlog · M3 Tarifas oficiales

Sin precio oficial vigente no existe sobrecobro calculable: solo se puede comparar consumo.
Esta fase convierte la boleta en una afirmación verificable contra el pliego tarifario.

## [M3] Investigar y documentar fuentes tarifarias oficiales
labels: type:spike, area:docs, fase:3, prio:alta
effort: 2
milestone: M3 · Tarifas oficiales

**Preguntas a responder.**
- ¿Dónde publica la autoridad el pliego vigente por empresa y comuna, y con qué periodicidad?
- ¿Qué componentes existen en electricidad residencial (cargo fijo, energía, potencia, alumbrado público, transporte) y cuáles llevan IVA?
- Para agua y gas: componentes, unidades, cargos de alcantarillado y tratamiento, y tratamiento de IVA.
- ¿Cómo se expresa la vigencia (decreto, resolución, fecha de aplicación) y cómo se versiona un cambio?
- ¿Qué dice la normativa sobre lectura estimada, reliquidación y cobro retroactivo?

**Entregable.** `docs/TARIFAS.md` con fuentes citadas, estructura de datos propuesta y casos de prueba reales anonimizados.
**Criterio de cierre.** Otro desarrollador puede cargar una tarifa nueva sin preguntar nada.

## [M3] Catálogo de tarifas con vigencia, comuna y componentes
labels: type:story, area:api, area:data, fase:3, prio:alta
effort: 4
milestone: M3 · Tarifas oficiales

**Alcance.**
- `TariffSchedule`: proveedor, recurso, comuna/región, vigencia desde/hasta, norma de origen, versión.
- `TariffComponent`: tipo (cargo fijo, energía, potencia, alumbrado, transporte, alcantarillado, tratamiento, IVA), valor, unidad, tramo de consumo, afecto a IVA.
- Resolución de la tarifa aplicable a una boleta por proveedor, comuna, recurso y fecha.

**Criterios de aceptación.**
- [ ] Una boleta sin tarifa aplicable se marca "sin tarifa", no se compara contra nada.
- [ ] Dos tarifas superpuestas para el mismo ámbito son un error de carga, no una elección implícita.
- [ ] Se conserva el histórico: cambiar una tarifa no altera auditorías ya emitidas.
- [ ] Pruebas de selección por fecha límite y por tramo.

## [M3] Importación y API de pliegos tarifarios
labels: type:task, area:api, fase:3, prio:media
effort: 3
milestone: M3 · Tarifas oficiales

**Alcance.** Carga desde CSV/JSON con validación de esquema, informe de filas rechazadas y `sourceUrl` por registro. Endpoints de consulta por proveedor/comuna/período.

**Criterios de aceptación.**
- [ ] Importación atómica: o entra todo el pliego, o nada.
- [ ] Cada valor tiene fuente y fecha de carga.
- [ ] Un pliego duplicado no crea una segunda vigencia idéntica.

## [M3] UI de administración de tarifas
labels: type:story, area:web, fase:3, prio:media
effort: 2
milestone: M3 · Tarifas oficiales

**Alcance.** Ver vigencias por proveedor y comuna, cargar un pliego, comparar dos vigencias y detectar huecos o superposiciones.

**Criterios de aceptación.**
- [ ] Hueco de vigencia y superposición visibles antes de guardar.
- [ ] Cada tarifa muestra su fuente y su norma de origen.
- [ ] No se puede editar un pliego ya usado por una auditoría emitida.
