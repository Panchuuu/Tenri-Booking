# 🌐 Tenri Barbería · API Endpoints

> **Última revisión:** 2026-09-22 (contra `routes/api.php` del working tree → 68 registros; los 11 nuevos respecto de la revisión del 2026-09-11 están marcados como **nuevo**)
> **Fuente:** [`Tenri-Backend/backend/routes/api.php`](../Tenri-Backend/backend/routes/api.php)
> **Base URL en dev:** `http://127.0.0.1:8000/api` · **en producción:** `https://booking.tenri.cl/api`
> **Auth:** Laravel Sanctum (Bearer token), salvo el canal del panel — que firma con HMAC y no usa Sanctum.

## 📊 Resumen

| Grupo | Middleware | Endpoints |
|---|---|---|
| [🤝 Canal del panel](#-canal-del-panel-server-to-server) | `firma.panel` + `throttle:60,1` | 9 |
| [🌍 Públicos](#-públicos-sin-auth) | — (login/registro con `throttle:10,1`) | 10 |
| [🔐 Comunes autenticados](#-comunes-autenticados-authsanctum--cualquier-rol) | `auth:sanctum` | 11 |
| [👤 Cliente¹](#-cliente-authsanctum--sin-role--ver-nota-) | `auth:sanctum` + `throttle:20,1` | 4 |
| [✂️ Admin + Barbero](#️-admin--barbero-roleadminbarbero) | `role:admin,barbero` | 3 |
| [🏪 Admin](#-admin-roleadmin) | `role:admin` | 21 |
| [👑 Superadmin](#-superadmin-rolesuperadmin) | `role:superadmin` | 10 |
| **Total** | | **68** |

> ¹ Los 4 endpoints "Cliente" están dentro de `auth:sanctum` **sin** un `role:` que los acote a `rol=cliente`. En la práctica cualquier usuario autenticado puede invocarlos (la propiedad se valida dentro del controller). Ver [Inconsistencias §4](#4-rol-de-las-rutas-cliente).

> El conteo cuenta cada registro de ruta: `/barberos/{id}` (POST y PUT) suma **2** aunque apunten al mismo método, y `/mi-barberia` suma **3** (GET + PUT + POST multipart).

> **Multi-local.** Desde la revisión del 2026-09-22 una persona puede tener acceso a varios locales (tabla `barberia_usuario`). `users.barberia_id` es el local que tiene **seleccionado**, y `users.rol` el rol que tiene en ese local. Todo lo que dice "de la barbería del admin" o "del local" en este documento se refiere a ese local activo, y los `role:` de las rutas se evalúan contra el rol del local activo. Ver [`FUNCIONES-2026-09.md`](FUNCIONES-2026-09.md).

---

## 🤝 Canal del panel (server-to-server)

Quien llama es el backend del panel de tenri.cl (api.tenri.cl), no un navegador: no hay Sanctum ni usuario autenticado. Cada request va firmada con HMAC-SHA256 sobre **método + ruta + timestamp + nonce + cuerpo** (`firma.panel` → `VerificarFirmaPanel`). Todo por `POST`/`PUT` con la intención en el cuerpo, para que la firma cubra lo que se pidió. **Contrato completo, headers y ejemplos: [`INTEGRACION-PANEL.md`](INTEGRACION-PANEL.md).**

| Método | URL | Controller@método | Descripción | Línea |
|---|---|---|---|---|
| POST | `/integracion/panel/metricas` | `IntegracionPanelController@metricas` | Foto de la plataforma completa: usuarios, contenido, citas y calificaciones. | 25 |
| POST | `/integracion/panel/barberias` | `IntegracionPanelController@barberias` | Barberías con conteos (usuarios, barberos, citas, citas 30d, reseñas, promedio). `barberos_count` es de quienes atienden **en ese local**. | 26 |
| POST | `/integracion/panel/crear-barberia` | `IntegracionPanelController@crearBarberia` | **Nuevo.** Alta de una tienda con su admin, disparada por una compra en tenri.cl. Acepta `admin_password` **o** `admin_password_hash` (nunca las dos). Si el correo ya tiene cuenta, le suma el local y no le toca la contraseña (`admin_creado: false`). Responde `201`. | 27 |
| POST | `/integracion/panel/nombre-disponible` | `IntegracionPanelController@nombreDisponible` | **Nuevo.** Si un nombre de tienda está libre y con qué slug quedaría. No reserva el nombre. | 28 |
| PUT | `/integracion/panel/usuarios/password` | `IntegracionPanelController@sincronizarPassword` | **Nuevo.** Copia a la cuenta de booking el hash de la contraseña que el admin cambió en tenri.cl. Busca por `barberia_id` + `email`; nunca toca a un superadmin. | 29 |
| PUT | `/integracion/panel/barberias/{id}/suspension` | `IntegracionPanelController@toggleSuspensionBarberia` | Suspende/reactiva una barbería (toggle reversible; no borra nada). | 30 |
| POST | `/integracion/panel/usuarios` | `IntegracionPanelController@usuarios` | Usuarios paginados (15). Filtros `page`, `buscar`, `rol` **en el cuerpo** (el query string queda fuera de la firma). | 31 |
| PUT | `/integracion/panel/usuarios/{id}/rol` | `IntegracionPanelController@cambiarRolUsuario` | Cambia el rol (`superadmin` / `admin` / `barbero` / `cliente`). Solo toca `users.rol`, no el rol por local de `barberia_usuario`. | 32 |
| PUT | `/integracion/panel/usuarios/{id}/suspension` | `IntegracionPanelController@toggleSuspensionUsuario` | Suspende/reactiva un usuario (toggle). Al suspender revoca sus tokens Sanctum. | 33 |

- Toda respuesta trae `schema` (hoy `1`): si la forma del payload cambia de manera incompatible, sube el número y el panel viejo lo detecta en vez de leer mal.
- Falla cerrado: sin `PANEL_INTEGRATION_KEY` configurada, el canal entero responde `401` — igual que ante una firma inválida, para no revelar cuál de las dos cosas pasó.
- El `DELETE` de barberías **no** se expone por este canal (arrastra usuarios y citas en cascada); la suspensión es la vía reversible.

---

## 🌍 Públicos (sin auth)

| Método | URL | Controller@método | Descripción | Línea |
|---|---|---|---|---|
| GET | `/health` | `HealthController` | Salud del servicio: `200 {"status":"ok"}` / `503 {"status":"degraded"}`. En `local` agrega `checks` y `time`. Contrato compartido con el resto de la plataforma. | 41 |
| GET | `/sitemap.xml` | `SitemapController` | Sitemap XML del directorio: la portada más cada barbería **activa**. Lo pide el buscador, no el frontend; `robots.txt` apunta a esta URL. Cachea 1 hora. | 45 |
| GET | `/rubros` | `BarberiaController@rubros` | Catálogo de rubros (`clave`/`etiqueta`) para los filtros del landing y el select del panel. | 47 |
| GET | `/servicios` | `ServicioController@index` | Servicios de una barbería. **`?barberia=slug` obligatorio** (`400` si falta). | 48 |
| GET | `/barberos` | `BarberoController@index` | Con `?barberia=slug`: quienes atienden **en ese local** (`Barberia::quienesAtienden()`, por fila de `barberia_usuario`; `[]` si el slug no existe). Sin filtro: scope `User::barberos()` global. | 49 |
| GET | `/barberias` | `BarberiaController@index` | Directorio público paginado. Solo **activas**: una suspendida no existe hacia afuera. | 50 |
| GET | `/barberias/{slug}` | `BarberiaController@showPorSlug` | Detalle público por slug (con promedio y total de reseñas). `404` si está suspendida. | 51 |
| GET | `/barberos/{id}/disponibilidad` | `CitaController@disponibilidad` | Horas ocupadas/pasadas, bloqueo y jornada del barbero para una fecha. | 52 |
| POST | `/register` | `AuthController@register` | Registro de **cliente** (siempre crea `rol=cliente`). Los dueños no se registran acá: su cuenta nace al comprar Booking en tenri.cl. `throttle:10,1`. **FormRequest:** `RegisterRequest`. | 55 |
| POST | `/login` | `AuthController@login` | Login, devuelve `access_token`, `user` y `locales[]` (ver abajo). Si el local activo está suspendido pero tiene otro activo, lo cambia a ese; si no le queda ninguno, `403`. `throttle:10,1`. **FormRequest:** `LoginRequest`. | 56 |

---

## 🔐 Comunes autenticados (auth:sanctum · cualquier rol)

| Método | URL | Controller@método | Descripción | Línea |
|---|---|---|---|---|
| GET | `/user` | closure (`$request->user()`) | Devuelve el usuario autenticado. | 64 |
| PUT | `/perfil` | `AuthController@updatePerfil` | Actualiza perfil propio. Acepta `telefono` opcional (para WhatsApp; vacío lo borra). **FormRequest:** `UpdatePerfilRequest`. | 65 |
| POST | `/logout` | `AuthController@logout` | Invalida el token actual en el servidor. | 66 |
| GET | `/sesion/locales` | `AuthController@misLocales` | **Nuevo.** Los locales a los que tiene acceso quien está en sesión, con su rol en cada uno y cuál es el activo. Lo usa el front al recargar, que no vuelve a pasar por el login. | 70 |
| PUT | `/sesion/local` | `AuthController@seleccionarLocal` | **Nuevo.** Cambia el local activo y adopta el rol que tiene ahí. `403` si no tiene acceso o si el local está suspendido. *(validación inline)* | 71 |
| GET | `/mis-reservas` | `CitaController@misReservas` | Citas del usuario autenticado como cliente. | 141 |
| GET | `/mi-lista-espera` | `ListaEsperaController@mias` | **Nuevo.** Las listas de espera vigentes de quien pregunta (hoy en adelante, sin las `cerrada`). | 145 |
| POST | `/lista-espera` | `ListaEsperaController@store` | **Nuevo.** Pide que le avisen si se libera una hora ese día. `throttle:20,1`. Anotarse dos veces el mismo día y local actualiza la fila existente. `422` si el local está suspendido. *(validación inline)* | 146 |
| DELETE | `/lista-espera/{id}` | `ListaEsperaController@destroy` | **Nuevo.** Se baja de la lista (pasa a `cerrada`, no se borra). `404` si la fila no es suya. | 147 |
| GET | `/mis-favoritos` | `FavoritoController@index` | Solo `barberia_ids[]`: el landing ya tiene las barberías y únicamente marca corazones. | 150 |
| POST | `/barberias/{id}/favorito` | `FavoritoController@toggle` | Alterna favorito (devuelve `es_favorita`). `throttle:30,1`. `404` si la barbería no existe. | 151 |

---

## 👤 Cliente (auth:sanctum · sin `role:` — ver nota ¹)

Todo el grupo va bajo `throttle:20,1`: sin él, un script podía llenar la agenda de un barbero o spamear calificaciones.

| Método | URL | Controller@método | Descripción | Línea |
|---|---|---|---|---|
| POST | `/citas` | `CitaController@store` | Crea la cita en estado `confirmada`. **FormRequest:** `StoreCitaRequest`. Rechaza barbería suspendida (`403`), bloqueo del barbero (`409`), solape del barbero (`409`, serializado con `lockForUpdate`), solape del propio cliente (`409`), fuera de jornada (`422`) y más de 3 citas activas (`422`). | 156 |
| PATCH | `/mis-citas/{id}/cancelar` | `CitaController@cancelarMiCita` | Cancela cita propia respetando el `tiempo_cancelacion` de la barbería. Como toda cancelación, dispara el aviso a la lista de espera. | 157 |
| POST | `/mis-citas/{id}/calificar` | `CitaController@calificar` | Califica (1–5) + comentario; solo sobre citas `finalizada`. Recalcula el promedio del barbero. *(validación inline)* | 158 |
| PATCH | `/citas/{id}/reagendar` | `CitaController@reagendar` | Reagenda conservando el estado (una `pendiente` sigue pendiente). No revive canceladas. *(validación inline)* | 161 |

---

## ✂️ Admin + Barbero (role:admin,barbero)

| Método | URL | Controller@método | Descripción | Línea |
|---|---|---|---|---|
| GET | `/citas` | `CitaController@index` | Agenda de la barbería con filtros y búsqueda (paginado 10). | 135 |
| PATCH | `/citas/{id}/estado` | `CitaController@updateEstado` | Cambia el estado. `finalizada` y `cancelada` son terminales. Pasar a `cancelada` dispara el aviso a la lista de espera. *(validación inline)* | 136 |
| GET | `/barbero/citas` | `CitaController@citasBarbero` | Citas del barbero autenticado (paginado 10). | 137 |

---

## 🏪 Admin (role:admin)

| Método | URL | Controller@método | Descripción | Línea |
|---|---|---|---|---|
| GET | `/finanzas/hoy` | `CitaController@resumenFinancieroHoy` | Resumen del día. *(alias de `resumenPorPeriodo` con `hoy`)* | 95 |
| GET | `/finanzas/resumen` | `CitaController@resumenPorPeriodo` | Resumen financiero por periodo. | 96 |
| GET | `/mi-barberia` | `BarberiaController@miBarberia` | Datos de la barbería del admin. | 99 |
| PUT | `/mi-barberia` | `BarberiaController@updateConfig` | Actualiza la config (JSON). **FormRequest:** `UpdateConfigBarberiaRequest`. | 100 |
| POST | `/mi-barberia` | `BarberiaController@updateConfig` | Misma acción con multipart (`_method=PUT`, subida de logo). `throttle:30,1`. | 102 |
| GET | `/mi-equipo` | `BarberiaController@miEquipo` | Quienes atienden **en el local activo** (barberos del local + admins con `es_barbero` en ese local). | 103 |
| GET | `/mi-barberia/lista-espera` | `ListaEsperaController@delLocal` | **Nuevo.** Quienes esperan una hora en el local activo (estado `esperando`, de hoy en adelante), con nombre, correo y teléfono del cliente. | 109 |
| GET | `/mi-barberia/configuracion` | `ConfiguracionTiendaController@estado` | **Nuevo.** Avance de la puesta en marcha del local activo: `porcentaje`, `pasos[]` y `tutorial_pendiente`. `409` si no hay local seleccionado. | 111 |
| POST | `/mi-barberia/configuracion/tutorial` | `ConfiguracionTiendaController@resolverTutorial` | **Nuevo.** Marca el tutorial como resuelto (seguido o saltado): llena `barberias.onboarding_resuelto_en`. Sin cuerpo. `409` si no hay local seleccionado. | 112 |
| GET | `/mis-servicios` | `BarberiaController@misServicios` | Servicios de la barbería. | 113 |
| POST | `/barberos` | `BarberoController@store` | Crea un barbero nuevo y le da acceso al local activo como `barbero`. `throttle:30,1`. *(validación inline — ver §3)* | 116 |
| POST | `/barberos/asignar` | `BarberoController@asignarRol` | Suma al equipo un usuario que ya tiene cuenta. "Es de mi equipo" se mide por acceso al local activo, no por el local que la otra persona tenga seleccionado. **FormRequest:** `AsignarRolRequest`. | 117 |
| POST | `/barberos/{id}` | `BarberoController@update` | Actualiza barbero (POST + `_method=PUT` para multipart). `throttle:30,1`. **FormRequest:** `UpdateBarberoRequest`. | 118 |
| PUT | `/barberos/{id}` | `BarberoController@update` | Mismo método que la fila anterior (registro duplicado — ver §1). | 119 |
| DELETE | `/barberos/{id}` | `BarberoController@destroy` | Saca del equipo **de este local**: cancela sus citas activas (avisa por mail a los clientes). Un barbero pierde el acceso a este local; si trabaja en otro, pasa a ese, y si no le queda ninguno se degrada a `cliente`. Al dueño con rol dual solo se le apaga `es_barbero` en este local. | 120 |
| POST | `/servicios` | `ServicioController@store` | Crea servicio. `throttle:30,1`. **FormRequest:** `StoreServicioRequest`. | 123 |
| PUT | `/servicios/{id}` | `ServicioController@update` | Actualiza servicio. `throttle:30,1`. *(validación inline — ver §3)* | 124 |
| DELETE | `/servicios/{id}` | `ServicioController@destroy` | Elimina servicio. | 125 |
| GET | `/bloqueos` | `BloqueoHorarioController@index` | Bloqueos del equipo, del más reciente al más antiguo. | 128 |
| POST | `/bloqueos` | `BloqueoHorarioController@store` | Crea bloqueo (`vacaciones` / `dia_libre` / `permiso` / `otro`). `403` si el barbero es de otra barbería. *(validación inline)* | 129 |
| DELETE | `/bloqueos/{id}` | `BloqueoHorarioController@destroy` | Elimina bloqueo. | 130 |

---

## 👑 Superadmin (role:superadmin)

| Método | URL | Controller@método | Descripción | Línea |
|---|---|---|---|---|
| GET | `/superadmin/barberias` | `BarberiaController@indexSuperadmin` | Listado completo **sin paginar**, incluye suspendidas (el público no las ve). | 77 |
| PATCH | `/superadmin/barberias/{id}/suspender` | `BarberiaController@toggleSuspension` | Suspende/reactiva (toggle): sale del listado público, no acepta reservas y cierra las sesiones de sus usuarios. | 78 |
| POST | `/barberias` | `BarberiaController@store` | Crea barbería (tenant) + su admin inicial, vía `Barberia::crearConAdmin()` (la misma operación que usa `crear-barberia` del panel: si el correo ya existe, le suma el local). **FormRequest:** `StoreBarberiaRequest`. | 80 |
| POST | `/barberias/{id}` | `BarberiaController@update` | Actualiza barbería con multipart (`_method=PUT`, logo). **FormRequest:** `UpdateBarberiaRequest`. | 81 |
| PUT | `/barberias/{id}` | `BarberiaController@update` | Misma acción con JSON. | 82 |
| DELETE | `/barberias/{id}` | `BarberiaController@destroy` | Borra la barbería **en cascada** (usuarios y citas). La vía reversible es suspender. | 83 |
| GET | `/superadmin/usuarios` | `SuperAdminUsuarioController@index` | Usuarios paginados (15) con filtros `?rol=` y `?buscar=`. | 86 |
| PATCH | `/superadmin/usuarios/{id}/rol` | `SuperAdminUsuarioController@cambiarRol` | Cambia el rol. Guard: no puede cambiarse el propio. **FormRequest:** `ActualizarRolUsuarioRequest`. | 87 |
| PATCH | `/superadmin/usuarios/{id}/suspender` | `SuperAdminUsuarioController@toggleSuspendido` | Suspende/reactiva; al suspender revoca tokens. Guard: no puede suspenderse a sí mismo. | 88 |
| DELETE | `/superadmin/usuarios/{id}` | `SuperAdminUsuarioController@destroy` | Elimina usuario (bloqueado si tiene citas históricas). | 89 |

---

## 🔍 Detalles de query params y cuerpos

### `GET /citas` (admin+barbero) — [`CitaController@index`](../Tenri-Backend/backend/app/Http/Controllers/CitaController.php#L44)
- `?desde=YYYY-MM-DD` / `?hasta=YYYY-MM-DD` — rango de fechas
- `?barbero_id=N` · `?estado=pendiente|confirmada|finalizada|cancelada`
- `?q=string` — busca en `name` **o** `email` del cliente (`like`)
- `?page=N` — paginación (10 por página, conserva el query string)

### `GET /barberias` (público) — [`BarberiaController@index`](../Tenri-Backend/backend/app/Http/Controllers/BarberiaController.php#L29)
- `?per_page=N` — clamp a `[1, 50]`, default 12 (un `per_page=0` rompería `paginate()` en un endpoint abierto)
- `?page=N` — paginación

### `GET /barberos` (público) — [`BarberoController@index`](../Tenri-Backend/backend/app/Http/Controllers/BarberoController.php#L21)
- `?barberia=slug` — quienes atienden en ese local *(el frontend lo usa como `/barberos?barberia=${slug}`)*. Un slug que no existe devuelve `[]`.

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

### `POST /integracion/panel/usuarios` (panel) — [`IntegracionPanelController@usuarios`](../Tenri-Backend/backend/app/Http/Controllers/IntegracionPanelController.php#L260)
- Cuerpo JSON, todo opcional: `page` (int ≥ 1), `buscar` (string ≤ 120), `rol` (uno de los 4 roles).
- Van en el cuerpo y no en el query string **a propósito**: la firma cubre el cuerpo, no la query.

### `POST /integracion/panel/crear-barberia` (panel) — [`IntegracionPanelController@crearBarberia`](../Tenri-Backend/backend/app/Http/Controllers/IntegracionPanelController.php#L112)
- Cuerpo: `nombre_barberia` (obligatorio, 3–60, único), `color_principal` (obligatorio, ≤ 20), `admin_nombre` (obligatorio, 2–80), `admin_email` (obligatorio, `email:rfc,filter`, ≤ 120, **sin** `dns`), `admin_password` (≥ 8) **o** `admin_password_hash` (≤ 255) — exactamente una de las dos —, `plan` (opcional, ≤ 40).
- Respuesta `201`: `{"schema":1,"barberia":{…},"admin_creado":true|false}`. `false` = el correo ya tenía cuenta, se le sumó el local y conserva su contraseña.
- `422` si el nombre está tomado, si el correo es de un superadmin, o si la contraseña viene en las dos formas o en ninguna. Mensajes en español.

### `POST /integracion/panel/nombre-disponible` (panel) — [`IntegracionPanelController@nombreDisponible`](../Tenri-Backend/backend/app/Http/Controllers/IntegracionPanelController.php#L180)
- Cuerpo: `nombre` (obligatorio, 3–60; se compara ya recortado).
- Respuesta: `{"schema":1,"disponible":bool,"slug":"…"}`. No reserva el nombre.

### `PUT /integracion/panel/usuarios/password` (panel) — [`IntegracionPanelController@sincronizarPassword`](../Tenri-Backend/backend/app/Http/Controllers/IntegracionPanelController.php#L208)
- Cuerpo: `barberia_id` (int, obligatorio), `email` (obligatorio), `password_hash` (obligatorio, ≤ 255).
- Respuesta: `{"schema":1,"sincronizado":true|false}`, siempre `200`. `false` = no hay una cuenta no-superadmin con ese correo **y ese local seleccionado** (`users.barberia_id`; ver la nota de multi-local en [`INTEGRACION-PANEL.md`](INTEGRACION-PANEL.md)).

### `POST /login` (público) — [`AuthController@login`](../Tenri-Backend/backend/app/Http/Controllers/AuthController.php#L32)
- Respuesta: `{"access_token":"…","user":{…},"locales":[…]}`.
- Cada elemento de `locales`: `id`, `nombre`, `slug`, `logo_url`, `activa` (el local no está suspendido), `rol` (el rol en ese local) y `activo` (es el seleccionado). Un cliente sin locales recibe `[]`.

### `GET /sesion/locales` · `PUT /sesion/local` (autenticado) — [`AuthController@misLocales` / `seleccionarLocal`](../Tenri-Backend/backend/app/Http/Controllers/AuthController.php#L180)
- `GET` responde `{"locales":[…]}` con la misma forma que el login.
- `PUT` recibe `{"barberia_id":N}` (obligatorio, entero) y responde `{"user":{…},"locales":[…]}` con el usuario ya cambiado de local y de rol.
- `403 {"message":"No tienes acceso a ese local."}` o `403 {"message":"Ese local está suspendido."}`.

### `GET /mi-barberia/configuracion` (admin) — [`ConfiguracionTiendaController@estado`](../Tenri-Backend/backend/app/Http/Controllers/ConfiguracionTiendaController.php#L30)
- Respuesta: `{"barberia":{"id","nombre","slug"},"porcentaje":0..100,"pasos":[…],"tutorial_pendiente":bool}`.
- Cada paso: `clave` (`direccion` / `logo` / `personal` / `servicios`, en ese orden), `titulo`, `detalle`, `completo` y `destino` (`tienda` / `equipo` / `servicios`: una clave que el front traduce a su ruta, no una URL).

### `POST /lista-espera` (autenticado) — [`ListaEsperaController@store`](../Tenri-Backend/backend/app/Http/Controllers/ListaEsperaController.php#L24)
- Cuerpo: `barberia_id` (obligatorio, existe), `fecha` (obligatoria, hoy o después), `servicio_id` y `barbero_id` (opcionales, existen).
- Respuesta `201`: `{"mensaje":"Te avisamos apenas se libere una hora.","espera":{…}}` con `barberia`, `barbero` y `servicio` cargados.
- Si ya estaba anotado ese día en ese local, se actualiza su fila y vuelve a `esperando` (aunque ya lo hubieran avisado).

---

## ⚠️ Inconsistencias detectadas

> Solo reporte, no una lista de tareas: varias son decisiones deliberadas y se documentan para que nadie las "arregle" por error.

### 1. Endpoints definidos pero NO usados por el frontend activo
Método de detección: `apiFetch(` + `useApi(` + `ejecutar(` en `Tenri-Front/frontend/src/`, comparado contra `routes/api.php`.

| Endpoint | Línea | Situación |
|---|---|---|
| `POST /barberos` (`store`) | 116 | El frontend suma barberos con `POST /barberos/asignar` ([EquipoPage.jsx:90](../Tenri-Front/frontend/src/pages/admin/EquipoPage.jsx#L90)). `store` sigue existiendo para crear un barbero sin cuenta previa, pero ninguna pantalla lo invoca. |
| `PUT /barberos/{id}` | 119 | Registro duplicado de la línea 118: el frontend siempre usa la variante `POST` (multipart + `_method`). |
| `PUT /barberias/{id}` | 82 | Ídem: `EditarBarberiaModal.jsx` manda `POST` multipart. La variante JSON queda para clientes que no son el navegador. |
| `PUT /mi-barberia` | 100 | Ídem: `MiTiendaPage.jsx` usa `POST` multipart. |
| `GET /finanzas/hoy` | 95 | El código activo llama `GET /finanzas/resumen?periodo=hoy` ([AgendaPage.jsx:148](../Tenri-Front/frontend/src/pages/admin/AgendaPage.jsx#L148)). |

### 2. Naming inconsistente de URLs
- **Prefijo mixto para acciones sobre una cita del usuario:** `PATCH /mis-citas/{id}/cancelar` y `POST /mis-citas/{id}/calificar` viven bajo `/mis-citas`, mientras `PATCH /citas/{id}/reagendar` y `PATCH /citas/{id}/estado` van bajo `/citas`.
- **`reservas` vs `citas`:** `GET /mis-reservas` usa "reservas" y el resto del dominio "citas". Un solo concepto, dos nombres.
- **`suspender` vs `suspension`:** las rutas internas usan `/suspender` (verbo) y el canal del panel `/suspension` (sustantivo). Cambiar cualquiera de las dos rompe un consumidor ya desplegado.
- **`mi-lista-espera` vs `lista-espera`:** sigue el patrón de `mis-favoritos` / `barberias/{id}/favorito`: la lectura propia lleva el posesivo, la escritura no.
- **Sugerencia (no aplicar sin coordinar el frontend):** unificar bajo `/citas/...`.

### 3. Métodos de escritura con validación inline (sin FormRequest dedicado)
La convención del proyecto es validar en **FormRequest**. Siguen validando con `$request->validate()` dentro del controller:

| Método | Nota |
|---|---|
| `BarberoController@store` (116) | Sin FormRequest. |
| `ServicioController@update` (124) | `store` sí usa `StoreServicioRequest`; falta un `UpdateServicioRequest` análogo. |
| `BloqueoHorarioController@store` (129) | Sin FormRequest. |
| `CitaController@reagendar` (161) | `store` sí usa `StoreCitaRequest`. |
| `CitaController@updateEstado` (136) | — |
| `CitaController@calificar` (158) | — |
| `SuperAdminUsuarioController@toggleSuspendido` (88) | Toggle sin cuerpo: no hay nada que validar salvo el guard. |
| `AuthController@seleccionarLocal` (71) | Un solo campo (`barberia_id`); el permiso real lo decide `User::seleccionarLocal()`. |
| `ListaEsperaController@store` (146) | Sin FormRequest. |
| `IntegracionPanelController@usuarios` / `cambiarRolUsuario` / `crearBarberia` / `nombreDisponible` / `sincronizarPassword` (31, 32, 27, 28, 29) | Inline **a propósito**: el canal del panel no comparte los FormRequests del panel interno (no hay usuario autenticado del que colgar `authorize()`). `crearBarberia` replica a mano las reglas de `StoreBarberiaRequest`, salvo el `dns` del correo. |

`AsignarRolRequest` y `UpdateConfigBarberiaRequest` ya **no** son huérfanos: los usan `BarberoController@asignarRol` y `BarberiaController@updateConfig`.

### 4. Rol de las rutas "Cliente"
Las rutas de las líneas **141–161** están dentro de `auth:sanctum` pero **fuera de todo grupo `role:`**: cualquier usuario autenticado puede invocarlas, no solo `rol=cliente`.
- `reagendar`, `cancelarMiCita` y `calificar` validan la propiedad dentro del controller → riesgo acotado.
- `POST /citas` crearía la cita con `cliente_id = usuario_actual` (un admin reservando para sí mismo).
- Lo mismo vale para la lista de espera (`/lista-espera`, `/mi-lista-espera`): un admin o barbero puede anotarse. `destroy` valida que la fila sea suya.
- **Marcar como ⚠️ verificar** si se quiere acotar explícitamente a `rol=cliente`.

### 5. Verbos HTTP
- `POST /barberos/{id}`, `POST /barberias/{id}` y `POST /mi-barberia` deberían ser `PUT/PATCH` semánticamente. Se usan con `_method=PUT` porque **Laravel no parsea `multipart/form-data` en un PUT real**. Deliberado.
- El canal del panel usa `POST` para operaciones de solo lectura (`metricas`, `barberias`, `usuarios`, `nombre-disponible`): la firma HMAC cubre el cuerpo, así que los filtros tienen que viajar ahí. También deliberado.
- No hay `GET` con efectos secundarios.
