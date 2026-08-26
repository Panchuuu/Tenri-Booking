# Deploy a producción — booking.tenri.cl (DirectAdmin)

## Cómo queda armado el hosting

```
~ (home del usuario DirectAdmin)
└── domains/
    └── booking.tenri.cl/
        ├── public_html/           ← docroot del dominio
        │   ├── index.html         ← SPA React (build de Vite)
        │   ├── assets/            ← JS/CSS del build
        │   ├── .htaccess          ← fallback SPA (F5 / URLs directas)
        │   ├── api/
        │   │   ├── index.php      ← puente /api/* → Laravel
        │   │   └── .htaccess      ← front-controller estándar de Laravel
        │   └── storage → ../booking_backend/storage/app/public   (symlink)
        │
        └── booking_backend/       ← app Laravel completa (fuera del docroot)
            ├── app/ ... vendor/ ...
            └── .env               ← credenciales reales (se crea UNA vez, el FTP no lo toca)
```

- El frontend y la API comparten origen (`https://booking.tenri.cl`) → sin CORS.
- `public_html/api/index.php` busca el Laravel en `../../booking_backend`
  (ruta relativa), o sea `domains/booking.tenri.cl/booking_backend`. Por eso
  el backend **debe** subirse ahí y no al home.

## Setup de primera vez en DirectAdmin (una sola vez)

### 1. Base de datos (panel web)
`DirectAdmin → MySQL Management → Create new Database`.
Anota: nombre de BD, usuario y contraseña (DirectAdmin los prefija con tu usuario,
p. ej. `usuario_booking`).

### 2. Secrets del FTP para GitHub Actions
Se usan **dos cuentas FTP** con raíces distintas (GitHub → repo → Settings →
Secrets → Actions):

| Secret | Valor |
|---|---|
| `FTP_SERVER` | host FTP del servidor |
| `FTP_USERNAME` / `FTP_PASSWORD` | cuenta FTP con raíz **en el docroot** `domains/booking.tenri.cl/public_html` (frontend) |
| `FTP_USERNAME_ROOT` / `FTP_PASSWORD_ROOT` | cuenta principal de DirectAdmin, raíz en el **home** `~` (backend) |

### 3. Configurar el `.env` del backend
Tras el **primer deploy** (que crea `booking_backend/` con `backend.zip` dentro),
por SSH o el Terminal de DirectAdmin (`System Info & Files → Terminal`):

```bash
cd ~/domains/booking.tenri.cl/booking_backend
unzip -o backend.zip && rm backend.zip
cp .env.production.example .env
nano .env          # completar DB_* (paso 1) y MAIL_*
php artisan key:generate
php artisan migrate --force
```

> Si el hosting no tiene `unzip`, en DirectAdmin usa `File Manager → backend.zip → Extract`.
> Si `php` en CLI es una versión vieja, usa el binario versionado del servidor
> (p. ej. `/usr/local/php82/bin/php artisan ...`).

### 4. Symlink de storage (avatares/logos públicos)

```bash
ln -s ../booking_backend/storage/app/public ~/domains/booking.tenri.cl/public_html/storage
```

### 5. Cron para la cola de emails y recordatorios
`DirectAdmin → Cron Jobs`, cada minuto:

```
cd ~/domains/booking.tenri.cl/booking_backend && php artisan schedule:run >> /dev/null 2>&1
```

y otro para la cola (o usa `QUEUE_CONNECTION=sync` en el `.env` si prefieres sin cron):

```
cd ~/domains/booking.tenri.cl/booking_backend && php artisan queue:work --stop-when-empty --tries=3 >> /dev/null 2>&1
```

> ⚠️ **Nunca** ejecutes `php artisan db:seed` en producción. El seeder se
> auto-omite con `APP_ENV=production`, pero no lo invoques. El primer
> superadmin créalo a mano (tinker o INSERT con password hasheada).

## Cada deploy (automático)

Al hacer push a `main`, GitHub Actions corre los tests y, si pasan, sube por FTP:
- el build del frontend (incluye `.htaccess` y `api/`) → `domains/booking.tenri.cl/public_html/`
- `backend.zip` (sin `.env`, sin tests) → `domains/booking.tenri.cl/booking_backend/`

El frontend queda live al instante. El backend lo aplica solo el cron de
auto-deploy (ver `README-SERVIDOR.md` → Cron Jobs): detecta el `backend.zip`,
lo descomprime, migra y limpia caché; log en `storage/logs/deploy.log`.

Si no configuraste ese cron, hazlo a mano por SSH / Terminal de DirectAdmin:

```bash
cd ~/domains/booking.tenri.cl/booking_backend
unzip -o backend.zip && rm backend.zip
php artisan migrate --force
php artisan optimize:clear
```

## Verificación post-deploy

```bash
curl -s https://booking.tenri.cl/api/barberias | head -c 300   # JSON, no 404/500
```

Y en el navegador: abrir `https://booking.tenri.cl/mis-reservas` directamente
(debe cargar la SPA, no un 404 de Apache).

## Si `/api` devuelve 503 "Backend no disponible"

El puente no encontró `booking_backend/vendor/autoload.php`. Revisa:
1. Que el zip se haya descomprimido en `domains/booking.tenri.cl/booking_backend`
   (no en `~/booking_backend` ni en una subcarpeta `backend/`).
2. Que `vendor/` exista (el zip ya lo trae; no hace falta composer en el servidor).
