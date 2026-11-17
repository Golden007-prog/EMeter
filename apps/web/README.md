# UtilityMeter · Frontend

Cliente local de UtilityMeter para un usuario, sin autenticación. Implementa los cinco catálogos, períodos, lecturas y auditoría, evidencias, revisión humana OCR, cinco reportes y cierre irreversible. Conserva React, TypeScript, Vite, Material UI y la organización por funcionalidades.

El [plan completo](docs/PLAN_IMPLEMENTACION_COMPLETA_API.md) define el alcance de 45 operaciones. La [matriz de implementación y validación](docs/IMPLEMENTACION_API.md) relaciona cada operación con código y pruebas.

## Ejecutar

Requiere Node.js 22.12 o superior. Frontend y harness pertenecen a `D:\coding\UtilityMeterWeb`; el backend permanece en `D:\coding\UtilityMeter`.

```powershell
cd D:\coding\UtilityMeterWeb
npm ci
Copy-Item .env.example .env  # Solo si todavía no existe .env.
npm run dev
```

Abrir <http://127.0.0.1:5173>. El servidor de desarrollo recarga los cambios automáticamente. Si el puerto está ocupado por otra instancia, no iniciar una segunda.

`VITE_API_BASE_URL` es el origen del backend, sin `/api` final. El valor inicial `http://localhost:8080` corresponde al stack de Docker Compose. Para iniciar ese stack, ejecutar `docker compose up -d --build` desde el repositorio backend. OCR requiere API, PostgreSQL, MinIO, Worker y servicio OCR.

Para catálogos, lecturas y reportes sin infraestructura, ejecutar `dotnet run --project src/Presentation` desde el backend y usar `VITE_API_BASE_URL=http://localhost:5032`. Este modo no demuestra OCR durable y pierde los datos al detener la API.

Reiniciar Vite después de cambiar `.env`. Un valor vacío de `VITE_API_BASE_URL` usa el mismo origen y requiere un proxy para `/api`. No guardar secretos en variables `VITE_*`. En producción, el servidor debe servir `index.html` para las rutas de React Router y usar la configuración de API definida al compilar.

## Recorridos disponibles

1. **Configuración:** listar, buscar, crear, consultar y editar organizaciones, condominios, propiedades, medidores y períodos. Seleccionar relaciones por nombre/serie con paginación. Asignar o sustituir el medidor principal desde el detalle de condominio. Consultar versión de API en Sistema.
2. **Períodos:** seleccionar un período de trabajo en la cabecera; el contexto se conserva en URL y enlaces. Editar fechas y cambiar entre estados abiertos desde el directorio. Cerrar definitivamente desde Resumen del período, con confirmación explícita.
3. **Lecturas:** consultar por medidor, propiedad o período; registrar valores acumulados e históricos con origen explícito y período opcional. Mostrar anterior y consumo estimado. Corregir, confirmar, rechazar, reincorporar y anular con motivo/versiones; consultar historial paginado.
4. **Documentos/OCR:** cargar JPEG/PNG/PDF de hasta 20 MiB, recuperar la bandeja por estado y revisar texto/propuestas junto al original. Confirmar valores humanos para crear una lectura. Reintentar trabajos fallidos sin volver a subir el archivo.
5. **Evidencias:** desde una lectura, asociar un original existente o subir otro; abrir y descargar evidencias. Adjuntar a una lectura existente y confirmar OCR son acciones distintas: la segunda crea otra lectura.
6. **Reportes:** pendientes, faltantes, anomalías, resumen por unidad/origen y conciliación de condominio. Seleccionar origen de conciliación y abrir las lecturas o propiedades relacionadas.

La API decide las reglas de negocio. No hay borrado de catálogos, reapertura de períodos, desanulación, cambio de pertenencias históricas, conversión de unidades ni cobros.

## Precisión y recuperación

- Los valores acumulados usan transporte JSON sin pérdida de precisión hasta el límite `numeric(18,2)`. Se admite coma decimal en formularios, sin separadores de miles. Los consumos nulos se muestran como no calculables.
- Las fechas se interpretan en `America/Santiago`, con el offset correspondiente; una hora inexistente se rechaza y una hora repetida requiere elegir su ocurrencia.
- Capturas reintentadas conservan `requestId`. Las mutaciones no se reintentan automáticamente. Upload y altas de catálogos no ofrecen idempotencia general: revisar los registros antes de repetir una petición cuya respuesta se perdió.
- Corrección/revisión/anulación conservan la versión que el usuario abrió. Un 409 mantiene el borrador, muestra el estado actual y exige revisarlo antes de reenviar. Los recálculos invalidan lecturas y reportes relacionados.
- El polling OCR se limita a Queued/Processing y se detiene al salir. La bandeja del servidor permite recuperar trabajos tras recargar. Los navegadores sin visor PDF ofrecen descarga del original.
- El cierre protege captura, edición, revisión, anulación y nuevas evidencias; el servidor también rechaza cambios históricos que recalculen lecturas de períodos cerrados.

## Comprobar

```powershell
npm run build
npm run lint
npm run format:check
npm run test:unit
npm run check:e2e
npx playwright install chromium
npm run test:e2e
npm run test:e2e:full-stack
```

Si el servidor de desarrollo ocupa `5173`, ejecutar la suite aislada en otro puerto:

```powershell
$env:E2E_WEB_PORT='15173'
npm run test:e2e
```

La suite full-stack usa `15173` y una API de prueba en `18081`, con proyecto Compose y volúmenes desechables propios. Prueba OCR real de PDF, PNG y JPEG, fallos/reintentos, persistencia tras reiniciar los servicios de prueba y cobertura de las 45 operaciones desde el navegador. No modifica ni reinicia el backend de trabajo en `8080`.

`npm run test:e2e:live` conserva el modo de solo lectura; `npm run test:e2e:live:write` conserva el alcance de una única propiedad sintética persistente. No se ejecutan cierres ni siembra masiva contra live. Consultar [e2e/README.md](e2e/README.md) para modos, puertos y artefactos.

## Organización

```text
src/
  app/                 # Router, QueryClient, tema y layout
  features/
    catalogs/          # Cinco catálogos, detalles, selectores y sistema
    period-workspace/  # Panel operativo y cierre
    readings/          # Captura, revisión, corrección, anulación e historial
    documents/         # Bandeja OCR, revisión, archivos y asociaciones
    reports/           # Contratos y paneles de los cinco reportes
  shared/
    api/               # JSON exacto, FormData, binarios, errores y metadatos
    lib/               # Decimales y fechas de Santiago
    ui/                # Navegación con contexto, errores y estados de consulta
```

Los contratos se validan con Zod; TanStack Query administra consultas e invalidación. React Hook Form se conserva en la creación de propiedades. Las pantallas incluyen etiquetas, foco de navegación, diálogos, estados de carga/error/vacío y tablas desplazables en móvil. La evaluación de precisión OCR sobre boletas reales y una auditoría integral de accesibilidad son trabajos distintos de la cobertura funcional de la API.
