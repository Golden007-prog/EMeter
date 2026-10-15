# Ejecución y configuración

[Índice](README.md)

## Requisitos

- SDK .NET 10. `global.json` declara `10.0.1`, `rollForward: latestFeature` y no permite versiones preliminares. Comprueba la selección con `dotnet --version` desde la raíz.
- Acceso a las fuentes de paquetes de `NuGet.config` para la restauración inicial.
- Docker solo si vas a construir imágenes o ejecutar Seq.

No se requiere instalar un servidor de base de datos: la implementación actual usa EF Core InMemory.

## API local

```powershell
dotnet restore CleanMinimalApi.sln
dotnet build CleanMinimalApi.sln --no-restore
dotnet run --project src/Presentation --launch-profile CleanMinimalApi
```

`src/Presentation/Properties/launchSettings.json` configura el entorno `local`, HTTPS en el puerto `7032`, HTTP en `5032` y la apertura de `/swagger`. El perfil se aplica a `dotnet run`, no a una aplicación publicada.

| Recurso | URL local |
| --- | --- |
| Swagger UI | https://localhost:7032/swagger |
| Especificación OpenAPI | https://localhost:7032/openapi/v1.json |
| Versión del ensamblado | https://localhost:7032/api/version/ |

Si el certificado no es de confianza:

```powershell
dotnet dev-certs https --trust
```

## Worker

En otra terminal:

```powershell
dotnet run --project src/Worker
```

El Worker registra `QueuedBackgroundWorker`, que consume `IBackgroundJobQueue` y ejecuta cada delegado de forma secuencial. No hay trabajos periódicos ni productores de trabajos en los handlers actuales. Su cola, base de datos y almacenamiento son propios del proceso: iniciar el Worker no le permite consumir trabajos de la API.

## Configuración

La API carga `appsettings.json`, el archivo del entorno y las sobreescrituras habituales de configuración del host, como variables de entorno. Usa `__` para separar niveles en variables.

| Configuración | Comportamiento actual |
| --- | --- |
| `DOTNET_ENVIRONMENT=local` | Carga `appsettings.local.json`; Serilog escribe en consola |
| `DOTNET_ENVIRONMENT=docker` | Carga `appsettings.docker.json`; Serilog envía a `http://localhost:5341` |
| `ASPNETCORE_URLS` | Define las direcciones de escucha al ejecutar sin perfil |
| `Serilog__WriteTo__0__Args__serverUrl` | Sobreescribe la URL del sink Seq en el entorno `docker` |
| `AllowedHosts` | `*` en la configuración base |

El nivel base de Serilog es `Debug`, con overrides para Microsoft y System. Los nombres de aplicación de logging todavía son `CleanMinimalApi-Local` y `CleanMinimalApi-Docker`. El Worker no configura Serilog como lo hace Presentation.

No hay connection string ni selector de proveedor de almacenamiento: cambiar variables no reemplaza las implementaciones InMemory registradas en `Infrastructure/DependencyInjection.cs`.

## Docker

El `Dockerfile` de la raíz tiene etapas `build`, `test`, `coverage`, `publish` y `run`. La imagen final ejecuta únicamente `Presentation.dll`.

```powershell
docker build --target run -t utilitymeter:local .
docker run --rm -p 8080:80 -e ASPNETCORE_URLS=http://+:80 -e DOTNET_ENVIRONMENT=local utilitymeter:local
```

Este ejemplo fija el puerto HTTP y usa logging a consola. Swagger queda en `http://localhost:8080/swagger`; no configura un certificado HTTPS. La aplicación mantiene `UseHttpsRedirection`, por lo que un despliegue debe definir cómo terminar y atender HTTPS.

### Estado de Docker Compose

`docker-compose.yml` conserva inconsistencias del template y no es una receta funcional sin ajustes:

- La API declara `cleanminimalapi_network`, pero la red definida y usada por Seq es `cleanwebapi_network`.
- El puerto `8080:80` necesita que Kestrel escuche en `80`; `EXPOSE 80` no configura el puerto de escucha.
- El mapeo `8081:443` no configura HTTPS ni un certificado.
- Desde el contenedor API, `localhost:5341` no apunta a Seq; dentro de una red compartida sería `http://seq:80`.
- No incluye Worker ni persistencia de datos de UtilityMeter.

Antes de usar Compose, corrige esos puntos y verifica la configuración efectiva con `docker compose config`. Para la operación actual, utiliza la ejecución local o la imagen individual anterior.

## Publicación sin contenedor

```powershell
dotnet publish src/Presentation/Presentation.csproj -c Release -o artifacts/publish/api
dotnet publish src/Worker/Worker.csproj -c Release -o artifacts/publish/worker
```

Configura entorno, direcciones y logging explícitamente al ejecutar los binarios. Publicar no habilita persistencia ni comunicación entre procesos.
