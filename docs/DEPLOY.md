# Deploy a producción — booking.tenri.cl (cPanel)

## Cómo queda armado el hosting

```
~ (home del usuario cPanel)
├── public_html/               ← docroot de booking.tenri.cl
│   ├── index.html             ← SPA React (build de Vite)
│   ├── assets/                ← JS/CSS del build
│   ├── .htaccess              ← fallback SPA (F5 / URLs directas)
│   ├── api/
│   │   ├── index.php          ← puente /api/* → Laravel
│   │   └── .htaccess          ← front-controller estándar de Laravel
│   └── storage → ~/booking_backend/storage/app/public   (symlink, ver abajo)
│
└── booking_backend/           ← app Laravel completa (fuera del docroot)
    ├── app/ ... vendor/ ...
    └── .env                   ← credenciales reales (se crea UNA vez, el FTP no lo toca)
```

- El frontend y la API comparten origen (`https://booking.tenri.cl`), así que no hay problemas de CORS en producción.
- `public_html/api/index.php` carga el Laravel de `~/booking_backend`. Como `routes/api.php` ya usa el prefijo `api`, el ruteo calza sin configuración extra.

## Setup de primera vez (una sola vez, por SSH)

```bash
# 1. Crear la BD MySQL y su usuario en cPanel (panel web)

# 2. Configurar el .env real del backend
cd ~/booking_backend
cp .env.production.example .env
nano .env          # completar DB_*, MAIL_*
php artisan key:generate

# 3. Migrar
php artisan migrate --force

# 4. Symlink para que los avatares/logos/imágenes sean públicos
#    (asset('storage/...') apunta a booking.tenri.cl/storage/...)
ln -s ~/booking_backend/storage/app/public ~/public_html/storage

# 5. Cola de emails: crear un Cron Job en cPanel (cada minuto)
#    cd ~/booking_backend && php artisan queue:work --stop-when-empty --tries=3 >> /dev/null 2>&1
#    Si no quieres cron, usa QUEUE_CONNECTION=sync en el .env
#    (los emails se envían en línea: funciona igual, más lento por request).
```

> ⚠️ **Nunca** ejecutes `php artisan db:seed` en producción. El seeder de usuarios
> está protegido y se auto-omite con `APP_ENV=production`, pero no lo invoques.
> El primer superadmin créalo a mano (tinker o INSERT directo con password hasheada).

## Cada deploy (automático + 2 comandos)

Al hacer push a `main`, GitHub Actions corre tests y sube por FTP:
- el build del frontend (incluye `.htaccess` y `api/`) → `public_html/`
- `backend.zip` (sin `.env`, sin tests) → `~/booking_backend/`

Luego, por SSH:

```bash
cd ~/booking_backend
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

## Secrets de GitHub Actions usados

| Secret | Uso |
|---|---|
| `FTP_SERVER` | Host FTP |
| `FTP_USERNAME` / `FTP_PASSWORD` | Cuenta FTP con raíz en `public_html/` (frontend) |
| `FTP_USERNAME_ROOT` / `FTP_PASSWORD_ROOT` | Cuenta FTP con raíz en `~` (backend) |
