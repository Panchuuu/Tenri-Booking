# Pasos en el servidor (DirectAdmin) — booking.tenri.cl

Comandos para pegar por SSH o en **DirectAdmin → System Info & Files → Terminal**.
Pega solo los comandos, sin las comillas ``` de formato.

## Contexto (cómo quedó el hosting)

- Backend antiguo con `.env` real: `~/booking_backend` (época cPanel)
- Ubicación definitiva del backend: `~/domains/booking.tenri.cl/booking_backend`
  (el puente `public_html/api/index.php` lo busca ahí con ruta relativa)
- Frontend: `~/domains/booking.tenri.cl/public_html` (lo sube el pipeline solo)

## 1. Migración única a la estructura nueva

**Espera a que el último run de GitHub Actions esté en verde** y luego pega:

```bash
# Borrar el zip viejo obsoleto para que no pise al nuevo
rm -f ~/booking_backend/backend.zip

# Copiar el backend antiguo (con su .env real) a la ubicación definitiva
mkdir -p ~/domains/booking.tenri.cl/booking_backend
cp -a ~/booking_backend/. ~/domains/booking.tenri.cl/booking_backend/

# Descomprimir el codigo nuevo que dejo el pipeline y migrar
cd ~/domains/booking.tenri.cl/booking_backend
unzip -o backend.zip && rm backend.zip
php artisan migrate --force
php artisan optimize:clear

# Symlink para que logos/avatares sean publicos
ln -sfn ../booking_backend/storage/app/public ~/domains/booking.tenri.cl/public_html/storage

# Limpiar la carpeta basura que dejo el deploy con rutas equivocadas
rm -rf ~/domains/booking.tenri.cl/public_html/domains

# Dejar el backend viejo como respaldo (borralo cuando todo funcione)
mv ~/booking_backend ~/booking_backend.old
```

Verificación (debe devolver JSON, no 404 ni 503):

```bash
curl -s https://booking.tenri.cl/api/rubros
curl -s https://booking.tenri.cl/api/barberias | head -c 200
```

## 2. Cron Jobs (una sola vez, si aún no existen)

En **DirectAdmin → Cron Jobs**, cada minuto:

Recordatorios de citas (obligatorio para los emails de recordatorio):

```
cd ~/domains/booking.tenri.cl/booking_backend && php artisan schedule:run >> /dev/null 2>&1
```

Cola de emails (o pon `QUEUE_CONNECTION=sync` en el `.env` si prefieres sin cron):

```
cd ~/domains/booking.tenri.cl/booking_backend && php artisan queue:work --stop-when-empty --tries=3 >> /dev/null 2>&1
```

> Si ya tenías estos crons apuntando a `~/booking_backend`, edítalos con la ruta nueva.

## Cada deploy futuro

Tras cada push a `main` con el pipeline en verde, solo esto:

```bash
cd ~/domains/booking.tenri.cl/booking_backend
unzip -o backend.zip && rm backend.zip
php artisan migrate --force
php artisan optimize:clear
```

## Si algo falla

- `/api/*` devuelve **503 "Backend no disponible"** → falta
  `domains/booking.tenri.cl/booking_backend/vendor/autoload.php` (revisa el paso 1).
- `php artisan` falla por versión de PHP vieja → usa el binario versionado,
  p. ej. `/usr/local/php82/bin/php artisan migrate --force`.
- Error 500 tras migrar → `php artisan optimize:clear` y revisa
  `storage/logs/laravel.log`.
- **Nunca** ejecutes `php artisan db:seed` en producción.
