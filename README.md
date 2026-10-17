# UtilityMeter

Servicio HTTP para registrar lecturas de medidores de agua, electricidad y gas, asociar evidencias y consultar alertas y reportes de consumo. Incluye conciliación entre el medidor principal de un condominio y sus submedidores.

Está construido con .NET 10, ASP.NET Core Minimal APIs, MediatR y Entity Framework Core. El código conserva el nombre de solución y los namespaces `CleanMinimalApi` del template original.

## Estado actual

- Creación y consulta de lecturas por medidor, propiedad y período.
- Detección de lecturas decrecientes y consumos superiores al promedio histórico.
- Carga de archivos con hash SHA-256 y asociación a lecturas.
- Reportes de lecturas pendientes, anomalías, resumen mensual y conciliación de condominios.
- Worker con cola durable PostgreSQL, leases y reintentos.

**El stack Docker persiste en PostgreSQL y MinIO y procesa OCR en un Worker separado.** Incluye extracción local PaddleOCR/Tesseract, consulta de estado y confirmación humana idempotente. Sigue siendo un prototipo local sin autenticación. Consulta [flujo completo y límites](docs/OCR.md). Sin configuración externa, la ejecución .NET conserva un modo InMemory para desarrollo manual.

## Inicio rápido

Para el flujo persistente con OCR, requiere Docker:

```powershell
docker compose up -d --build
```

Abre Swagger en <http://localhost:8080/swagger>. Las credenciales y variables locales están en `.env.example`. La primera construcción y descarga de modelos puede tardar varios minutos. Consulta [OCR](docs/OCR.md) para subir, revisar y confirmar una boleta, y [Ejecución](docs/RUN.md) para desarrollo con SDK .NET 10.

Para ejecutar las pruebas:

```powershell
dotnet test CleanMinimalApi.sln
python -m unittest discover -s services/ocr -v
```

## Documentación

| Guía | Contenido |
| --- | --- |
| [Índice](docs/README.md) | Mapa de documentación y alcance |
| [Ejecución y configuración](docs/RUN.md) | SDK, API, Worker, entornos y contenedores |
| [Referencia de API](docs/API.md) | Rutas, contratos, ejemplos y errores actuales |
| [Dominio y reglas](docs/DOMAIN.md) | Entidades, consumo, alertas y conciliación |
| [Arquitectura](docs/ARCHITECTURE.md) | Proyectos, dependencias, persistencia y extensión |
| [Operación y desarrollo](docs/OPERATIONS.md) | Pruebas, diagnóstico, despliegue y pendientes |

Los [planes de implementación](.github/plans/README.md) describen la evolución prevista; no sustituyen la documentación del comportamiento implementado.

## Estructura

```text
src/
  Application/      Entidades, contratos, comandos, consultas y reglas
  Infrastructure/   EF Core InMemory, repositorios, archivos y cola en memoria
  Presentation/     Endpoints HTTP, serialización, filtros, OpenAPI y logging
  Worker/           Host consumidor de trabajos en segundo plano
tests/              Pruebas unitarias e integración
docs/               Documentación del servicio
```

## Licencia

[MIT](LICENSE.md). Se conserva la atribución del proyecto original.
