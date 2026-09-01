# Tenri Barbería

> **SaaS multi-tenant** para gestión integral de barberías. Múltiples negocios operan de forma independiente bajo una misma plataforma, con reservas online, gestión de equipo, finanzas, calificaciones y panel administrativo completo.

🌐 **En producción**: [booking.tenri.cl](https://booking.tenri.cl) — deploy 100% automático (push → tests → FTP → aplicación en servidor).

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Backend | Laravel 12 (PHP 8.2) + Sanctum 4 (API REST) |
| Base de datos | PostgreSQL (desarrollo) / MySQL (producción) |
| Frontend | React 19 + Vite + Tailwind CSS v4 + React Router 6 |
| Autenticación | Laravel Sanctum (tokens por rol) |
| Email | SMTP + Laravel Queues (5 mailables en background) |
| Tareas programadas | Laravel Scheduler (recordatorios y cierre de citas) |
| Storage | Laravel Storage (avatares, logos, imágenes de servicios) |
| CI/CD | GitHub Actions (tests + lint + build + deploy FTP/SSH) |
| Package manager | pnpm |

---

## Arquitectura

Sistema **multi-tenant** donde cada barbería opera como un inquilino independiente:

```
Tenri SPA (superadmin)
  ├── Barbería A (admin + barberos + clientes)
  ├── Barbería B (admin + barberos + clientes)
  └── Barbería N ...
```

### Roles del sistema

| Rol | Descripción |
|---|---|
| `superadmin` | Gestiona toda la plataforma (barberías, usuarios) |
| `admin` | Gestiona su barbería (equipo, servicios, finanzas, configuración) |
| `barbero` | Ve su agenda, gestiona citas, edita su perfil profesional |
| `cliente` | Reserva, califica y gestiona sus citas |

Además existe el **rol dual** (`es_barbero`): un admin dueño del local puede atender como barbero sin perder su panel de administración.

---

## Funcionalidades principales

### Público / cliente
- Landing con catálogo de barberías, **filtro por rubro**, paginación y búsqueda
- Página pública de cada barbería por slug (`/barberia/:slug`) con servicios, equipo y **calificaciones públicas**
- BookingModal con wizard secuencial (barbero → fecha → hora) y validación de disponibilidad real
- **Favoritos**: marcar barberías para encontrarlas rápido
- Reagendar y cancelar citas con notificación por email
- **Calificar la visita** (1–5 estrellas + comentario) tras cita finalizada
- Exportar citas al calendario (archivo ICS en hora de Chile)
- Historial completo en `/mis-reservas`

### Panel del barbero
- Agenda diaria con vista por fecha y cambio de estado de citas
- Perfil profesional editable (foto, bio, especialidad)
- Cancelación de citas con notificación automática al cliente

### Panel del admin
- **Finanzas**: resumen del día y por periodo (hoy, semana, mes, rango custom)
- CRUD de servicios (nombre, precio, duración, imagen)
- Gestión de equipo (asignar/editar/remover barberos con revocación de tokens)
- **Bloqueos de horario** (vacaciones, colación, imprevistos)
- **Mi Tienda**: perfil público de la barbería (logo, dirección con autocompletado y geolocalización, rubro, descripción)
- Configuración (color de marca, tiempo mínimo de cancelación)
- Vista de agenda global de la barbería

### Panel del superadmin
- CRUD completo de barberías (crear, editar, eliminar con cascade)
- CRUD de usuarios del sistema (cambiar rol, suspender/reactivar, eliminar)
- Suspensión con revocación inmediata de tokens activos y login bloqueado

### Automatizaciones (Scheduler + Queues)
- **Recordatorio de citas** del día siguiente por email (diario 09:00, idempotente)
- **Cierre automático de citas vencidas**: una cita confirmada cuya hora pasó hace más de 24 h se marca como realizada, suma a finanzas y dispara el email **"califica tu visita"** (cada hora, idempotente)
- Todos los emails (confirmación, cancelación, aviso al barbero, recordatorio, calificación) se procesan en background vía `QUEUE_CONNECTION=database`

---

## Decisiones técnicas destacadas

### Validaciones centralizadas (FormRequests)
Todas las validaciones viven en FormRequests con mensajes en español, incluyendo validaciones cross-field (ej: `hora_fin > hora_inicio`) vía `withValidator()`. Reglas de negocio endurecidas: no doble reserva, respeto del horario laboral, slugs únicos.

### Rate limiting por sensibilidad
Login/registro (`throttle:10,1`), escrituras de citas y calificaciones (`throttle:20,1`), subidas de imagen y favoritos (`throttle:30,1`). Sin esto, un script podía llenar la agenda de un barbero o spamear calificaciones.

### Multi-tenant con middleware
Las rutas protegidas verifican `barberia_id` del usuario autenticado para aislar tenants. El middleware `role:X` (con soporte multi-rol `role:admin,barbero`) filtra sin lógica extra en los controllers.

### Mensajes de error del backend en el frontend
`useApiMutation` expone `getLastError()` (ref síncrono) para leer el body del error 422 justo después del `await`; `parseApiErrorSync()` extrae el mensaje relevante y lo muestra en toast.

### Frontend y API en el mismo origen
En producción la SPA y `public_html/api/index.php` (puente hacia el Laravel fuera del docroot) comparten `https://booking.tenri.cl` → sin CORS.

---

## Tests y CI/CD

**15 suites de Feature Tests** (auth, citas, agenda, servicios, favoritos, calificaciones, recordatorios, reglas de negocio, rol dual admin-barbero, superadmin, Mi Tienda, seeder).

Pipeline en `.github/workflows/deploy.yml`, en cada push a `main`:

1. `test-backend` — PHPUnit sobre la suite completa
2. `test-frontend` — ESLint + build de Vite
3. `deploy` (solo si todo pasa) — sube por FTP el build del frontend (live al instante) y `backend.zip`; el backend se aplica solo en el servidor (paso SSH del pipeline o cron watcher: unzip + `migrate --force` + `optimize:clear`)

Runbooks: [`docs/DEPLOY.md`](docs/DEPLOY.md) (arquitectura del hosting y setup inicial) y [`README-SERVIDOR.md`](README-SERVIDOR.md) (comandos del servidor DirectAdmin).

---

## Estructura del proyecto

```
Tenri-Barberia/
├── .github/workflows/deploy.yml    # CI/CD completo
├── docs/
│   ├── API_ENDPOINTS.md            # Documentación de la API
│   └── DEPLOY.md                   # Runbook de deploy
├── README-SERVIDOR.md              # Comandos del servidor (DirectAdmin)
├── GUIA-ESTILOS-LIGHT.md           # Guía de diseño del frontend
│
├── Tenri-Backend/
│   └── backend/                    # Laravel 12
│       ├── app/Console/Commands/   # Recordatorios, finalizar vencidas
│       ├── app/Http/Controllers/   # Controllers por dominio
│       ├── app/Http/Requests/      # FormRequests con validaciones
│       ├── app/Http/Middleware/    # CheckRole (multi-rol)
│       ├── app/Mail/               # 5 mailables (ShouldQueue)
│       ├── app/Models/             # Eloquent models
│       ├── database/migrations/
│       ├── routes/api.php          # Rutas agrupadas por rol
│       ├── routes/console.php      # Scheduler
│       └── tests/Feature/          # 15 suites de tests
│
└── Tenri-Front/
    └── frontend/                   # React 19 + Vite
        └── src/
            ├── components/         # BookingModal, ReviewModal, etc.
            ├── context/            # AuthContext, ThemeContext
            ├── hooks/              # useApi, useApiMutation
            ├── layouts/            # AdminLayout, DashboardLayout, PublicLayout
            ├── pages/              # Páginas por rol (admin/, barbero, superadmin)
            ├── routes/             # ProtectedRoute
            └── utils/              # parseApiError, api.js
```

---

## Instalación local

### Requisitos
- PHP 8.2+
- Node.js 20+
- PostgreSQL 15+ (o MySQL)
- pnpm

### Backend

```bash
cd Tenri-Backend/backend

composer install

cp .env.example .env
# Configura DB_*, MAIL_*

php artisan key:generate
php artisan migrate
php artisan storage:link

php artisan serve
```

### Frontend

```bash
cd Tenri-Front/frontend

cp .env.example .env.local
# Configura VITE_API_URL=http://127.0.0.1:8000/api

pnpm install
pnpm dev
```

### Queue worker + scheduler (emails y automatizaciones)

```bash
cd Tenri-Backend/backend
php artisan queue:work --sleep=3 --tries=3
php artisan schedule:work   # en otra terminal, para recordatorios/cierre de citas
```

---

## Variables de entorno

### Backend (`.env`)

| Variable | Descripción |
|---|---|
| `DB_CONNECTION` | `pgsql` en desarrollo, `mysql` en producción |
| `DB_DATABASE` | Nombre de la base de datos |
| `MAIL_MAILER` | `smtp` |
| `MAIL_HOST` / `MAIL_PORT` | ej: `smtp.gmail.com` / `587` |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | Cuenta + App Password |
| `MAIL_ENCRYPTION` | `tls` |
| `QUEUE_CONNECTION` | `database` |

Para producción existe `.env.production.example` como plantilla.

### Frontend (`.env.local`)

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL de la API, ej: `http://127.0.0.1:8000/api` |

---

## API

La documentación de los 40+ endpoints está en [`docs/API_ENDPOINTS.md`](docs/API_ENDPOINTS.md), organizados por middleware:

- **Públicos**: rubros, barberías (con slug), servicios, barberos, disponibilidad
- **`auth:sanctum`**: perfil, reservas, favoritos, calificaciones, reagendar/cancelar
- **`role:admin`**: finanzas, equipo, servicios, bloqueos, Mi Tienda/configuración
- **`role:admin,barbero`**: agenda y estados de citas
- **`role:superadmin`**: CRUD de barberías y usuarios de la plataforma

---

## Autor

**Francisco Parra** — [github.com/Panchuuu](https://github.com/Panchuuu)
