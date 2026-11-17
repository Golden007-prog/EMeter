# ADR 0001 · Un monorepo para el prototipo

**Estado:** aceptado · 17 de noviembre de 2026

## Contexto

El backend (`cbinput/UtilityMeter`) y el frontend vivían en repositorios separados. El frontend
no tenía remoto y su trabajo estaba sin commitear. Los contratos entre ambos se documentaban
por duplicado (`apps/api/docs/FRONTEND.md` describiendo el repositorio web) y el harness E2E
dependía de una ruta relativa entre carpetas hermanas.

Consecuencias observadas: documentación desincronizada, imposibilidad de revisar un cambio de
contrato completo en un solo diff y riesgo de perder trabajo no versionado.

## Decisión

Un solo repositorio con dos aplicaciones:

```text
apps/api   backend .NET, Worker y servicio OCR
apps/web   cliente React y harness E2E
```

El historial de ambos proyectos se conserva mediante `git subtree`, de modo que `git log`
sigue mostrando cuándo y por qué cambió cada archivo.

## Consecuencias

**A favor.** Un cambio de contrato se revisa y se prueba en un solo PR. El CI puede exigir que
API y web estén en verde juntos. La documentación de producto, arquitectura y roadmap tiene un
único lugar.

**En contra.** El CI crece y debe filtrar por rutas para no reconstruir todo en cada push. Las
rutas relativas del harness cambian (`../UtilityMeter` → `../api`), lo que obliga a un commit de
migración. Los repositorios originales quedan como histórico y no deben recibir cambios nuevos.

## Alternativas descartadas

- **Mantener dos repositorios con submódulos.** Los submódulos agregan fricción para cambios
  coordinados y no resuelven la documentación duplicada.
- **Copiar el código sin historial.** Simple y rápido, pero destruye la trazabilidad de un
  proyecto que ya tiene decisiones documentadas en commits.
