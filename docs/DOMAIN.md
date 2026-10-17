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

`BillingPeriod.IsImmutable` es verdadero al cerrar el período. Las rutas de cambio de estado y creación de lectura respetan el cierre. No hay borrado ni edición general de catálogos. Las relaciones se validan al crear entidades y lecturas desde la API.

## Lectura, consumo y alertas

1. La creación usa la lectura indicada en `previousReadingId`; si no se indica, busca la más reciente del mismo medidor por `MeasuredAt`.
2. La lectura inicia en `Pending` y guarda el vínculo a la anterior.
3. `Reading.CalculateConsumption(previous, current)` devuelve `max(current.Value - previous.Value, 0)`.
4. Si el valor disminuye, genera `ReadingDecreased` con severidad `Warning`.
5. El promedio histórico se obtiene de diferencias positivas de las lecturas del medidor cuyo predecesor se encuentre en el historial. Diferencias cero o negativas no participan.
6. Con promedio mayor a cero, consumo estrictamente superior a `1.5 × promedio` genera `AbnormallyHighConsumption` con severidad `Warning`.
7. Si hay alertas, el estado final es `Warning`; la medición se conserva.

Una primera lectura no genera alerta de comparación. Las lecturas se enlazan a una anterior del mismo medidor, unidad y origen. Las fechas de un mismo origen deben avanzar cronológicamente; el ingreso de históricos intercalados requiere una futura operación que recalcule la cadena. El medidor debe existir; propiedad y unidad deben coincidir. Los períodos asociados deben existir, contener la fecha y no estar cerrados.

No hay conversión de unidades, tarifas o cobros monetarios. El OCR conserva propuestas y exige confirmación humana antes de crear lecturas. Consulta [OCR](OCR.md).

## Reportes

### Pendientes y anomalías

Pendientes filtra lecturas existentes con estado exactamente `Pending`, por período y/o propiedad si se indican. No detecta medidores sin lectura. Anomalías devuelve lecturas que tengan al menos una alerta, opcionalmente por período.

### Resumen mensual

El resumen usa el billingPeriodId explícito. Cuenta lecturas, pendientes y alertas. Los totales de Company y Resident se calculan mediante diferencias contra predecesores conocidos, sumando los incrementos de cada medidor y origen dentro del período. Una lectura sin predecesor no aporta consumo. No se interpolan consumos entre fechas ni se infiere un mes calendario.

Cuenta discrepancias por medidor cuando ambos orígenes tienen consumo conocido. `totalsByUnit` conserva kWh y m3 separados: los totales escalares son nulos cuando existen varias unidades. El porcentaje agregado solo se calcula cuando ambos orígenes cubren los mismos medidores, hay una sola unidad y Company no es cero.

`pending-readings` mantiene su contrato de lecturas existentes pendientes. `/api/reports/missing-readings/{billingPeriodId}` lista medidores conocidos sin lectura alguna en ese período, con filtro opcional propertyId y hasta 1000 medidores. No distingue todavía un faltante Company de un faltante Resident ni mantiene historial de activación de medidores.

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
