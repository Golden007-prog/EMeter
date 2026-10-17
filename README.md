# UtilityMeter · Frontend

Primera entrega del prototipo local de un usuario, sin autenticación. Implementa el directorio paginado y la creación de propiedades contra la API real. Lecturas, documentos/OCR, reportes y resumen del período tienen rutas iniciales con su alcance pendiente visible.

## Ejecutar

Requiere Node.js 22.12 o superior y npm. El frontend y su harness pertenecen a este repositorio, `D:\coding\UtilityMeterWeb`. El backend se mantiene separado en `D:\coding\UtilityMeter`.

```powershell
# Terminal 1: API en memoria, suficiente para este recorrido.
cd D:\coding\UtilityMeter
dotnet run --project src/Presentation
```

```powershell
# Terminal 2: frontend.
cd D:\coding\UtilityMeterWeb
npm ci
Copy-Item .env.example .env
# En .env, usar VITE_API_BASE_URL=http://localhost:5032 para la API anterior.
# El valor inicial http://localhost:8080 corresponde a Docker Compose.
npm run dev
```

Abrir <http://127.0.0.1:5173>. CORS admite este origen y `http://localhost:5173`; Vite conserva el puerto con `strictPort`. Si no está disponible, detener el proceso que lo ocupa o cambiar puerto y CORS de forma coordinada.

Para datos persistentes, iniciar el stack con `docker compose up -d --build` desde `D:\coding\UtilityMeter` y usar `VITE_API_BASE_URL=http://localhost:8080`. En memoria, los datos sobreviven a una recarga del navegador pero se pierden al detener la API.

`VITE_API_BASE_URL` es el origen del backend, sin `/api` final; puede incluir un prefijo de despliegue. Vacío usa el mismo origen y requiere que un proxy resuelva `/api`. Reiniciar Vite después de cambiar `.env`; en producción se fija al compilar. No guardar secretos en variables `VITE_*`. El build genera `dist/`; un servidor de archivos debe devolver `index.html` para las rutas de React Router y enviar las rutas `/api` al backend. `npm run preview` solo sirve para revisar el build localmente.

## Recorrido

1. Abrir Configuración → Propiedades. Con una API vacía se invita a crear la primera propiedad.
2. Elegir Nueva propiedad. Validar los errores de nombre y dirección vacíos y el foco en el primer campo inválido.
3. Completar nombre (hasta 200 caracteres), dirección (hasta 500) y recurso. Las pertenencias son opcionales: una propiedad independiente envía ambos identificadores como `null`.
4. Para asociar una pertenencia, buscar organización o condominio por nombre. Las opciones se consultan por páginas de 50; al desplazarse al final se recupera la siguiente. Con el desplegable cerrado, Cargar más opciones también permite recuperarla. Seleccionar organización filtra los condominios; seleccionar un condominio completa su organización. No se ingresan UUID manualmente.
5. Crear. Se impiden envíos simultáneos, se invalida la caché de propiedades y se vuelve a consultar la lista. Se conservan los filtros y la página actuales. Si la propiedad cae fuera de ellos, Buscar creada permite localizarla por nombre.
6. Buscar por nombre y navegar entre páginas. `search`, `page`, `pageSize`, `organizationId` y `condominiumId` están en la URL y sobreviven a recarga y Atrás. `billingPeriodId`, si existe, se conserva en la navegación entre secciones; la selección funcional del período queda para otra entrega.
7. Ante un error, reintentar. El formulario conserva los valores y muestra `ProblemDetails`, incluidos errores de campo o `errors.request`. Un 409 permite actualizar la lista sin cerrar el formulario. La creación de propiedades no usa `expectedVersion`, motivo ni `requestId`: no forman parte de este contrato. No se reintentan automáticamente los POST.

## Comprobar

```powershell
cd D:\coding\UtilityMeterWeb
npm run build
npm run format:check
npx playwright install chromium
npm run test:e2e
```

El harness comprueba TypeScript del frontend y las pruebas, compila con la URL de pruebas en `.e2e-dist/` y sirve ese build mediante Vite Preview en 5173. También inicia y detiene su propia API en memoria en 18080, sin conexión PostgreSQL ni MinIO. Requiere SDK .NET 10 y ambos puertos libres. Se niega a reutilizar servidores existentes para evitar modificar datos de trabajo. Chromium se descarga una vez. No se necesita Docker para estas pruebas. `dist/` conserva su configuración habitual.

Con un backend ya iniciado, `npm run test:e2e:live` prueba la API de `http://localhost:8080` y el navegador sin escribir registros. `npm run test:e2e:live:write` agrega la creación de una única propiedad sintética `[E2E]` que queda persistida. Los reportes HTML/JSON, trazas, capturas y datos de la corrida se guardan en `e2e/artifacts/`. Modos, opciones y diagnóstico en [e2e/README.md](e2e/README.md).

La suite cubre creación independiente y asociada, contrato JSON, validación y foco, consulta tras creación y recarga, paginación real, filtros en URL, pertenencias por nombre, estados de carga/error/vacío, errores de servidor y 409 con conservación del formulario, prevención de doble envío y navegación móvil con teclado. Los errores se simulan en la frontera HTTP; creación, relaciones y paginación usan el backend real. No valida PostgreSQL, OCR ni reportes.

Verificado el 17 de octubre de 2026: compilación de producción sin errores ni advertencias de tamaño, formato correcto y 7/7 pruebas Chromium aprobadas contra ese build y la API real en memoria. Se revisaron las capturas de escritorio y móvil; los servidores de prueba se detuvieron al terminar.

## Organización y decisiones

```text
src/
  app/                     # Router, QueryClient, tema y layout
  features/
    catalogs/              # Contratos Zod, propiedades y selectores paginados
    period-workspace/      # Ruta inicial
    readings/              # Ruta inicial
    documents/             # Ruta inicial de bandeja global
    reports/               # Ruta inicial
  shared/
    api/                   # Fetch configurable, ApiError y ProblemDetails
    ui/                    # Encabezados y mensajes compartidos
  styles/                  # Layout adaptable y estilos globales
```

React + TypeScript + Vite, React Router, TanStack Query y React Hook Form + Zod. [Material UI](https://mui.com/material-ui/getting-started/installation/) proporciona tabla, formularios, autocompletados, diálogos y navegación; un tema común define colores, tipografía y tamaños. [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations) mantiene las consultas y su invalidación tras crear. Los contratos de los tres catálogos utilizados se validan al recibir JSON; la API sigue siendo la autoridad de negocio. No se replican las capas del backend.

Accesibilidad básica: idioma español, etiquetas, encabezados, navegación semántica, enlace para saltar al contenido, estados anunciados, foco al cambiar de sección y en errores, diálogo con foco contenido y cierre por Escape, menú adaptable y tabla con desplazamiento horizontal en pantallas pequeñas. No es una auditoría WCAG completa.

Esta entrega no manipula fechas ni decimales de lecturas. `shared/lib` se incorporará al necesitar esas funciones: las fechas deberán usar `America/Santiago` con el offset de cada instante y los consumos nulos nunca se convertirán en cero. Las reglas de versiones, motivos, idempotencia de capturas, revisión humana OCR y cierre irreversible se mantienen en [la guía funcional del backend](../UtilityMeter/docs/FRONTEND.md).
