# 🌐 Tenri Barbería · API Endpoints

> **Última revisión:** 2026-09-11 (contra `php artisan route:list --path=api` → 57 registros)
> **Fuente:** [`Tenri-Backend/backend/routes/api.php`](../Tenri-Backend/backend/routes/api.php)
> **Base URL en dev:** `http://127.0.0.1:8000/api` · **en producción:** `https://booking.tenri.cl/api`
> **Auth:** Laravel Sanctum (Bearer token), salvo el canal del panel — que firma con HMAC y no usa Sanctum.

## 📊 Resumen

| Grupo | Middleware | Endpoints |
|---|---|---|
| [🤝 Canal del panel](#-canal-del-panel-server-to-server) | `firma.panel` + `throttle:60,1` | 6 |
| [🌍 Públicos](#-públicos-sin-auth) | — (login/registro con `throttle:10,1`) | 10 |
| [🔐 Comunes autenticados](#-comunes-autenticados-authsanctum--cualquier-rol) | `auth:sanctum` | 6 |
| [👤 Cliente¹](#-cliente-authsanctum--sin-role--ver-nota-) | `auth:sanctum` + `throttle:20,1` | 4 |
| [✂️ Admin + Barbero](#️-admin--barbero-roleadminbarbero) | `role:admin,barbero` | 3 |
| [🏪 Admin](#-admin-roleadmin) | `role:admin` | 18 |
| [👑 Superadmin](#-superadmin-rolesuperadmin) | `role:superadmin` | 10 |
| **Total** | | **57** |

> ¹ Los 4 endpoints "Cliente" están dentro de `auth:sanctum` **sin** un `role:` que los acote a `rol=cliente`. En la práctica cualquier usuario autenticado puede invocarlos (la propiedad se valida dentro del controller). Ver [Inconsistencias §4](#4-rol-de-las-rutas-cliente).

> El conteo cuenta cada registro de ruta: `/barberos/{id}` (POST y PUT) suma **2** aunque apunten al mismo método, y `/mi-barberia` suma **3** (GET + PUT + POST multipart).

---

## 🤝 Canal del panel (server-to-server)

Quien llama es el backend del panel de tenri.cl (api.tenri.cl), no un navegador: no hay Sanctum ni usuario autenticado. Cada request va firmada con HMAC-SHA256 sobre **método + ruta + timestamp + nonce + cuerpo** (`firma.panel` → `VerificarFirmaPanel`). Todo por `POST`/`PUT` con la intención en el cuerpo, para que la firma cubra lo que se pidió. **Contrato completo, headers y ejemplos: [`INTEGRACION-PANEL.md`](INTEGRACION-PANEL.md).**

| Método | URL | Controller@método | Descripción | Línea |
|---|---|---|---|---|
| POST | `/integracion/panel/metricas` | `IntegracionPanelController@metricas` | Foto de la plataforma completa: usuarios, contenido, citas y calificaciones. | 23 |
| POST | `/integracion/panel/barberias` | `IntegracionPanelController@barberias` | Barberías con conteos (usuarios, barberos, citas, citas 30d, reseñas, promedio). | 24 |
| PUT | `/integracion/panel/barberias/{id}/suspension` | `IntegracionPanelController@toggleSuspensionBarberia` | Suspende/reactiva una barbería (toggle reversible; no borra nada). | 25 |
| POST | `/integracion/panel/usuarios` | `IntegracionPanelController@usuarios` | Usuarios paginados (15). Filtros `page`, `buscar`, `rol` **en el cuerpo** (el query string queda fuera de la firma). | 26 |
| PUT | `/integracion/panel/usuarios/{id}/rol` | `IntegracionPanelController@cambiarRolUsuario` | Cambia el rol (`superadmin` / `admin` / `barbero` / `cliente`). | 27 |
| PUT | `/integracion/panel/usuarios/{id}/suspension` | `IntegracionPanelController@toggleSuspensionUsuario` | Suspende/reactiva un usuario (toggle). Al suspender revoca sus tokens Sanctum. | 28 |

- Toda respuesta trae `schema` (hoy `1`): si la forma del payload cambia de manera incompatible, sube el número y el panel viejo lo detecta en vez de leer mal.
- Falla cerrado: sin `PANEL_INTEGRATION_KEY` configurada, el canal entero responde `401` — igual que ante una firma inválida, para no revelar cuál de las dos cosas pasó.
- El `DELETE` de barberías **no** se expone por este canal (arrastra usuarios y citas en cascada); la suspensión es la vía reversible.

---

## 🌍 Públicos (sin auth)

| Método | URL | Controller@método | Descripción | Línea |
|---|---|---|---|---|
| GET | `/health` | `HealthController` | Salud del servicio: `200 {"status":"ok"}` / `503 {"status":"degraded"}`. En `local` agrega `checks` y `time`. Contrato compartido con el resto de la plataforma. | 36 |
| GET | `/sitemap.xml` | `SitemapController` | Sitemap XML del directorio: la portada más cada barbería **activa**. Lo pide el buscador, no el frontend; `robots.txt` apunta a esta URL. Cachea 1 hora. | 40 |
| GET | `/rubros` | `BarberiaController@rubros` | Catálogo de rubros (`clave`/`etiqueta`) para los filtros del landing y el select del panel. | 38 |
| GET | `/servicios` | `ServicioController@index` | Servicios de una barbería. **`?barberia=slug` obligatorio** (`400` si falta). | 39 |
| GET | `/barberos` | `BarberoController@index` | Barberos (scope `barberos()`: rol puro + dueños que atienden). Filtra con `?barberia=slug`. | 40 |
| GET | `/barberias` | `BarberiaController@index` | Directorio público paginado. Solo **activas**: una suspendida no existe hacia afuera. | 41 |
| GET | `/barberias/{slug}` | `BarberiaController@showPorSlug` | Detalle público por slug (con promedio y total de reseñas). `404` si está suspendida. | 42 |
| GET | `/barberos/{id}/disponibilidad` | `CitaController@disponibilidad` | Horas ocupadas/pasadas, bloqueo y jornada del barbero para una fecha. | 43 |
| POST | `/register` | `AuthController@register` | Registro de cliente. `throttle:10,1`. **FormRequest:** `RegisterRequest`. | 46 |
| POST | `/login` | `AuthController@login` | Login, devuelve token. `throttle:10,1`. **FormRequest:** `LoginRequest`. | 47 |

---

## 🔐 Comunes autenticados (auth:sanctum · cualquier rol)

| Método | URL | Controller@método | Descripción | Línea |
|---|---|---|---|---|
| GET | `/user` | closure (`$request->user()`) | Devuelve el usuario autenticado. | 55 |
| PUT | `/perfil` | `AuthController@updatePerfil` | Actualiza perfil propio. **FormRequest:** `UpdatePerfilRequest`. | 56 |
| POST | `/logout` | `AuthController@logout` | Invalida el token actual en el servidor. | 57 |
| GET | `/mis-reservas` | `CitaController@misReservas` | Citas del usuario autenticado como cliente. | 118 |
| GET | `/mis-favoritos` | `FavoritoController@index` | Solo `barberia_ids[]`: el landing ya tiene las barberías y únicamente marca corazones. | 121 |
| POST | `/barberias/{id}/favorito` | `FavoritoController@toggle` | Alterna favorito (devuelve `es_favorita`). `throttle:30,1`. `404` si la barbería no existe. | 122 |

---

## 👤 Cliente (auth:sanctum · sin `role:` — ver nota ¹)

Todo el grupo va bajo `throttle:20,1`: sin él, un script podía llenar la agenda de un barbero o spamear calificaciones.

| Método | URL | Controller@método | Descripción | Línea |
|---|---|---|---|---|
| POST | `/citas` | `CitaController@store` | Crea la cita en estado `confirmada`. **FormRequest:** `StoreCitaRequest`. Rechaza barbería suspendida (`403`), bloqueo del barbero (`409`), solape del barbero (`409`, serializado con `lockForUpdate`), solape del propio cliente (`409`), fuera de jornada (`422`) y más de 3 citas activas (`422`). | 127 |
| PATCH | `/mis-citas/{id}/cancelar` | `CitaController@cancelarMiCita` | Cancela cita propia respetando el `tiempo_cancelacion` de la barbería. | 128 |
| POST | `/mis-citas/{id}/calificar` | `CitaController@calificar` | Califica (1–5) + comentario; solo sobre citas `finalizada`. Recalcula el promedio del barbero. *(validación inline)* | 129 |
| PATCH | `/citas/{id}/reagendar` | `CitaController@reagendar` | Reagenda conservando el estado (una `pendiente` sigue pendiente). No revive canceladas. *(validación inline)* | 132 |

---

## ✂️ Admin + Barbero (role:admin,barbero)

| Método | URL | Controller@método | Descripción | Línea |
|---|---|---|---|---|
| GET | `/citas` | `CitaController@index` | Agenda de la barbería con filtros y búsqueda (paginado 10). | 112 |
| PATCH | `/citas/{id}/estado` | `CitaController@updateEstado` | Cambia el estado. `finalizada` y `cancelada` son terminales. *(validación inline)* | 113 |
| GET | `/barbero/citas` | `CitaController@citasBarbero` | Citas del barbero autenticado (paginado 10). | 114 |

---

## 🏪 Admin (role:admin)

| Método | URL | Controller@método | Descripción | Línea |
|---|---|---|---|---|
| GET | `/finanzas/hoy` | `CitaController@resumenFinancieroHoy` | Resumen del día. *(alias de `resumenPorPeriodo` con `hoy`)* | 81 |
| GET | `/finanzas/resumen` | `CitaController@resumenPorPeriodo` | Resumen financiero por periodo. | 82 |
| GET | `/mi-barberia` | `BarberiaController@miBarberia` | Datos de la barbería del admin. | 85 |
| PUT | `/mi-barberia` | `BarberiaController@updateConfig` | Actualiza la config (JSON). **FormRequest:** `UpdateConfigBarberiaRequest`. | 86 |
| POST | `/mi-barberia` | `BarberiaController@updateConfig` | Misma acción con multipart (`_method=PUT`, subida de logo). `throttle:30,1`. | 88 |
| GET | `/mi-equipo` | `BarberiaController@miEquipo` | Barberos de la barbería (incluye admins con `es_barbero`). | 89 |
| GET | `/mis-servicios` | `BarberiaController@misServicios` | Servicios de la barbería. | 90 |
| POST | `/barberos` | `BarberoController@store` | Crea un barbero nuevo. `throttle:30,1`. *(validación inline — ver §3)* | 93 |
| POST | `/barberos/asignar` | `BarberoController@asignarRol` | Suma al equipo un usuario que ya tiene cuenta. **FormRequest:** `AsignarRolRequest`. | 94 |
| POST | `/barberos/{id}` | `BarberoController@update` | Actualiza barbero (POST + `_method=PUT` para multipart). `throttle:30,1`. **FormRequest:** `UpdateBarberoRequest`. | 95 |
| PUT | `/barberos/{id}` | `BarberoController@update` | Mismo método que la fila anterior (registro duplicado — ver §1). | 96 |
| DELETE | `/barberos/{id}` | `BarberoController@destroy` | Saca del equipo: cancela sus citas activas (avisa por mail a los clientes) y lo degrada a `cliente` con `barberia_id=null` — o solo apaga `es_barbero` si es el dueño con rol dual. | 97 |
| POST | `/servicios` | `ServicioController@store` | Crea servicio. `throttle:30,1`. **FormRequest:** `StoreServicioRequest`. | 100 |
| PUT | `/servicios/{id}` | `ServicioController@update` | Actualiza servicio. `throttle:30,1`. *(validación inline — ver §3)* | 101 |
| DELETE | `/servicios/{id}` | `ServicioController@destroy` | Elimina servicio. | 102 |
| GET | `/bloqueos` | `BloqueoHorarioController@index` | Bloqueos del equipo, del más reciente al más antiguo. | 105 |
| POST | `/bloqueos` | `BloqueoHorarioController@store` | Crea bloqueo (`vacaciones` / `dia_libre` / `permiso` / `otro`). `403` si el barbero es de otra barbería. *(validación inline)* | 106 |
| DELETE | `/bloqueos/{id}` | `BloqueoHorarioController@destroy` | Elimina bloqueo. | 107 |

---

## 👑 Superadmin (role:superadmin)

| Método | URL | Controller@método | Descripción | Línea |
|---|---|---|---|---|
| GET | `/superadmin/barberias` | `BarberiaController@indexSuperadmin` | Listado completo **sin paginar**, incluye suspendidas (el público no las ve). | 63 |
| PATCH | `/superadmin/barberias/{id}/suspender` | `BarberiaController@toggleSuspension` | Suspende/reactiva (toggle): sale del listado público, no acepta reservas y cierra las sesiones de sus usuarios. | 64 |
| POST | `/barberias` | `BarberiaController@store` | Crea barbería (tenant) + su admin inicial. **FormRequest:** `StoreBarberiaRequest`. | 66 |
| POST | `/barberias/{id}` | `BarberiaController@update` | Actualiza barbería con multipart (`_method=PUT`, logo). **FormRequest:** `UpdateBarberiaRequest`. | 67 |
| PUT | `/barberias/{id}` | `BarberiaController@update` | Misma acción con JSON. | 68 |
| DELETE | `/barberias/{id}` | `BarberiaController@destroy` | Borra la barbería **en cascada** (usuarios y citas). La vía reversible es suspender. | 69 |
| GET | `/superadmin/usuarios` | `SuperAdminUsuarioController@index` | Usuarios paginados (15) con filtros `?rol=` y `?buscar=`. | 72 |
| PATCH | `/superadmin/usuarios/{id}/rol` | `SuperAdminUsuarioController@cambiarRol` | Cambia el rol. Guard: no puede cambiarse el propio. **FormRequest:** `ActualizarRolUsuarioRequest`. | 73 |
| PATCH | `/superadmin/usuarios/{id}/suspender` | `SuperAdminUsuarioController@toggleSuspendido` | Suspende/reactiva; al suspender revoca tokens. Guard: no puede suspenderse a sí mismo. | 74 |
| DELETE | `/superadmin/usuarios/{id}` | `SuperAdminUsuarioController@destroy` | Elimina usuario (bloqueado si tiene citas históricas). | 75 |

---

## 🔍 Detalles de query params y cuerpos

### `GET /citas` (admin+barbero) — [`CitaController@index`](../Tenri-Backend/backend/app/Http/Controllers/CitaController.php#L44)
- `?desde=YYYY-MM-DD` / `?hasta=YYYY-MM-DD` — rango de fechas
- `?barbero_id=N` · `?estado=pendiente|confirmada|finalizada|cancelada`
- `?q=string` — busca en `name` **o** `email` del cliente (`like`)
- `?page=N` — paginación (10 por página, conserva el query string)

### `GET /barberias` (público) — [`BarberiaController@index`](../Tenri-Backend/backend/app/Http/Controllers/BarberiaController.php#L31)
- `?per_page=N` — clamp a `[1, 50]`, default 12 (un `per_page=0` rompería `paginate()` en un endpoint abierto)
- `?page=N` — paginación

### `GET /barberos` (público) — [`BarberoController@index`](../Tenri-Backend/backend/app/Http/Controllers/BarberoController.php#L20)
- `?barberia=slug` — filtra por slug de barbería *(el frontend lo usa como `/barberos?barberia=${slug}`)*

### `GET /servicios` (público) — [`ServicioController@index`](../Tenri-Backend/backend/app/Http/Controllers/ServicioController.php#L13)
- `?barberia=slug` — **obligatorio**: sin él responde `400 {"error":"Debes indicar la barbería"}`

### `GET /barberos/{id}/disponibilidad` (público) — [`CitaController@disponibilidad`](../Tenri-Backend/backend/app/Http/Controllers/CitaController.php#L469)
- `?fecha=YYYY-MM-DD` — **obligatorio** (`400` si falta). Retorna `bloqueado`, `motivo`, `ocupadas[]`, `pasadas[]`, `hora_inicio`, `hora_fin`.

### `GET /finanzas/resumen` (admin) — [`CitaController@resumenPorPeriodo`](../Tenri-Backend/backend/app/Http/Controllers/CitaController.php#L172)
- `?periodo=hoy|semana|mes` — default `hoy`
- `?desde=YYYY-MM-DD` + `?hasta=YYYY-MM-DD` — fuerza `periodo=custom`
- Solo cuenta citas `finalizada`. Devuelve `total_ingresos`, `cantidad_cortes`, `desglose_barberos`, `desglose_por_dia`.

### `GET /finanzas/hoy` (admin) — [`CitaController@resumenFinancieroHoy`](../Tenri-Backend/backend/app/Http/Controllers/CitaController.php#L167)
- Sin params propios; delega en `resumenPorPeriodo` con periodo `hoy`.

### `GET /barbero/citas` (admin+barbero) — [`CitaController@citasBarbero`](../Tenri-Backend/backend/app/Http/Controllers/CitaController.php#L459)
- `?page=N` — paginación (10 por página)

### `POST /integracion/panel/usuarios` (panel) — [`IntegracionPanelController@usuarios`](../Tenri-Backend/backend/app/Http/Controllers/IntegracionPanelController.php#L130)
- Cuerpo JSON, todo opcional: `page` (int ≥ 1), `buscar` (string ≤ 120), `rol` (uno de los 4 roles).
- Van en el cuerpo y no en el query string **a propósito**: la firma cubre el cuerpo, no la query.

---

## ⚠️ Inconsistencias detectadas

> Solo reporte, no una lista de tareas: varias son decisiones deliberadas y se documentan para que nadie las "arregle" por error.

### 1. Endpoints definidos pero NO usados por el frontend activo
Método de detección: `apiFetch(` + `useApi(` + `ejecutar(` en `Tenri-Front/frontend/src/`, comparado contra `routes/api.php`.

| Endpoint | Línea | Situación |
|---|---|---|
| `POST /barberos` (`store`) | 93 | El frontend suma barberos con `POST /barberos/asignar` ([EquipoPage.jsx:90](../Tenri-Front/frontend/src/pages/admin/EquipoPage.jsx#L90)). `store` sigue existiendo para crear un barbero sin cuenta previa, pero ninguna pantalla lo invoca. |
| `PUT /barberos/{id}` | 96 | Registro duplicado de la línea 95: el frontend siempre usa la variante `POST` (multipart + `_method`). |
| `PUT /barberias/{id}` | 68 | Ídem: `EditarBarberiaModal.jsx` manda `POST` multipart. La variante JSON queda para clientes que no son el navegador. |
| `PUT /mi-barberia` | 86 | Ídem: `MiTiendaPage.jsx` usa `POST` multipart. |
| `GET /finanzas/hoy` | 81 | El código activo llama `GET /finanzas/resumen?periodo=hoy` ([AgendaPage.jsx:147](../Tenri-Front/frontend/src/pages/admin/AgendaPage.jsx#L147)). |

### 2. Naming inconsistente de URLs
- **Prefijo mixto para acciones sobre una cita del usuario:** `PATCH /mis-citas/{id}/cancelar` y `POST /mis-citas/{id}/calificar` viven bajo `/mis-citas`, mientras `PATCH /citas/{id}/reagendar` y `PATCH /citas/{id}/estado` van bajo `/citas`.
- **`reservas` vs `citas`:** `GET /mis-reservas` usa "reservas" y el resto del dominio "citas". Un solo concepto, dos nombres.
- **`suspender` vs `suspension`:** las rutas internas usan `/suspender` (verbo) y el canal del panel `/suspension` (sustantivo). Cambiar cualquiera de las dos rompe un consumidor ya desplegado.
- **Sugerencia (no aplicar sin coordinar el frontend):** unificar bajo `/citas/...`.

### 3. Métodos de escritura con validación inline (sin FormRequest dedicado)
La convención del proyecto es validar en **FormRequest**. Siguen validando con `$request->validate()` dentro del controller:

| Método | Nota |
|---|---|
| `BarberoController@store` (93) | Sin FormRequest. |
| `ServicioController@update` (101) | `store` sí usa `StoreServicioRequest`; falta un `UpdateServicioRequest` análogo. |
| `BloqueoHorarioController@store` (106) | Sin FormRequest. |
| `CitaController@reagendar` (132) | `store` sí usa `StoreCitaRequest`. |
| `CitaController@updateEstado` (113) | — |
| `CitaController@calificar` (129) | — |
| `SuperAdminUsuarioController@toggleSuspendido` (74) | Toggle sin cuerpo: no hay nada que validar salvo el guard. |
| `IntegracionPanelController@usuarios` / `cambiarRolUsuario` (26, 27) | Inline **a propósito**: el canal del panel no comparte los FormRequests del panel interno (no hay usuario autenticado del que colgar `authorize()`). |

`AsignarRolRequest` y `UpdateConfigBarberiaRequest` ya **no** son huérfanos: los usan `BarberoController@asignarRol` y `BarberiaController@updateConfig`.

### 4. Rol de las rutas "Cliente"
Las rutas de las líneas **118–132** están dentro de `auth:sanctum` pero **fuera de todo grupo `role:`**: cualquier usuario autenticado puede invocarlas, no solo `rol=cliente`.
- `reagendar`, `cancelarMiCita` y `calificar` validan la propiedad dentro del controller → riesgo acotado.
- `POST /citas` crearía la cita con `cliente_id = usuario_actual` (un admin reservando para sí mismo).
- **Marcar como ⚠️ verificar** si se quiere acotar explícitamente a `rol=cliente`.

### 5. Verbos HTTP
- `POST /barberos/{id}`, `POST /barberias/{id}` y `POST /mi-barberia` deberían ser `PUT/PATCH` semánticamente. Se usan con `_method=PUT` porque **Laravel no parsea `multipart/form-data` en un PUT real**. Deliberado.
- El canal del panel usa `POST` para operaciones de solo lectura (`metricas`, `barberias`, `usuarios`): la firma HMAC cubre el cuerpo, así que los filtros tienen que viajar ahí. También deliberado.
- No hay `GET` con efectos secundarios.
