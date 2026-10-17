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

`BillingPeriod.IsImmutable` es verdadero al cerrar el período. Se impiden nuevas lecturas, correcciones, revisiones, anulaciones, nuevas evidencias y cambios de fechas que afecten un período cerrado. También se rechaza un histórico si recalcularía lecturas cerradas. Los catálogos admiten edición de metadatos; las relaciones, recurso y unidad se conservan para proteger el historial.

## Lectura, consumo y alertas

La lectura es acumulada. Se valida medidor, unidad y período y se enlaza la inmediatamente anterior activa del mismo medidor y origen. Los orígenes son Manual, Resident, Company y OCR; no se mezclan cadenas.

Se admiten históricos intercalados. Crear, corregir, rechazar, reincorporar o anular reconstruye vínculos y alertas del origen afectado en una transacción. El promedio histórico usa incrementos positivos anteriores. Un consumo superior a 1.5 veces ese promedio produce AbnormallyHighConsumption; un valor decreciente genera ReadingDecreased. La medición se conserva. Los reportes consideran desconocido el consumo decreciente o sin baseline válido.

reviewStatus es Pending, Confirmed, Rejected o Voided. status muestra Warning cuando una lectura activa tiene alertas y en otro caso coincide con reviewStatus. Una confirmación puede conservar advertencias. Corregir exige revisar nuevamente. Rejected y Voided no aportan a cadenas ni reportes. Voided es definitivo; un rechazo puede reincorporarse si no genera un duplicado.

ReadingRevisions guarda fecha, acción, motivo y snapshots antes/después. version protege contra ediciones concurrentes; requestId evita duplicar capturas reintentadas. PostgreSQL serializa mutaciones por medidor y protege los períodos frente a cierres/cambios de fechas concurrentes. No se registra identidad de revisor en este modo local de un usuario.

Una primera lectura permite comenzar el historial pero no obtener consumo. No se interpreta el valor acumulado como consumo. No hay conversión de unidades, tarifas ni cobros. El OCR exige confirmación humana: [OCR](OCR.md).

## Reportes

Pendientes usa reviewStatus Pending, incluidas advertencias sin revisar. Faltantes identifica medidores sin lectura activa en el período; no distingue orígenes ni mantiene historial de activación. Rechazar/anular puede volver a dejar un medidor faltante. Anomalías devuelve alertas de lecturas activas.

El resumen mensual suma incrementos válidos del mismo medidor, unidad y origen. Conserva unidades separadas y no presenta sumas incompletas como totales completos: uncalculableReadingCount cuenta lecturas sin consumo calculable y totalsBySource incluye Manual y OCR. Las discrepancias comparan consumos Resident/Company por medidor. El porcentaje agregado requiere mismos medidores, una unidad, datos completos y total Company distinto de cero.

La conciliación usa un source explícito (Resident por defecto). Suma incrementos válidos del principal y de todos los submedidores del mismo recurso, excluye al principal de los subtotales incluso si comparte propiedad y exige la misma unidad. No mezcla litros con m3.

Si no hay faltantes ni incompatibilidades, difference = mainConsumption - subMeterConsumption y el porcentaje se calcula sobre el valor absoluto del principal. Con datos insuficientes isComplete es false y difference/differencePercentage son nulos. El subtotal puede ser parcial, explicado en explanation. Las razones incluyen Missing meter, Missing reading, Missing or invalid baseline, Incompatible unit, High consumption y Bill mismatch. Las discrepancias de boletas comparan consumos Resident/Company del mismo medidor, no valores acumulados.

Los períodos se asignan explícitamente: no se interpolan consumos ni se infiere un mes calendario. La conciliación es informativa; no reparte costos ni persiste cobros. Contratos y ejemplos en [API](API.md).
