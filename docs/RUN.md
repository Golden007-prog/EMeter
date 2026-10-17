# Ejecución

Requiere Docker para el stack completo; SDK .NET 10 y Python para desarrollo y pruebas.

```powershell
docker compose up -d --build
docker compose ps
```

- API y Swagger: http://localhost:8080/swagger
- Salud de API: http://localhost:8080/health
- MinIO: http://localhost:9001
- Seq: http://localhost:5341

PostgreSQL, MinIO, modelos OCR y Seq tienen volúmenes persistentes. `docker compose down` conserva los volúmenes; eliminarlos explícitamente elimina sus datos. Los puertos publicados se enlazan a localhost para el prototipo sin autenticación.

Configuración y flujo completo en [OCR](OCR.md). `.env.example` muestra las variables locales. La primera construcción de MinIO desde fuente y descarga de modelos Paddle pueden tardar varios minutos.

## Desarrollo .NET

```powershell
dotnet restore CleanMinimalApi.sln
dotnet build CleanMinimalApi.sln
dotnet test CleanMinimalApi.sln
```

La suite incluye un PostgreSQL temporal con Testcontainers; Docker debe estar disponible. Se puede ejecutar API sin infraestructura con `dotnet run --project src/Presentation` para pruebas manuales en memoria; ese modo no ofrece procesamiento OCR durable.

Para ejecutar API y Worker en el host contra servicios de Compose, configura en ambos procesos:

```powershell
$env:ConnectionStrings__UtilityMeter='Host=localhost;Database=utilitymeter;Username=utilitymeter;Password=utilitymeter-local'
$env:Storage__Endpoint='localhost:9000'
$env:Storage__AccessKey='utilitymeter'
$env:Storage__SecretKey='utilitymeter-local-secret'
$env:Ocr__BaseUrl='http://localhost:8090/'
```

OCR no publica puerto al host por defecto; publica 8090 mediante un override de Compose para esta modalidad. Inicia primero API para aplicar migraciones y crear bucket, después Worker. Los perfiles locales de API usan HTTPS 7032 y HTTP 5032. Dentro de contenedores se usa HTTP 8080; HTTPS debe terminarse en un proxy si se despliega fuera del equipo.

Las migraciones están en Infrastructure/Databases/UtilityMeter/Migrations. Para generar nuevas, usa dotnet-ef 10.0.11 contra Infrastructure (incluye factory de diseño). No uses EnsureCreated junto con migraciones.
