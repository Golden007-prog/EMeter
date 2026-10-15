# Dominio y reglas

[Índice](README.md)

## Modelo

| Entidad | Responsabilidad y relaciones |
| --- | --- |
| `Organization` | Nombre, contacto y lista de propiedades |
| `Condominium` | Organización opcional, dirección, propiedades y medidor principal opcional |
| `UtilityProperty` | Organización/condominio opcionales, dirección, recurso y lista de medidores |
| `Meter` | Propiedad, número de serie, recurso, unidad, modelo y fecha de instalación |
| `BillingPeriod` | Inicio, fin y estado `Open`, `Collecting`, `Validating` o `Closed` |
| `Reading` | Medición acumulada, medidor, propiedad/período opcionales, lectura previa, origen, estado, evidencias y alertas |
| `Evidence` | Clave de almacenamiento, nombre, MIME, hash y metadatos; los bytes no se guardan en el DbContext |
| `Alert` | Tipo, severidad, mensaje, referencias y fecha de creación |

Los recursos son `Water`, `Electricity` y `Gas`. Los identificadores se generan como GUID en las entidades. Las relaciones se representan principalmente mediante IDs y listas; no deben asumirse restricciones referenciales de una base relacional.

`BillingPeriod.IsImmutable` es verdadero cuando el estado es `Closed`, y `SetStatus` rechaza cambios desde ese estado. Sin embargo, `Status` tiene setter público y la creación de lecturas no verifica si el período está cerrado. No existe un flujo HTTP de cierre o bloqueo de períodos.

## Lectura, consumo y alertas

1. La creación usa la lectura indicada en `previousReadingId`; si no se indica, busca la más reciente del mismo medidor por `MeasuredAt`.
2. La lectura inicia en `Pending` y guarda el vínculo a la anterior.
3. `Reading.CalculateConsumption(previous, current)` devuelve `max(current.Value - previous.Value, 0)`.
4. Si el valor disminuye, genera `ReadingDecreased` con severidad `Warning`.
5. El promedio histórico se obtiene de diferencias positivas de las lecturas del medidor cuyo predecesor se encuentre en el historial. Diferencias cero o negativas no participan.
6. Con promedio mayor a cero, consumo estrictamente superior a `1.5 × promedio` genera `AbnormallyHighConsumption` con severidad `Warning`.
7. Si hay alertas, el estado final es `Warning`; la medición se conserva.

Una primera lectura no genera alerta de comparación. La creación no verifica que una lectura previa explícita pertenezca al mismo medidor, que las fechas sean crecientes o que las unidades coincidan. Insertar una lectura antigua sin predecesor explícito puede enlazarla a una lectura posterior, porque la búsqueda usa la última fecha almacenada.

No hay conversión de unidades ni cálculo de tarifas o importes. `ReadingDto` expone mediciones y alertas; no devuelve consumo como campo propio. Los tipos `MissingReading` y `ResidentCompanyMismatch` existen en el enum, pero la creación solo genera las dos alertas descritas arriba.

## Reportes

### Pendientes y anomalías

Pendientes filtra lecturas existentes con estado exactamente `Pending`, por período y/o propiedad si se indican. No detecta medidores sin lectura. Anomalías devuelve lecturas que tengan al menos una alerta, opcionalmente por período.

### Resumen mensual

El resumen se calcula sobre las lecturas del `billingPeriodId` recibido, sin inferir un mes calendario:

- Cuenta lecturas totales, pendientes y con alertas.
- Suma **valores acumulados de lecturas**, no diferencias de consumo, por origen `Resident` y `Company` (sin distinguir mayúsculas).
- Si existen ambos orígenes y sus sumas difieren, `mismatchCount` vale `1`; de lo contrario, `0`. No cuenta discrepancias por propiedad.
- Cuando hay discrepancia y el total Company es distinto de cero: `mismatchPercentage = abs(residentTotal - companyTotal) / companyTotal × 100`.
- Si no existe un origen, su total es nulo; la serialización HTTP omite ese campo. El porcentaje también se omite cuando no corresponde calcularlo.

### Conciliación de condominios

El repositorio carga el condominio, sus propiedades, los medidores referenciados y su historial de lecturas. El cálculo:

1. Selecciona la lectura de mayor `MeasuredAt` por medidor dentro del período.
2. Calcula consumo contra el predecesor si está disponible; si no hay predecesor disponible, usa el valor de la lectura como consumo.
3. Obtiene el consumo principal desde `MainMeterId`.
4. Para cada propiedad cuyo `CondominiumId` coincide, toma el primer medidor de `MeterIds` compatible con el recurso del principal; si no se conoce ese recurso, acepta el primero disponible. No suma múltiples medidores por propiedad.
5. Suma consumos de esos submedidores y calcula `difference = mainConsumption - subMeterConsumption`.
6. Si el principal es distinto de cero: `differencePercentage = abs(difference) / abs(mainConsumption) × 100`.

Sin lectura principal, `mainConsumption` es nulo, `difference` vale cero y el porcentaje es nulo; el reporte lo explica en `explanation`. Ese cero no prueba que el condominio esté conciliado.

Las propiedades sospechosas incluyen razones `Missing reading`, `High consumption` o `Bill mismatch`. La última compara la primera lectura Resident y la primera Company encontradas para la propiedad y período; no agrega consumos ni empareja por medidor. Las razones no se persisten como nuevas alertas.

El repositorio también puede cargar propiedades por la lista `Condominium.PropertyIds`, pero el calculador exige `UtilityProperty.CondominiumId` coincidente: mantener ambas referencias coherentes es necesario. La conciliación es informativa; no reparte costos ni persiste cobros.
