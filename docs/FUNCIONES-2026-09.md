# Funciones de septiembre 2026

> **Versión:** Tenri Booking v1.0.0. Es la primera versión con número en este repositorio: lo anterior no tiene etiqueta, y lo que se describe acá es lo que la inaugura.
> **Estado al 2026-09-22:** en el working tree de `main`, sin commitear ni desplegar.
> **Para quién:** alguien que llega nuevo al código y necesita entender qué cambió, dónde vive y por qué se hizo así.
> **Relacionado:** [`API_ENDPOINTS.md`](API_ENDPOINTS.md) (las rutas una por una) y [`INTEGRACION-PANEL.md`](INTEGRACION-PANEL.md) (el canal firmado con tenri.cl).

Esta tanda resuelve un solo problema visto desde varios lados: que una tienda comprada en tenri.cl llegue a recibir reservas, y que las reservas que se pierden se pierdan menos. Son seis piezas:

1. [Multi-local](#1-multi-local): una persona puede tener varios locales y elige con cuál trabajar.
2. [Alta desde tenri.cl y registro](#2-alta-desde-tenricl-y-registro): las tiendas nacen al comprar, y el registro público queda para clientes.
3. [Puesta en marcha](#3-puesta-en-marcha): qué le falta a un local nuevo para recibir su primera reserva.
4. [Lista de espera](#4-lista-de-espera): quien no encontró hora queda anotado y se le avisa si se libera una.
5. [WhatsApp](#5-whatsapp): el recordatorio y el aviso de cupo salen por donde de verdad se leen.
6. [Arreglos de front](#6-arreglos-de-front): el logo con inicial y el campo numérico de duración.

Al final están las [variables de entorno nuevas](#7-variables-de-entorno), las [migraciones](#8-migraciones) y una lista de [cosas a tener presente](#9-cosas-a-tener-presente) que el código hace hoy y que conviene saber antes de tocarlo.

---

## 1. Multi-local

### El problema

Hasta ahora `users.barberia_id` decía dos cosas a la vez: a qué local pertenece una persona y cuál está administrando. Mientras cada persona tuviera un solo local eso alcanzaba. Dejó de alcanzar cuando un dueño puede comprar un segundo local, o ser dueño de uno y atender como barbero en el de un socio.

### Cómo quedó

El reparto es:

- **`barberia_usuario`** (tabla nueva) dice a qué locales tiene acceso cada persona. Una fila por par local-persona, con dos datos que dependen del local: `rol` (`admin` o `barbero`) y `es_barbero` (si atiende ahí). Índice único en `(barberia_id, user_id)`.
- **`users.barberia_id`** pasa a significar el local que la persona tiene **seleccionado ahora**.
- **`users.rol`** es el rol que tiene en ese local seleccionado. Cambia cuando cambia de local.
- **`users.es_barbero`** se conserva, pero ya no es la verdad: es un reflejo de lo que dice `barberia_usuario` para el local activo. Lo sigue leyendo el panel para mostrar el rol dual.

Se eligió separar y no reemplazar la columna porque todas las consultas que ya existían (la agenda del local, sus servicios, su personal, los `role:` de las rutas) preguntan por el local activo, que es justo lo que `barberia_id` sigue significando. Así no hubo que tocarlas.

### Las piezas en `User`

- **`barberiasAdministradas()`**: la relación `belongsToMany` con `barberia_usuario`, con `rol` y `es_barbero` en el pivot. Es "todos mis locales".
- **`darAccesoA($barberia, $rol, $atiende)`**: crea o actualiza la fila de acceso. Si la persona no tenía ningún local seleccionado, este pasa a ser el activo: quien recibe su primer local no debería tener que elegirlo.
- **`seleccionarLocal($id)`**: deja ese local como activo y **adopta el rol que tiene ahí**, junto con su `es_barbero`. Devuelve `false` si no tiene acceso. El rol viaja con el local a propósito: la misma persona puede administrar el suyo y ser barbera en otro, y lo que puede hacer depende de dónde está parada.
- **`atenderEn($id, $bool)`** y **`atiendeEn($id)`**: marcan y consultan si atiende en un local puntual. Es por local porque antes, con una sola casilla por persona, un dueño que cortaba el pelo en su local A aparecía también en el equipo de su local B.
- **`refrescarEsBarbero()`**: deja `users.es_barbero` igual a lo que dice el pivot del local activo. Es el único que escribe esa columna, para que no se convierta en una segunda versión de los hechos.
- **`asegurarAccesoAlLocalActivo()`**: si `barberia_id` apunta a un local que no figura en `barberia_usuario`, crea la fila. Existe porque antes de esta tabla pertenecer a un local era solo la columna, y varios caminos la siguen escribiendo directo (contratar, seeders, factories). En vez de recordar agregar el acceso en cada uno, se agrega solo: el modelo lo llama en `created` y en `updated` cuando cambia `barberia_id`, y el login lo llama también para las cuentas anteriores a la tabla. Nunca pisa una fila existente, porque esa fila sabe cosas que la columna no.
- **`puedeAdministrar($id)`**: si tiene acceso a ese local; el superadmin entra a todos.
- **`esBarberoActivo()`** ahora pregunta `atiendeEn()` del local activo en vez de mirar `rol` y `es_barbero` sueltos.

En `Barberia`, **`equipo()`** es la relación inversa y **`quienesAtienden()`** filtra a quien tiene rol `barbero` o `es_barbero` en ese local. Es lo que usan `GET /mi-equipo`, `GET /barberos?barberia=slug` y el `barberos_count` del canal del panel.

### La sesión

- **`POST /login`** devuelve, además del token y el usuario, `locales[]`: cada local con `id`, `nombre`, `slug`, `logo_url`, `activa`, `rol` (el de ese local) y `activo`. Si el local seleccionado quedó suspendido pero la persona tiene otro activo, el login la cambia a ese en vez de dejarla afuera: sus otros locales no tienen la culpa. Si no le queda ninguno activo, `403` como antes.
- **`GET /api/sesion/locales`** devuelve la misma lista. Existe porque una recarga del panel no vuelve a pasar por el login, y sin esto el selector desaparecería hasta el próximo ingreso.
- **`PUT /api/sesion/local`** con `{"barberia_id": N}` cambia el local activo. `403` si no tiene acceso o si ese local está suspendido.

### El equipo, por local

`BarberoController` dejó de comparar `barberia_id` entre personas para decidir si alguien es "de mi equipo". Ahora pregunta si esa persona tiene acceso al local activo de quien administra: con varios locales, un barbero de este equipo puede estar mirando otro de los suyos en ese momento. Al sacar a alguien del equipo (`DELETE /barberos/{id}`), un barbero pierde solo el acceso a este local; si trabaja en otro, queda seleccionado ese, y solo si no le queda ninguno se degrada a `cliente`. Al dueño con rol dual se le apaga `es_barbero` en este local y conserva todo lo demás.

### El front

`AuthContext.jsx` guarda `locales` en `localStorage` (clave `locales`), igual que el usuario, para que el selector no parpadee al recargar. Expone `locales`, `localActivo`, `tieneVariosLocales` y `cambiarLocal(id)`. Al revalidar la sesión, si el rol es `admin` o `barbero`, pide `GET /sesion/locales`.

`SelectorDeLocal.jsx` vive en la barra lateral de `AdminLayout.jsx`. Con un solo local no muestra ningún control (un menú de una opción es ruido). Al cambiar de local recarga la página: todo el panel muestra el local seleccionado, así que cambiarlo es cambiar de local, no de vista.

---

## 2. Alta desde tenri.cl y registro

### Las tiendas nacen al comprar

Quien quiere recibir reservas compra Booking en tenri.cl, y el panel de allá llama a `POST /api/integracion/panel/crear-barberia` por el canal firmado. La creación en sí vive en **`Barberia::crearConAdmin()`**, que usa también el alta manual del superadmin (`BarberiaController::store`): es la misma operación con dos puertas de entrada, y tenerla en un solo lugar evita dos copias que se desalinean. Corre en una transacción, porque una tienda sin nadie que pueda administrarla no sirve.

Los detalles del contrato están en [`INTEGRACION-PANEL.md`](INTEGRACION-PANEL.md). Lo esencial para entender el código:

- La contraseña llega en claro (`admin_password`, alta manual) o como el hash bcrypt de la cuenta de tenri.cl (`admin_password_hash`, compra). Con el hash, la persona entra a booking con las mismas credenciales que usa allá. El cast `hashed` de `User` distingue una forma de otra solo, lo que exige el mismo algoritmo y costo de bcrypt en los dos repositorios.
- **Si el correo ya tiene cuenta, el local se le suma** en vez de fallar. No se le cambia la contraseña y la respuesta dice `admin_creado: false`, para que quien manda el correo de bienvenida sepa que no corresponde mandarle una clave nueva. Así es como una misma persona llega a tener varios locales.
- El correo de un superadmin se rechaza: la cuenta de plataforma no es dueña de nada.
- El slug se calcula con **`Barberia::slugDisponible()`**, que agrega `-2`, `-3`, etc. si choca. El `unique` del nombre no basta, porque dos nombres distintos pueden dar el mismo slug.

Dos endpoints más acompañan al alta: **`nombre-disponible`**, que el checkout consulta mientras el comprador escribe (el nombre se pide antes de pagar), y **`usuarios/password`**, que copia el hash cuando el admin cambia su contraseña en tenri.cl, para que la promesa de "mismas credenciales" no se rompa en silencio.

### El registro público es para clientes

`POST /api/register` siempre creó cuentas `cliente`, y sigue igual. Lo que cambió es el front: el modal de `Login.jsx` en modo registro ahora dice "Para reservar tus horas" y agrega un enlace, "¿Tienes un local y quieres recibir reservas? Tu tienda se crea en tenri.cl", que apunta a `${VITE_TENRI_URL}/catalogo`. Sin ese cartel, un dueño se creaba una cuenta de cliente, no encontraba su local por ningún lado y terminaba escribiendo a soporte.

---

## 3. Puesta en marcha

### El problema

Quien compra Booking llega a un panel vacío: la tienda tiene nombre y poco más. Sin dirección no aparece en las búsquedas cercanas, sin alguien que atienda no hay agenda, y sin servicios no hay qué reservar.

### Cómo quedó

**`Barberia::pasosDeConfiguracion()`** calcula cuatro pasos, en el orden en que conviene hacerlos (primero existir en el mapa, después quién atiende, después qué se ofrece):

| Clave | Se da por completo cuando | Destino |
|---|---|---|
| `direccion` | hay `direccion` **y** `latitud` **y** `longitud` | `tienda` |
| `logo` | hay `logo` | `tienda` |
| `personal` | `quienesAtienden()` no está vacío (puede ser el mismo dueño) | `equipo` |
| `servicios` | el local tiene al menos un servicio | `servicios` |

`destino` es una clave y no una ruta: quien la traduce a URL es el front, que es el que sabe cómo se llaman sus pantallas. **`avanceDeConfiguracion()`** devuelve el porcentaje de pasos completos.

`ConfiguracionTiendaController` expone dos rutas bajo `role:admin`:

- **`GET /api/mi-barberia/configuracion`**: `porcentaje`, `pasos` y `tutorial_pendiente` del local activo.
- **`POST /api/mi-barberia/configuracion/tutorial`**: marca el tutorial como resuelto llenando `barberias.onboarding_resuelto_en`.

Hay dos cosas distintas que se responden por separado a propósito:

- **La configuración** está completa cuando los cuatro pasos lo están.
- **El tutorial** está resuelto cuando se le ofreció a esta persona y lo siguió o lo saltó. No se distingue entre seguirlo y saltarlo, porque lo que importa es no volver a ofrecerlo en cada ingreso.

`onboarding_resuelto_en` vive en la barbería y no en el usuario porque lo que se configura es el local: si mañana entra un socio, el tutorial ya no tiene nada que pedirle. La migración lo llena con `now()` para todos los locales existentes: los que ya están andando no tienen por qué recibir un tutorial de primeros pasos.

### El front

`PuestaEnMarcha.jsx` se monta arriba del `<Outlet />` de `AdminLayout.jsx`, así que aparece en todas las pantallas del panel, solo para admins. Tiene dos piezas:

- **La barra de avance** ("Tu tienda está al 50%") se muestra mientras quede algún paso pendiente. Es un recordatorio, no un trámite: se puede ignorar.
- **El ofrecimiento del tutorial** aparece una sola vez, cuando `tutorial_pendiente` es `true`. "Empezar" marca el tutorial como resuelto y lleva al primer paso pendiente; saltarlo también lo marca. Saltarlo no esconde nada: la barra sigue arriba hasta que todo esté listo.

Para que la barra se mueva apenas se guarda algo (y no recién al cambiar de pantalla), `utils/api.js` emite el evento `tenri:datos-cambiaron` en `window` después de cada escritura exitosa (cualquier método distinto de `GET` con respuesta `ok`). Se emite en `apiFetch` porque es el único lugar por donde pasan todas las escrituras; `PuestaEnMarcha` lo escucha y recarga su estado.

---

## 4. Lista de espera

### El problema

Un día lleno se pierde dos veces: se va quien quería venir, y cuando alguien cancela a última hora ese hueco queda vacío porque nadie se entera a tiempo. La lista junta las dos puntas.

### El modelo

Tabla **`lista_espera`**, modelo `ListaEspera`. Cada fila es una persona esperando en un local para un **día**, no para una hora exacta: quien quiere venir el sábado acepta casi cualquier hora del sábado, y pedir la hora exacta reduciría la lista a casi nadie. `servicio_id` y `barbero_id` son opcionales; si se indica barbero, solo se le avisa de los huecos de esa persona.

`estado` tiene tres valores (constantes en el modelo):

- `esperando`: sigue en la fila.
- `avisado`: ya se le avisó de un cupo ese día. No se le vuelve a avisar, porque el segundo mensaje ya es molestia y el cupo probablemente lo tomó otro.
- `cerrada`: se dio de baja.

Índice único en `(barberia_id, cliente_id, fecha)`: una persona no se anota dos veces para el mismo día y local. `ListaEsperaController::store` busca la fila existente con `whereDate` (y no con `updateOrCreate`, porque el cast `date` escribe la fecha con hora y la comparación de texto no la encontraba) y, si existe, la actualiza y la vuelve a `esperando`. Eso además revive a quien ya fue avisado y quiere seguir esperando.

### El aviso automático

Se engancha en el **modelo** `Cita` (`booted()`, evento `updated`): cuando `estado` cambia a `cancelada`, despacha el job `AvisarCupoLiberado`. Va en el modelo y no en cada controlador porque cancelar pasa por tres caminos (el cliente desde sus reservas, el barbero desde su agenda, el admin desde el panel, y también `DELETE /barberos/{id}` cancela en lote) y mañana puede pasar por un cuarto. El `dispatch` está envuelto en `try/catch`: con la cola en `sync` el job corre en el mismo request, y avisar de un cupo nunca puede voltear una cancelación.

`App\Jobs\AvisarCupoLiberado` va en cola porque cancelar no puede tardar lo que tarden tres mensajes de WhatsApp, ni fallar porque el proveedor esté caído. Lo que hace:

1. Si la cita ya no está `cancelada` o su fecha ya pasó, no hace nada.
2. Toma a los **3 primeros** en `esperando` para ese local y ese día (por orden de llegada, `id`), que no hayan pedido otro barbero. Tres es el punto donde el cupo se llena casi siempre sin volverse una carrera: avisarle solo al primero deja el hueco vacío si no contesta, y avisarle a toda la lista es spam. El mensaje dice que la hora es para quien la tome primero.
3. A cada uno le manda WhatsApp; si no sale, **`CupoLiberadoMail`** (vista `emails/cupo_liberado.blade.php`). Solo si alguno de los dos salió, la fila pasa a `avisado`. Si ninguno salió, sigue en la fila para el próximo hueco en vez de quedar marcada sin haberse enterado.

El aviso no reserva nada: trae el enlace a la página pública del local (`FRONTEND_URL` + `/barberia/{slug}`) y la persona reserva como cualquiera.

### Rutas

- `POST /api/lista-espera` (con `throttle:20,1`, porque anotarse dispara avisos), `GET /api/mi-lista-espera`, `DELETE /api/lista-espera/{id}`: para quien espera. Están en el grupo de comunes autenticados. Dar de baja no borra la fila: la pasa a `cerrada`.
- `GET /api/mi-barberia/lista-espera` (`role:admin`): quienes siguen en `esperando` en el local activo, de hoy en adelante, con nombre, correo y teléfono.

### El front

- **`AvisameSiSeLibera.jsx`** aparece en `BookingModal.jsx` justo cuando el día elegido no tiene nada que tomar: sin grilla de horarios, o con todas las horas ocupadas o pasadas. Es el momento exacto en que la persona se iba a ir.
- **`ListaDeEspera.jsx`** va arriba de la agenda (`AgendaPage.jsx`). Solo se muestra si hay alguien esperando, porque una tarjeta vacía todos los días enseña a ignorarla. Si un día se repite, lo destaca: los días más pedidos son los días en que conviene abrir más cupo.

---

## 5. WhatsApp

### Por qué

El recordatorio de una hora y el aviso de un cupo compiten con la bandeja de entrada, y la pierden. Por eso salen por WhatsApp cuando la persona dejó teléfono, y por correo cuando no.

### El servicio

**`App\Services\WhatsApp`**, registrado como singleton en `AppServiceProvider` con la configuración de `services.whatsapp`. Dos métodos públicos:

- **`disponible()`**: si hay por dónde mandar.
- **`enviar($telefono, $mensaje)`**: devuelve `true` si salió y `false` si no. **Nunca lanza**: un aviso es un extra, y que el proveedor esté caído no puede voltear una cancelación ni el comando nocturno. Quien llama decide si cae al correo.

Dos drivers:

- **`log`**: escribe el mensaje en el log en lugar de enviarlo, igual que `MAIL_MAILER=log`. Sirve para probar el flujo completo en local sin gastar mensajes ni escribirle a un número real. Con este driver `disponible()` siempre es `true`.
- **`cloud`**: la API de WhatsApp Cloud de Meta (`graph.facebook.com/v21.0/{phone_number_id}/messages`, timeout de 8 segundos, mensaje de texto sin vista previa). Solo está disponible si hay `token` **y** `phone_number_id`. Si el proveedor rechaza el mensaje, se registra el status y el mensaje de error, pero no el cuerpo entero, porque puede traer el número completo.

El número se guarda como la persona lo escribió y se **normaliza al enviar**: se dejan solo los dígitos; si ya empieza con el prefijo de país (por defecto `56`) se acepta con 11 dígitos o más; si tiene 9 dígitos se le antepone el prefijo; si tiene 8, el prefijo y un `9`. Cualquier otra cosa se descarta y el aviso cae al correo. Se hace así para no pedirle un formato exacto en el formulario, que es donde la gente abandona.

### El teléfono

Columna nueva **`users.telefono`** (`string(25)`, opcional). Se edita en `PerfilUsuario.jsx` (campo "WhatsApp (opcional)") y se valida en `UpdatePerfilRequest` como `nullable|string|max:25`. `AuthController::updatePerfil` usa `array_key_exists` y no `filled`, para que mandarlo vacío lo borre: si un `null` se ignorara, la persona no podría darse de baja del canal.

### El recordatorio diario

`citas:enviar-recordatorios` (programado a las 09:00 en `routes/console.php`) ahora, para cada cita de mañana `pendiente` o `confirmada`:

1. Intenta WhatsApp con un texto corto (cuándo, qué servicio, con quién, la dirección si la hay, y una invitación a avisar si no puede venir). Esa invitación no es cortesía: es lo que libera el cupo a tiempo para la lista de espera.
2. Si no salió y hay correo, encola `RecordatorioCitaMail` como antes.
3. **Nunca por los dos canales.** El mismo aviso repetido es ruido, y el que molesta es el que hace que la próxima vez no se lea.
4. Marca `recordatorio_enviado_at` después de enviar, lo que mantiene el comando idempotente. Si no hubo ni WhatsApp ni correo, no marca, para que el próximo intento lo reintente.

---

## 6. Arreglos de front

- **Logo con inicial.** `ImageUploader.jsx` acepta dos props nuevas, `inicial` y `colorFondo`: cuando no hay imagen, o cuando la imagen guardada no carga (un archivo movido, el enlace de `storage` sin crear), muestra la inicial del nombre sobre el color de la tienda en vez del cuadro roto del navegador, que parecía un error de la aplicación. Lo usan `MiTiendaPage.jsx` y `EditarBarberiaModal.jsx`. `SelloTienda` del `LandingPage.jsx` hace lo mismo con `onError`: si el logo falla, cae a la inicial, que es lo que ya mostraba sin logo.
- **Campo numérico de duración.** `NumberInputClamped.jsx` ajustaba al rango en cada tecla, y eso rompía el campo: con `min` 5, escribir "30" empezaba por "3", que saltaba a "5", y la siguiente tecla lo dejaba en "50". Ahora respeta lo que se escribe y ajusta al salir del campo (`onBlur`), cuando el número ya está completo. Ningún valor fuera de rango llega a guardarse igual.

---

## 7. Variables de entorno

### Backend (`Tenri-Backend/backend/.env`)

Se leen en `config/services.php`, bloque `whatsapp`:

| Variable | Default | Para qué |
|---|---|---|
| `WHATSAPP_DRIVER` | `log` | `log` escribe los mensajes en el log; `cloud` los manda por la API de Meta. |
| `WHATSAPP_TOKEN` | vacío | Token de acceso de WhatsApp Cloud. Solo con `cloud`. |
| `WHATSAPP_PHONE_NUMBER_ID` | vacío | ID del número emisor en WhatsApp Cloud. Solo con `cloud`. |
| `WHATSAPP_PREFIJO_PAIS` | `56` | Código de país que se antepone al normalizar los teléfonos. |

Recordar `php artisan config:clear` después de cambiarlas en el servidor: el deploy no toca el `.env`.

Ninguna variable nueva para multi-local, puesta en marcha ni lista de espera. La lista de espera sí depende de dos que ya existían: `QUEUE_CONNECTION` (el job va en cola; con `database` hace falta el `queue:work` del cron descrito en [`DEPLOY.md`](DEPLOY.md)) y `FRONTEND_URL` (de ahí sale el enlace del aviso; se usa la primera URL de la lista).

### Frontend (`Tenri-Front/frontend/.env`)

| Variable | Default | Para qué |
|---|---|---|
| `VITE_TENRI_URL` | `https://tenri.cl` | A dónde apunta el enlace "Tu tienda se crea en tenri.cl" del registro. Configurable porque en local el sitio corre en otro puerto. |

`VITE_TENRI_URL` **no está** en el `.env.example` del front: si no se define, se usa el valor por defecto.

---

## 8. Migraciones

En orden de ejecución, todas en `Tenri-Backend/backend/database/migrations/`:

| Archivo | Qué hace |
|---|---|
| `2026_09_15_120000_create_barberia_usuario_table.php` | Crea `barberia_usuario` (`barberia_id`, `user_id`, `rol`) y la llena con cada usuario que ya tenía `barberia_id`, con su rol de hoy. Sin ese relleno, al desplegar todos los dueños quedarían sin local que administrar. |
| `2026_09_15_130000_add_onboarding_a_barberias.php` | Agrega `barberias.onboarding_resuelto_en` y lo llena con `now()` para los locales existentes. |
| `2026_09_15_140000_add_es_barbero_a_barberia_usuario.php` | Agrega `barberia_usuario.es_barbero`. Lo marca en el local al que la persona pertenecía si tenía `users.es_barbero` (es el único del que se puede afirmar), y siempre para las filas con rol `barbero`. |
| `2026_09_16_100000_add_telefono_a_users.php` | Agrega `users.telefono`, opcional. |
| `2026_09_16_110000_create_lista_espera_table.php` | Crea `lista_espera`, con índice `(barberia_id, fecha, estado)` para la consulta de cada cancelación y único `(barberia_id, cliente_id, fecha)`. |

Tests nuevos que cubren esto: `MultiLocalTest`, `ConfiguracionTiendaTest`, `ListaEsperaTest`, `RecordatorioPorWhatsappTest`, y los casos de alta agregados a `IntegracionPanelTest`.

---

## 9. Cosas a tener presente

Comportamientos que el código tiene hoy y que no son obvios. No todos son errores; se anotan para que nadie se sorprenda.

- **`WHATSAPP_DRIVER` vale `log` si no se define.** Con `log`, `disponible()` es siempre `true`, así que a quien tenga teléfono el recordatorio y el aviso de cupo se le "envían" al log y **no** le llegan por correo. El comentario del `.env.example` dice que sin token ni `phone_number_id` todo sale por correo, pero eso solo es cierto con `WHATSAPP_DRIVER=cloud`. En producción, mientras no haya credenciales de Meta, conviene dejar `WHATSAPP_DRIVER=cloud` sin token (el canal queda apagado y todo sale por correo) en vez de omitir la variable.
- **Reservar no saca a nadie de la lista de espera.** El comentario del modelo dice que `cerrada` es "se dio de baja, o ya reservó", pero hoy solo `DELETE /lista-espera/{id}` la cierra. Quien reservó igual puede recibir un aviso de ese día si sigue en `esperando`.
- **La sincronización de contraseña busca por el local seleccionado.** `PUT /integracion/panel/usuarios/password` compara contra `users.barberia_id`, no contra `barberia_usuario`. Si una persona con varios locales está parada en otro, responde `sincronizado: false` y no copia el hash.
- **El cambio de rol desde el panel no toca el rol por local.** `PUT /integracion/panel/usuarios/{id}/rol` cambia `users.rol`; en el próximo cambio de local la persona adopta el rol guardado en `barberia_usuario`.
- **Las rutas de lista de espera no están acotadas a clientes**, igual que las de reserva: un admin o barbero autenticado puede anotarse.
- **El aviso de cupo depende de la cola.** Con `QUEUE_CONNECTION=database` y sin el `queue:work` del cron, los avisos quedan encolados y no salen. Con `sync` corren en el mismo request de la cancelación, protegidos por el `try/catch` del modelo.
