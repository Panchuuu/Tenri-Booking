# 🤝 Canal de integración con el panel de tenri.cl

> **Fuente de verdad del contrato.** Lo implementado en este repositorio manda:
> [`app/Support/HmacFirma.php`](../Tenri-Backend/backend/app/Support/HmacFirma.php),
> [`app/Http/Middleware/VerificarFirmaPanel.php`](../Tenri-Backend/backend/app/Http/Middleware/VerificarFirmaPanel.php) y
> [`app/Http/Controllers/IntegracionPanelController.php`](../Tenri-Backend/backend/app/Http/Controllers/IntegracionPanelController.php).
> El documento `Tenri-Admin/docs/INTEGRACION-BOOKING.md` describe un contrato **anterior** que no se implementó — ver [Diferencias](#-diferencias-con-el-doc-viejo-del-panel).

## Arquitectura

```
Tenri-Admin (React)  →  Tenri-Web-Page (Laravel)  →  Tenri-Booking (Laravel)
   admin.tenri.cl         api.tenri.cl/api            booking.tenri.cl/api
   panel                  puente + sondeo             este repositorio
```

El navegador **nunca** habla directo con booking: la CSP del panel solo permite `connect-src` hacia `api.tenri.cl`, y la sesión y los permisos (`view_booking` / `manage_booking`) viven en el backend del panel. Booking no conoce a los usuarios del panel: para él, quien llama es un servicio que sabe firmar.

## La clave compartida

| Repositorio | Variable de entorno | Dónde se lee |
|---|---|---|
| Tenri-Booking (este) | `PANEL_INTEGRATION_KEY` | `config/services.php` → `services.panel.integration_key` |
| Tenri-Web-Page | `BOOKING_PANEL_KEY` | el cliente HTTP que firma las llamadas |

Misma cadena en las dos. Generarla con:

```bash
php artisan tinker --execute="echo bin2hex(random_bytes(32));"
```

Después de escribirla en el `.env` de producción (`~/domains/booking.tenri.cl/booking_backend/.env`), correr `php artisan config:clear`. **El deploy no toca el `.env`**: esto se hace a mano una vez.

Sin clave configurada el canal **falla cerrado**: todo `/api/integracion/panel/*` responde `401`, con el mismo cuerpo que una firma inválida (`{"message":"No autorizado."}`) para no revelar cuál de las dos cosas pasó.

## La firma

Tres headers en cada request:

| Header | Contenido |
|---|---|
| `X-Timestamp` | epoch en segundos, como string de dígitos |
| `X-Nonce` | 32 hex (`bin2hex(random_bytes(16))`), irrepetible |
| `X-Signature` | `hash_hmac('sha256', $mensaje, $clave)` en hex |

El mensaje firmado:

```
MÉTODO /ruta.timestamp.nonce.sha256(cuerpo)
```

Concretamente, `strtoupper($metodo).' '.$ruta.'.'.$timestamp.'.'.$nonce.'.'.hash('sha256', $cuerpo)`, donde:

- **`$metodo`** es el verbo HTTP en mayúsculas (`POST`, `PUT`).
- **`$ruta`** es la ruta **completa con el prefijo `/api`**, tal como viaja en la URL: `/api/integracion/panel/metricas`. Este lado la recompone como `'/'.ltrim($request->path(), '/')`; si el emisor firma sin el `/api`, la firma no calza y responde `401`.
- **`$cuerpo`** es el cuerpo crudo, byte por byte, el mismo que se manda. Si el cliente HTTP reserializa el JSON después de firmar (cambia el orden de claves, el escape de unicode o los espacios), el hash cambia y la firma no calza. Firmar el string exacto que se envía.
- Un `GET` sin cuerpo firmaría `hash('sha256', '')` — pero este canal no tiene `GET`, justamente para que la intención viaje en el cuerpo firmado.

Reglas de validación, en orden ([`HmacFirma::verificaConRuta`](../Tenri-Backend/backend/app/Support/HmacFirma.php)):

1. Los tres headers presentes y `X-Timestamp` numérico.
2. `|ahora - timestamp| ≤ 300` segundos (`VENTANA_SEGUNDOS`): tolera desfase de reloj y acota el replay.
3. Firma igual en tiempo constante (`hash_equals`).
4. **Nonce de un solo uso**: se guarda en caché por 300 s; el segundo intento con el mismo nonce se rechaza. Reintentar una llamada implica firmar de nuevo con nonce nuevo.

Booking verifica con `aceptarSinRuta: false`: la variante vieja de la firma (sin método ni ruta) **no** se acepta acá, porque este canal nació después de ese parche.

### El vector compartido

[`tests/Unit/HmacFirmaTest.php`](../Tenri-Backend/backend/tests/Unit/HmacFirmaTest.php) fija una tupla (secreto, timestamp, nonce, cuerpo → firma esperada) y **el mismo test tiene que existir en Tenri-Web-Page**. Es lo que hace ruidosa una desviación entre las dos copias del algoritmo: truena la suite en vez de que producción empiece a responder `401` en silencio.

```
secreto   vector-de-prueba-compartido
timestamp 1750000000
nonce     0123456789abcdef0123456789abcdef
cuerpo    {"schema":1,"op":"metrics"}
método    POST
ruta      /api/integracion/panel/metricas

firma (con ruta)  c11ae3f67a014e92072948c1c8c876bc2e746b0c140875b36b7c7e12e27881b1
firma (sin ruta)  659e167a3521f46123bfe63970b1adffb134b71932fbadcab65bc604c2de2fde
```

Si ese test falla, no actualizar el valor esperado: significa que las dos implementaciones dejaron de coincidir.

### Cómo firma el emisor (lado Tenri-Web-Page)

Con el helper espejo ya presente en ese repositorio (los nombres de `config()` son los de allá; lo que manda son la ruta, el cuerpo y los headers):

```php
$respuesta = Http::baseUrl(config('services.booking.base_url'))
    ->timeout(config('services.booking.timeout', 8))
    ->withRequestMiddleware(fn ($request) => HmacFirma::firmarPsrConRuta($request, config('services.booking.panel_key')))
    ->post('/api/integracion/panel/metricas', ['schema' => 1]);
```

`firmarPsrConRuta()` firma sobre el cuerpo ya serializado y toma el método y `getUri()->getPath()` de la request saliente — por eso la ruta incluye `/api` sin que haya que armarla a mano.

Para probar a mano desde el servidor:

```bash
CLAVE='...'; CUERPO='{"schema":1}'; RUTA='/api/integracion/panel/metricas'
TS=$(date +%s); NONCE=$(openssl rand -hex 16)
HASH=$(printf '%s' "$CUERPO" | openssl dgst -sha256 -hex | awk '{print $2}')
FIRMA=$(printf 'POST %s.%s.%s.%s' "$RUTA" "$TS" "$NONCE" "$HASH" \
  | openssl dgst -sha256 -hmac "$CLAVE" -hex | awk '{print $2}')
curl -s -X POST "https://booking.tenri.cl$RUTA" \
  -H 'Content-Type: application/json' \
  -H "X-Timestamp: $TS" -H "X-Nonce: $NONCE" -H "X-Signature: $FIRMA" \
  --data "$CUERPO"
```

## Endpoints

Todos bajo `firma.panel` + `throttle:60,1` (el sondeo pega cada pocos minutos y la gestión es esporádica). Todas las respuestas traen `schema` (hoy **1**): si la forma del payload cambia de manera incompatible, sube el número y el panel viejo lo detecta en vez de leer mal.

### `POST /api/integracion/panel/metricas`

Cuerpo: `{}` (o `{"schema":1}`, se ignora). Respuesta:

```jsonc
{
  "schema": 1,
  "generated_at": "2026-09-10T12:00:00-03:00",
  "app":     { "version": null },
  "users":   { "total": 0, "clientes": 0, "barberos": 0, "admins": 0, "suspendidos": 0, "nuevos_30d": 0 },
  "content": { "barberias": 0, "barberias_activas": 0, "servicios": 0, "citas": 0, "citas_30d": 0, "citas_hoy": 0 },
  "ratings": { "promedio": null, "total": 0 }   // null = sin reseñas aún, no 0.0
}
```

- `users.barberos` usa el scope `User::barberos()`: cuenta también a los admins con `es_barbero` (rol dual), no solo `rol='barbero'`.
- `content.citas_30d` y `citas_hoy` **excluyen canceladas**: una agenda que se llenó y se vació no es actividad del negocio.

### `POST /api/integracion/panel/barberias`

Cuerpo: `{}`. Respuesta: `{"schema":1,"barberias":[...]}`, ordenadas por nombre, **todas** (activas y suspendidas). Cada barbería trae sus campos más los accessors `logo_url`, `rubro_nombre`, `activa` y los conteos:

```jsonc
{
  "id": 1, "nombre": "…", "slug": "…", "rubro": "barberia", "rubro_nombre": "Barbería",
  "color_principal": "#0EA5E9", "activa": true, "logo_url": "https://…",
  "usuarios_count": 12, "barberos_count": 4, "citas_count": 340, "citas_30d": 51,
  "total_resenas": 87, "calificacion_promedio": 4.6, "created_at": "…"
}
```

`activa` es derivado (`estado_suscripcion !== 'suspendida'`), no una columna: no se escribe directo, se cambia con el endpoint siguiente.

`barberos_count` cuenta a quienes atienden **en ese local** (`Barberia::quienesAtienden()`: rol `barbero` o `es_barbero` en la fila de `barberia_usuario`). Antes se contaba por persona, y un dueño que atendía en uno de sus locales sumaba en todos.

### `POST /api/integracion/panel/crear-barberia`

Da de alta una tienda con su administrador. Lo dispara una compra de Booking en tenri.cl: cuando llega esta llamada, el panel **ya cobró**. Por eso todo lo que está en este camino evita fallar por motivos ajenos a los datos (ver la nota del correo, más abajo).

Cuerpo:

```jsonc
{
  "nombre_barberia": "Barbería Central",   // obligatorio, 3–60, único en barberias.nombre
  "color_principal": "#0EA5E9",            // obligatorio, máx. 20
  "admin_nombre": "Ana Pérez",             // obligatorio, 2–80
  "admin_email": "ana@correo.cl",          // obligatorio, email:rfc,filter, máx. 120
  "admin_password_hash": "$2y$12$…",       // una de las dos: el hash bcrypt de la cuenta de tenri.cl…
  "admin_password": "…",                   // …o una contraseña en claro (mín. 8), nunca las dos
  "plan": "basico"                         // opcional, máx. 40
}
```

Respuesta `201`:

```jsonc
{ "schema": 1, "barberia": { … }, "admin_creado": true }
```

Lo que hay que saber del contrato:

- **La contraseña llega de una de dos formas, y solo una.** La compra en tenri.cl manda `admin_password_hash`: el mismo hash bcrypt de la cuenta del comprador, para que entre a booking con las mismas credenciales que ya usa allá. El alta manual manda `admin_password` en claro. Mandar las dos es `422` (`missing_with`), mandar ninguna también (`required_without`). El cast `hashed` del modelo `User` distingue una forma de la otra por sí solo; eso exige que los dos lados usen el **mismo algoritmo y costo de bcrypt**, igual que el puente ERP.
- **Si el correo ya tiene cuenta, el local se le suma.** No se crea un usuario nuevo ni se falla por correo duplicado: la tienda queda en `barberia_usuario` con rol `admin` y la persona la ve en su selector de locales. En ese caso **no se le toca la contraseña** (es la que ya usa para sus otros locales, aunque venga un hash en el cuerpo) y la respuesta trae `admin_creado: false`. Quien manda el correo de bienvenida lee ese campo: con `false` no corresponde mandarle una clave nueva, sino recordarle que entra con la suya. Si esa cuenta no tenía ningún local seleccionado (un cliente, por ejemplo), este pasa a ser el activo y su rol pasa a `admin`.
- **El correo de un superadmin se rechaza** (`422` en `admin_email`): la cuenta de plataforma no es de nadie en particular y no puede ser dueña de un local.
- **El correo no se valida contra DNS** (`email:rfc,filter`, sin `dns`), a diferencia del alta manual del superadmin. Acá nadie lo está tipeando: viene de una cuenta de tenri.cl ya validada. Una consulta DNS lenta o caída dejaría a un cliente pagado y sin tienda.
- **El slug se calcula acá** (`Barberia::slugDisponible()`): el `unique` de `nombre` no alcanza, porque "Barbería VIP" y "Barberia-VIP" colapsan al mismo slug. Si choca se le agrega `-2`, `-3`, etc.
- **Una sola operación, dos puertas.** La creación vive en `Barberia::crearConAdmin()`, que usa también `BarberiaController::store` (el alta manual del superadmin). Todo corre en una transacción: si el usuario no se puede crear, la tienda no queda creada y sin dueño.
- **Los mensajes de validación están en español y dicen qué hacer** ("Ese nombre de tienda ya está tomado por otro local. Hay que elegir otro."). No se quedan en este lado: viajan al panel, donde los lee quien tiene que resolver una compra cobrada sin tienda, y pueden terminar frente al comprador.

`plan` no está en el `$fillable` de `Barberia` a propósito (mismo motivo que `estado_suscripcion`): se asigna aparte con `forceFill`.

### `POST /api/integracion/panel/nombre-disponible`

Cuerpo: `{"nombre":"Barbería Central"}` (obligatorio, 3–60). Respuesta:

```jsonc
{ "schema": 1, "disponible": true, "slug": "barberia-central" }
```

Lo consulta el checkout de tenri.cl mientras el comprador escribe: el nombre de la tienda se pide **antes** de pagar, así que el formulario tiene que poder decir la verdad en ese momento y no después del cobro. `slug` es la dirección pública con la que quedaría (ya con el sufijo `-2` si hace falta).

**No es una reserva.** Entre esta consulta y el alta pasa el pago entero (minutos con tarjeta, días con transferencia) y en el medio otro puede tomar el nombre. Quien provisiona tiene que seguir tratando el `422` de `crear-barberia` como un caso posible.

### `PUT /api/integracion/panel/usuarios/password`

Le copia a un admin el hash de la contraseña que acaba de poner en tenri.cl. Su cuenta de acá se creó con el hash de la de allá: si cambia una y no la otra, la promesa de "entras con las mismas credenciales" se rompe en silencio hasta el próximo login.

Cuerpo:

```jsonc
{ "barberia_id": 12, "email": "ana@correo.cl", "password_hash": "$2y$12$…" }
```

Respuesta: `{"schema":1,"sincronizado":true}`, o `{"schema":1,"sincronizado":false}` si no encontró la cuenta. Lo segundo **no es un error** (`200` igual): la cuenta pudo cambiar de correo o de local, y el puente lo registra y sigue.

- Se identifica por local **y** correo, no solo por correo: así una sincronización no puede tocar una cuenta que no sea la de esa tienda.
- Un superadmin no se sincroniza nunca: su acceso no depende de tenri.cl.
- **Ojo con el multi-local:** hoy la búsqueda compara contra `users.barberia_id`, que es el local que la persona tiene **seleccionado**, no contra `barberia_usuario`. Si alguien con varios locales está parado en otro distinto del que manda el panel, la respuesta es `sincronizado: false` y la contraseña no se copia. El puente debería tratar ese `false` como algo que mirar, no solo como ruido.

### Multi-local, visto desde el alta

Hasta estos cambios `users.barberia_id` decía dos cosas a la vez: a qué local pertenece alguien y cuál está administrando. Ahora eso se reparte:

- **`barberia_usuario`** dice a qué locales tiene acceso cada persona, con qué rol en cada uno (`admin` o `barbero`) y si atiende ahí (`es_barbero`).
- **`users.barberia_id`** pasa a ser el local que tiene seleccionado ahora. Todas las consultas que ya existían (agenda, servicios, personal) siguen preguntando por él, y por eso no hubo que tocarlas.

Para el panel de tenri.cl esto significa que **una misma cuenta puede comprar varias tiendas**: cada `crear-barberia` con el mismo correo le suma un local, y al entrar a booking elige con cuál trabajar. El listado de `POST /usuarios` sigue mostrando `barberia_id` y `barberia`, que son los del local seleccionado en ese momento, no la lista completa.

Una consecuencia a tener presente con `PUT /usuarios/{id}/rol`: cambia `users.rol`, pero no el rol guardado en `barberia_usuario`. Como al cambiar de local (o al entrar con el local activo suspendido) la persona adopta el rol que tiene en ese local, el cambio hecho desde el panel puede no sobrevivir a un cambio de local.

El detalle completo del modelo multi-local, desde el lado de booking, está en [`FUNCIONES-2026-09.md`](FUNCIONES-2026-09.md).

### `PUT /api/integracion/panel/barberias/{id}/suspension`

Cuerpo: `{}`. **Toggle**, no un set: invierte el estado actual y devuelve `{"schema":1,"barberia":{…}}` con el resultado en `barberia.activa`. Leer ese campo en vez de asumir el efecto.

Suspender no borra nada y es reversible: la barbería sale del listado público (`GET /barberias` y `/barberias/{slug}` → `404`), deja de aceptar reservas (`POST /citas` → `403`), sus admins y barberos no pueden entrar (el superadmin queda exento y los clientes no tienen barbería propia, así que no se ven afectados) y los tokens Sanctum de sus usuarios quedan revocados. Reactivar devuelve todo.

> El `DELETE` de barberías **no** se expone por este canal: arrastra usuarios y citas en cascada. La suspensión es la vía reversible y es la única que el panel necesita.

### `POST /api/integracion/panel/usuarios`

Cuerpo (todo opcional): `{"page":1,"buscar":"texto","rol":"cliente|barbero|admin|superadmin"}`. `buscar` va contra `name` o `email` (`like`), máximo 120 caracteres.

Respuesta: `{"schema":1,"usuarios":{…}}` con el **paginador Laravel completo** (15 por página, orden `created_at desc`): `data[]`, `current_page`, `last_page`, `total`, etc. Cada usuario trae `id`, `name`, `email`, `rol`, `suspendido`, `barberia_id`, `avatar`, `avatar_url`, `created_at` y `barberia: {id, nombre}`.

Los filtros van en el **cuerpo** y no en el query string a propósito: la firma cubre el cuerpo, la query quedaría fuera de ella.

### `PUT /api/integracion/panel/usuarios/{id}/rol`

Cuerpo: `{"rol":"admin"}` — obligatorio, uno de los cuatro roles (`422` si no). Devuelve `{"schema":1,"usuario":{…}}`. Las citas y la `barberia_id` del usuario quedan como están.

### `PUT /api/integracion/panel/usuarios/{id}/suspension`

Cuerpo: `{}`. **Toggle**. Al suspender se revocan sus tokens Sanctum (la sesión viva se corta). Devuelve `{"schema":1,"usuario":{…}}`; leer `usuario.suspendido`.

### Salud: `GET /api/health` (público, sin firma)

```
200 {"status":"ok"}         sano
503 {"status":"degraded"}   algo falla (base, caché, cola o storage)
```

Mismo contrato que api.tenri.cl y el ERP, para que la página de estado sondee a todos igual. El detalle de `checks` solo sale en entorno `local`: es un endpoint abierto y los nombres de los subsistemas caídos son un mapa útil para quien mire. Un `503` **con** cuerpo JSON es "la aplicación respondió y está degradada"; sin cuerpo, habló el hosting.

**Quién sondea qué** (verificado en Tenri-Web-Page el 2026-09-10):

- La **página de estado** de tenri.cl pega a este `/api/health` (`ServicioMonitoreado` slug `booking`, `url_sonda`).
- El **panel** no lo usa: su comando `booking:probe` (scheduler, cada 5 minutos) hace la llamada firmada a `metricas` y de ahí saca la muestra de salud (`ok` + `latency_ms`) y el snapshot del día. Es decir, el uptime que muestra el panel mide el canal firmado completo, no solo que el servicio esté arriba — un 401 por clave mal puesta se ve ahí como "no alcanzable".

## Códigos de respuesta

| Código | Qué pasó |
|---|---|
| `200` | OK |
| `201` | Solo en `crear-barberia`: la tienda quedó creada (leer `admin_creado`) |
| `401` | Sin firma, firma inválida, timestamp fuera de ventana, nonce reusado, o `PANEL_INTEGRATION_KEY` sin configurar. Cuerpo siempre `{"message":"No autorizado."}` |
| `404` | El `{id}` no existe |
| `422` | Validación: un `rol` que no existe, un nombre de tienda tomado, un correo de superadmin en el alta, la contraseña en las dos formas o en ninguna. Los mensajes del alta van en español porque pueden llegar al comprador |
| `429` | Pasó el `throttle:60,1` |
| `503` | Solo en `/api/health`: servicio degradado |

## Guards que este canal no hereda

`SuperAdminUsuarioController` protege contra auto-modificación comparando con `$request->user()`. Acá no hay usuario autenticado — no hay un "yo" que proteger — así que ese guard no aplica. El resto de las invariantes sí se conserva: se revocan tokens al suspender, los roles se validan contra la lista real, y el borrado destructivo no se expone.

## 🔀 Diferencias con el doc viejo del panel

`Tenri-Admin/docs/INTEGRACION-BOOKING.md` se escribió antes de implementar y describe un contrato de clave simple que **no** es el que quedó. Si el puente de Tenri-Web-Page siguió ese doc, el canal responde `401` aunque la clave esté bien puesta:

| Doc viejo | Implementado |
|---|---|
| Header `X-Integration-Key` con la clave en claro | `X-Timestamp` + `X-Nonce` + `X-Signature` (HMAC sobre método, ruta, cuerpo) |
| `ADMIN_INTEGRATION_KEY` en booking | `PANEL_INTEGRATION_KEY` |
| `BOOKING_INTEGRATION_KEY` en Tenri-Web-Page | `BOOKING_PANEL_KEY` |
| `GET /api/integracion/ping` | `GET /api/health` (público, contrato compartido) |
| `GET /api/integracion/metricas` | `POST /api/integracion/panel/metricas` |
| `GET /api/integracion/barberias` | `POST /api/integracion/panel/barberias` |
| `PATCH /api/integracion/barberias/{id}/suspender` | `PUT /api/integracion/panel/barberias/{id}/suspension` |
| `GET /api/integracion/usuarios?page=&buscar=&rol=` | `POST /api/integracion/panel/usuarios` (filtros en el cuerpo) |
| `PATCH /api/integracion/usuarios/{id}/rol` | `PUT /api/integracion/panel/usuarios/{id}/rol` |
| `PATCH /api/integracion/usuarios/{id}/suspender` | `PUT /api/integracion/panel/usuarios/{id}/suspension` |
| Respuestas envueltas en `data` (estilo ERP) | Respuestas planas con `schema` + la clave del recurso (`metricas` es la excepción: sus bloques van al nivel raíz) |

El pendiente de suspensión de barberías que ese doc listaba (exponer `activa`, filtrar el listado público, rechazar reservas y login) **ya está hecho** en `Barberia::activas()` / `alternarSuspension()`.

## ✅ Checklist de producción

| # | Dónde | Acción | Estado |
|---|---|---|---|
| 1 | `.env` de booking | `PANEL_INTEGRATION_KEY=<clave>` + `php artisan config:clear` | ✅ 2026-09-10 |
| 2 | `.env` de Tenri-Web-Page (`~/tenri_backend/.env`) | `BOOKING_BASE_URL=https://booking.tenri.cl` (sin `/api` ni barra final) + `BOOKING_PANEL_KEY=<la misma clave>`. Ese deploy cachea la config: hace falta `config:clear` **y** `config:cache` | ✅ 2026-09-10 |
| 3 | Tenri-Web-Page | Puente firmando con `firmarPsrConRuta()` contra las rutas de este doc | ✅ `BookingClient` |
| 4 | Tenri-Web-Page | Vector de `HmacFirmaTest` en su suite, con los mismos valores que acá | ✅ verificado |
| 5 | Tenri-Web-Page | Sondeo (`booking:probe`, cada 5 min) + snapshot del día | ✅ en `routes/console.php` |
| 6 | Panel | Otorgar `view_booking` / `manage_booking` a los roles que corresponda | ✅ 2026-09-10 |
| 7 | Verificación | `php artisan booking:probe` en el servidor del panel responde con la latencia y el snapshot del día | ✅ 2026-09-10 |

**El canal está vivo en producción desde el 2026-09-10.** Para diagnosticar más adelante, `booking:probe` en `~/tenri_backend` es la prueba end-to-end más corta: mide el canal firmado completo y su mensaje de error ya distingue clave mal puesta (`firma_rechazada`) de servicio caído (`sin_conexion`).

El emisor quedó revisado contra este contrato el 2026-09-10: rutas, verbos, filtros en el cuerpo, `schema` verificado en las lecturas y no en los toggles, cero reintentos (el nonce de un solo uso haría fallar el segundo intento). No queda nada por ajustar del lado del puente.

**Alta de tiendas (2026-09-22).** `crear-barberia`, `nombre-disponible` y `usuarios/password` se agregaron después de esa revisión y a esta fecha están en el working tree de este repositorio, sin desplegar. Antes de darlos por vivos hay que confirmar del lado de Tenri-Web-Page que el puente los firma con las mismas reglas de arriba, que lee `admin_creado` para decidir el correo de bienvenida, y que trata el `422` del alta como un caso posible aunque `nombre-disponible` haya dicho que el nombre estaba libre.
