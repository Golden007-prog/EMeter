# Backlog · M7 Cobertura OCR y móvil

El OCR es la puerta de entrada: si leer una boleta cuesta trabajo, nadie audita la segunda.
Esta fase mide la calidad real y lleva la captura al teléfono.

## [M7] Corpus anonimizado y evaluación de precisión
labels: type:spike, area:ocr, fase:7, prio:alta
effort: 5
milestone: M7 · Cobertura OCR y móvil

**Alcance.** Corpus de boletas reales anonimizadas (electricidad, agua, gas) con valores verificados a mano; medición por proveedor y por campo (lectura actual, anterior, consumo, total, cargos, constante); tiempo de revisión humana por boleta; umbral de confianza por campo.

**Criterios de aceptación.**
- [ ] Métricas publicadas por proveedor y campo: exactitud, error absoluto y tasa de campos vacíos.
- [ ] El corpus vive fuera del repositorio con referencia de hash, nunca con datos personales.
- [ ] Los campos bajo el umbral se marcan para revisión obligatoria.
- [ ] La evaluación se puede repetir con un comando y comparar contra la versión anterior.

## [M7] PWA y captura móvil de medidor y boleta
labels: type:story, area:web, fase:7, prio:media
effort: 4
milestone: M7 · Cobertura OCR y móvil

**Alcance.** Instalación como PWA, captura con cámara del medidor y de la boleta, cola local tolerante a conexión intermitente y reintento idempotente al recuperar señal.

**Criterios de aceptación.**
- [ ] Una captura hecha sin señal se envía al recuperar conexión sin duplicar la lectura.
- [ ] La foto conserva calidad suficiente para leer el medidor y se comprime con criterio explícito.
- [ ] La app funciona en un teléfono de gama media sin bloquear la interfaz.
