# UtilityMeter

Servicio HTTP para registrar lecturas de medidores de agua, electricidad y gas, asociar evidencias y consultar alertas y reportes de consumo. Incluye conciliación entre el medidor principal de un condominio y sus submedidores.

Está construido con .NET 10, ASP.NET Core Minimal APIs, MediatR y Entity Framework Core. El código conserva el nombre de solución y los namespaces `CleanMinimalApi` del template original.

## Estado actual

- Creación y consulta de lecturas por medidor, propiedad y período.
- Detección de lecturas decrecientes y consumos superiores al promedio histórico.
- Carga de archivos con hash SHA-256 y asociación a lecturas.
- Reportes de lecturas pendientes, anomalías, resumen mensual y conciliación de condominios.
- Worker con una cola de trabajos en memoria.

**Los datos, archivos y trabajos se mantienen en memoria y se pierden al reiniciar.** API y Worker ejecutados por separado no comparten almacenamiento ni cola. No hay autenticación, migraciones, datos iniciales ni endpoints de administración de organizaciones, condominios, propiedades, medidores o períodos. La conciliación necesita que esas entidades se carguen desde código. Consulta las [limitaciones conocidas](docs/OPERATIONS.md).

## Inicio rápido

Requiere el SDK .NET 10 compatible con [global.json](global.json). Ejecuta desde la raíz del repositorio:

```powershell
dotnet restore CleanMinimalApi.sln
dotnet build CleanMinimalApi.sln --no-restore
dotnet run --project src/Presentation
```

El perfil local expone Swagger en <https://localhost:7032/swagger> y OpenAPI en <https://localhost:7032/openapi/v1.json>. También escucha en `http://localhost:5032`, con redirección a HTTPS. Si necesitas confiar en el certificado local: `dotnet dev-certs https --trust`.

Para ejecutar las pruebas:

```powershell
dotnet test CleanMinimalApi.sln
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
