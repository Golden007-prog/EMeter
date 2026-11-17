# Backlog · M6 Producto seguro

El prototipo es local, de un usuario y sin autenticación. Para que personas reales carguen sus
boletas hace falta identidad, aislamiento de datos y operación mínima.

## [M6] Autenticación, multi-tenant y auditoría de identidad
labels: type:story, area:security, area:api, fase:6, prio:alta
effort: 6
milestone: M6 · Producto seguro

**Alcance.** Inicio de sesión con proveedor de identidad, organización por hogar o condominio, aislamiento de datos por inquilino en repositorios y consultas, y registro de quién capturó, revisó, confirmó y reclamó.

**Criterios de aceptación.**
- [ ] Toda consulta filtra por organización; una prueba demuestra que un usuario no ve datos de otro.
- [ ] Cada mutación registra identidad y fecha; el histórico deja de decir "no se registra revisor".
- [ ] El rol de residente no puede editar tarifas ni cerrar períodos.
- [ ] Los datos existentes se migran a una organización por defecto sin pérdida.

## [M6] Endurecimiento y operación
labels: type:task, area:security, area:infra, fase:6, prio:media
effort: 4
milestone: M6 · Producto seguro

**Alcance.** Límite de peticiones en endpoints de carga y OCR, validación de tamaño y tipo real de archivo, cabeceras de seguridad, gestión de secretos fuera del repositorio, respaldos de PostgreSQL y MinIO probados, métricas y alertas, y despliegue reproducible.

**Criterios de aceptación.**
- [ ] Un archivo con tipo declarado falso se rechaza y queda registrado.
- [ ] Existe un procedimiento de restauración probado y documentado, con fecha de la última prueba.
- [ ] Las alertas cubren cola atascada, fallos OCR y errores 5xx.
- [ ] Ningún secreto en el repositorio; CI falla si aparece uno.
