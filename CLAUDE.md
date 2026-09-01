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
- **Rol dual**: `users.es_barbero` (boolean) permite que un admin atienda también como barbero sin cambiar su `rol`. Usar `esBarberoActivo()` y el scope `User::barberos()` en vez de comparar `rol === 'barbero'` a mano.

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

5 mailables en `app/Mail/` (todos `ShouldQueue`, plantillas en `resources/views/emails/`): confirmación, cancelación, aviso al barbero, recordatorio, califica tu visita. El scheduler está en `routes/console.php`: recordatorios diarios a las 09:00 (idempotente vía `recordatorio_enviado_at`) y `citas:finalizar-vencidas` cada hora.

### API (`routes/api.php`)

Un solo archivo de rutas, agrupado por middleware: públicas → `auth:sanctum` → `role:superadmin` / `role:admin` / `role:admin,barbero` → comunes. Detalle completo en `docs/API_ENDPOINTS.md` (mantenerlo al día al tocar rutas).

Convenciones:
- Validaciones en **FormRequests** (`app/Http/Requests/`) con mensajes en español; cross-field via `withValidator()`.
- Uploads multipart usan `POST` + `_method=PUT` (Laravel no parsea multipart en PUT real).
- Rate limits deliberados: login/registro `throttle:10,1`, escrituras de citas/calificaciones `throttle:20,1`, uploads y favoritos `throttle:30,1`. No quitarlos.
- Suspensión de usuarios y remoción de barberos revocan tokens Sanctum activos.

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

Al cambiar rutas o features, actualizar según corresponda: `docs/API_ENDPOINTS.md` (endpoints), `README.md` (features visibles), `docs/DEPLOY.md` / `README-SERVIDOR.md` (infra).
