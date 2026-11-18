# Changelog

Todos los cambios relevantes de este proyecto se documentan aquí.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[Versionado Semántico](https://semver.org/lang/es/). Ver [docs/VERSIONING.md](docs/VERSIONING.md).

## [Unreleased]

### Fixed

- La lista de lecturas identifica el medidor y la propiedad, permite filtrar por ambos y muestra la
  serie del medidor en el resumen de lecturas confirmadas (#41).

## [0.1.0] - 2026-11-18

Primera versión del prototipo en un solo repositorio. **No incluye auditoría de cobros**: mide,
lee boletas y reporta consumos.

### Added

- Monorepo con `apps/api` (.NET 10: API, Worker, Infrastructure y servicio OCR en Python) y
  `apps/web` (React 19 + TypeScript + Vite), con el historial de ambos proyectos conservado.
- CI con cuatro jobs: build y pruebas unitarias de la API, parser OCR, lint/build/unitarias del
  cliente web e integración con Testcontainers.
- Documentación de producto, análisis de brechas, roadmap por fases, arquitectura, plan de
  ejecución con agentes y dos ADR (monorepo y capa de auditoría).
- Backlog versionado en `docs/backlog/` que genera etiquetas, hitos, issues y el tablero con
  `scripts/github/sync.ps1`.
- Wiki con capturas reales de la aplicación y pasos para regenerarlas.
- Semilla de datos de demostración (`scripts/demo/seed-demo.ps1`) y captura automatizada con
  Playwright (`apps/web/scripts/capture-wiki.mjs`).
- Política de seguridad con reporte privado de vulnerabilidades y código de conducta.
- Guía de contribución, plantillas de issue y de pull request, y README en español e inglés.

### Known limitations

- Sin autenticación, autorización ni aislamiento de inquilinos: no exponer a Internet.
- Sin tarifas, montos ni detección de sobrecobro; la boleta no se persiste.
- Un solo parser de proveedor real (CGE).
- Períodos cerrados y períodos solapados tienen defectos reproducidos; ver el análisis de
  brechas y los issues de la fase M1.

[Unreleased]: https://github.com/cbinput/EMeter/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/cbinput/EMeter/releases/tag/v0.1.0
