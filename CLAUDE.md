# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es este proyecto

**Tenri Barbería**: SaaS multi-tenant para gestión de barberías (reservas online, equipo, finanzas, calificaciones). Monorepo con backend y frontend separados. **En producción** en https://booking.tenri.cl con deploy automático en cada push a `main`.

El proyecto está escrito en **español**: mensajes de validación, UI, comentarios de código, commits y documentación. Mantener ese idioma.

## Comandos

### Backend (desde `Tenri-Backend/backend/`)

```bash
php artisan serve                    # servidor de desarrollo (http://127.0.0.1:8000)
php artisan test                     # suite completa (Feature tests, SQLite :memory:)
php artisan test --filter=CitaTest   # una suite específica
php artisan test --filter=CitaTest::test_nombre_del_test   # un test individual
php artisan migrate                  # migraciones (PostgreSQL en dev)
php artisan queue:work --sleep=3 --tries=3   # cola de emails (necesaria para probar mails)
php artisan schedule:work            # scheduler en dev (recordatorios, cierre de citas)
```

Los tests corren con SQLite en memoria, `MAIL_MAILER=array` y `QUEUE_CONNECTION=sync` (ver `phpunit.xml`) — no necesitan BD ni SMTP configurados.

**Demo local con el panel de tenri.cl**: la contraseña del Postgres local no se conoce, así que se levanta con SQLite por variables de entorno del proceso (le ganan al `.env`): `DB_CONNECTION=sqlite DB_DATABASE=<ruta>.sqlite PANEL_INTEGRATION_KEY=clave-demo-local APP_URL=http://127.0.0.1:8010 CACHE_STORE=file SESSION_DRIVER=file QUEUE_CONNECTION=sync php artisan serve --port=8010`, y el front con `VITE_API_URL=http://127.0.0.1:8010/api`. El resto del entorno de los tres repos está en el `CLAUDE.md` de la carpeta madre (`../CLAUDE.md`).

### Frontend (desde `Tenri-Front/frontend/`, usa **pnpm**)

```bash
pnpm dev       # Vite dev server
pnpm lint      # ESLint (el CI falla si no pasa)
pnpm build     # build de producción
```

## Arquitectura

### Multi-tenant y roles

Cada barbería es un tenant aislado por `barberia_id`. Los controllers **siempre** filtran por el `barberia_id` del usuario autenticado — nunca confiar en un `barberia_id` que venga del request.

- Roles (`users.rol`): `superadmin` (plataforma), `admin` (su barbería), `barbero` (su agenda), `cliente` (reservas).
- Middleware `role:X` (`app/Http/Middleware/CheckRole.php`) soporta multi-rol: `role:admin,barbero`.
- **Varios locales por persona** (v1.0.0): `barberia_usuario` dice a qué locales tiene acceso cada usuario y con qué rol en cada uno. `users.barberia_id` es **el local que está usando ahora**: por eso el resto del código sigue filtrando por esa columna sin cambios. Cambiar de local es `PUT /api/sesion/local` y adopta el rol de ese local.
- **Rol dual**: `es_barbero` vive en el pivote, por local (sumarse al equipo de un local no lo suma al de otros). `users.es_barbero` es solo el reflejo del local activo, con un único escritor: `User::refrescarEsBarbero()`. Usar `esBarberoActivo()` y el scope `User::barberos()` en vez de comparar `rol === 'barbero'` a mano.
- **Registro público solo para clientes**: los dueños llegan desde tenri.cl (`crear-barberia` del canal del panel), no se registran acá.

### Esquema de base de datos (modelos en `app/Models/`)

| Tabla | Campos clave |
|---|---|
| `users` | `rol`, `es_barbero`, `suspendido`, `barberia_id`, `hora_inicio`/`hora_fin` (jornada del barbero), `bio`, `especialidad`, `avatar` |
| `barberias` | `nombre`, `slug` (único, URL pública), `color_principal`, `logo`, `tiempo_cancelacion` (minutos mínimos para cancelar), `direccion`, `latitud`/`longitud`, `rubro` |
| `servicios` | `nombre`, `precio`, `duracion_minutos`, `imagen`, `barberia_id` |
| `citas` | `cliente_id`, `barbero_id`, `servicio_id`, `fecha`, `hora`, `estado`, `calificacion` (1–5), `comentario`, `recordatorio_enviado_at`, `barberia_id` |
| `bloqueos_horario` | `barbero_id`, `fecha_inicio`/`fecha_fin`, `motivo` (vacaciones/colación/etc.) |
| `favoritos` | pivot `user_id` ↔ `barberia_id` |

Los modelos usan accessors con `$appends` para URLs de imágenes (`logo_url`, `avatar_url`, `imagen_url`) — el frontend consume esos campos, no las rutas crudas de storage.

### Ciclo de vida de la cita (reglas de negocio críticas)

Estados: `pendiente` → `confirmada` → `finalizada` | `cancelada`.

- **No revivir canceladas**: una cita `cancelada` no puede volver a `pendiente`/`confirmada` (el hueco pudo ocuparse). `finalizada` y `cancelada` son terminales.
- **No doble reserva**: `disponibilidad` y `StoreCitaRequest` validan solapamiento contra citas activas, bloqueos y jornada laboral del barbero (`hora_inicio`/`hora_fin`).
- Al reagendar, el estado se conserva (una `pendiente` sigue pendiente).
- **Cierre automático** (`citas:finalizar-vencidas`, cada hora): una `confirmada` cuya hora pasó hace +24 h pasa a `finalizada` y se encola el email "califica tu visita". Solo entonces el cliente puede calificar.
- Zona horaria de negocio: `America/Santiago` (usada en el cierre automático y el export ICS).

