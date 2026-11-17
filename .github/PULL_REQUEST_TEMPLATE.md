# Cambio propuesto

## Qué cambia

<!-- Resumen en 2-4 líneas. Enlaza el issue: Closes #123 -->

## Por qué

<!-- Qué problema real resuelve y cómo acerca al objetivo de detectar cobros irregulares. -->

## Cómo probarlo

<!-- Comandos exactos y datos de entrada. Si no se pudo ejecutar algo, dilo. -->

## Checklist

- [ ] `dotnet build CleanMinimalApi.sln` y pruebas unitarias de `apps/api` en verde
- [ ] `python -m unittest discover -s services/ocr` en verde (si tocó OCR)
- [ ] `npm run lint && npm run build && npm run test:unit` en `apps/web` (si tocó web)
- [ ] Pruebas de integración cuando cambian transacciones, migraciones, concurrencia o cola durable
- [ ] `docs/` y `/docs/API.md` actualizados si cambia el comportamiento o el contrato
- [ ] Sin secretos, datos personales ni boletas reales en el diff
- [ ] Sin cambios a períodos cerrados ni a invariantes de dominio sin justificación explícita