### Emails y tareas programadas

Mailables en `app/Mail/` (todos `ShouldQueue`, plantillas en `resources/views/emails/`): confirmación, cancelación, aviso al barbero, recordatorio, califica tu visita y cupo liberado. El scheduler está en `routes/console.php`: recordatorios diarios a las 09:00 (idempotente vía `recordatorio_enviado_at`) y `citas:finalizar-vencidas` cada hora.

- **Lista de espera** (`lista_espera`): al pasar una cita a `cancelada` se avisa a los 3 primeros del día. Está enganchado al **modelo Cita**, no a los controllers, porque cancelar pasa por tres caminos.
- **WhatsApp** (`App\Services\WhatsApp`): driver `log` en desarrollo y `cloud` (Meta) en producción; nunca lanza y cae al correo. El recordatorio sale por WhatsApp o por correo, nunca por los dos. **En producción hay que definir `WHATSAPP_DRIVER=cloud`**: el valor por defecto es `log`, y con él los avisos a quien tenga teléfono quedan en el log y no le llega el correo.
- **Puesta en marcha** de una tienda nueva: `GET/POST /api/mi-barberia/configuracion[/tutorial]`, cuatro pasos, ofrecida una vez por local (`barberias.onboarding_resuelto_en`).

Detalle de multi-local, lista de espera, WhatsApp y puesta en marcha: `docs/FUNCIONES-2026-09.md`.

### API (`routes/api.php`)

Un solo archivo de rutas, agrupado por middleware: canal del panel (`firma.panel`) → públicas → `auth:sanctum` → `role:superadmin` / `role:admin` / `role:admin,barbero` → comunes. Detalle completo en `docs/API_ENDPOINTS.md` (mantenerlo al día al tocar rutas).

El grupo `/integracion/panel/*` es server-to-server: lo llama el backend del panel de tenri.cl firmando cada request con HMAC sobre método + ruta + cuerpo (`VerificarFirmaPanel`, clave en `PANEL_INTEGRATION_KEY`). Contrato, vector de prueba compartido y checklist en `docs/INTEGRACION-PANEL.md` — es la fuente de verdad para el lado que llama.

Convenciones:
- Validaciones en **FormRequests** (`app/Http/Requests/`) con mensajes en español; cross-field via `withValidator()`.
- Uploads multipart usan `POST` + `_method=PUT` (Laravel no parsea multipart en PUT real).
- Rate limits deliberados: login/registro `throttle:10,1`, escrituras de citas/calificaciones `throttle:20,1`, uploads y favoritos `throttle:30,1`. No quitarlos.
- Revocan tokens Sanctum activos: suspender o eliminar un usuario y suspender una barbería (arrastra a todos sus usuarios). Remover a un barbero del equipo **no** revoca su token: solo cancela sus citas activas y lo degrada a `cliente`.

### Frontend (`Tenri-Front/frontend/src/`)

- **Rutas por rol** en `App.jsx`: públicas (`/`, `/barberia/:slug`), `/admin/*` (AdminLayout), `/barbero`, `/superadmin`, `/mis-reservas`. `routes/ProtectedRoute.jsx` redirige según `rol` del `AuthContext`.
- **`context/AuthContext.jsx`**: token Sanctum en localStorage, expone `user` y helpers de rol.
- **Data fetching**: hooks propios `useApi` (GET con estados de carga) y `useApiMutation`. Patrón clave de errores: `useApiMutation.getLastError()` es un ref síncrono legible justo después del `await`; `utils/parseApiError` extrae el primer mensaje del 422 de Laravel para mostrarlo en toast (react-hot-toast). Usar este patrón, no try/catch ad-hoc.
- **Estilos**: Tailwind CSS v4 con tokens de diseño como utilidades en `index.css`. La guía visual vigente es `GUIA-ESTILOS-LIGHT.md` (rediseño "Facelift Light") — respetarla al crear UI nueva.
- Flujo de reserva: `components/BookingModal.jsx` (wizard barbero → fecha → hora, consulta `/barberos/{id}/disponibilidad`).

### Deploy y producción

- Pipeline `.github/workflows/deploy.yml`: tests backend + lint/build frontend → FTP. El frontend queda live al instante; el backend (`backend.zip`) lo aplica el servidor solo (paso SSH opcional o cron watcher). Runbooks: `docs/DEPLOY.md` y `README-SERVIDOR.md`.
- En producción SPA y API comparten origen (`booking.tenri.cl`), con puente `public_html/api/index.php` → Laravel fuera del docroot. **No hay CORS que configurar.**
- BD: PostgreSQL en dev, **MySQL en producción** — evitar SQL crudo específico de un motor; los tests corren en SQLite, lo que ya obliga a queries portables.
- **Nunca** ejecutar `php artisan db:seed` en producción (el seeder se auto-omite con `APP_ENV=production`, pero no invocarlo).

## Documentación a mantener sincronizada

Al cambiar rutas o features, actualizar según corresponda: `docs/API_ENDPOINTS.md` (endpoints), `docs/INTEGRACION-PANEL.md` (canal con el panel), `docs/FUNCIONES-2026-09.md` (multi-local, lista de espera, WhatsApp), `README.md` (features visibles), `docs/DEPLOY.md` / `README-SERVIDOR.md` (infra).

## Flujo de ramas y commits

`fgaete` (trabajo) → `dev` → `main` (despliega). Cada commit lleva la versión: `Tenri Booking vX.Y.Z - Tipo (área): …`. La primera versión con número es **v1.0.0**; los commits anteriores usaban `feat(...)`/`fix(...)`.
