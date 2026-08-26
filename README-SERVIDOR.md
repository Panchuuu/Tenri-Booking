# Pasos en el servidor (DirectAdmin) — booking.tenri.cl

Comandos para pegar por SSH o en **DirectAdmin → System Info & Files → Terminal**.
Pega solo los comandos, sin las comillas ``` de formato.

## Contexto (cómo quedó el hosting)

- Backend antiguo con `.env` real: `~/booking_backend` (época cPanel)
- Ubicación definitiva del backend: `~/domains/booking.tenri.cl/booking_backend`
  (el puente `public_html/api/index.php` lo busca ahí con ruta relativa)
- Frontend: `~/domains/booking.tenri.cl/public_html` (lo sube el pipeline solo)

## 1. Migración única a la estructura nueva

### Fase A — preparación (ANTES de relanzar el deploy)

El `api` del docroot es un symlink de la época anterior que el FTP no puede
atravesar (error 550). Hay que quitarlo y dejar listo el backend definitivo:

```bash
# Ver a donde apunta el api viejo (solo informativo, mandame la salida)
readlink -f ~/domains/booking.tenri.cl/public_html/api

# Quitar el api viejo (sin barra final: borra el enlace, no su destino)
rm -rf ~/domains/booking.tenri.cl/public_html/api

# Preparar el backend definitivo con el .env real del backend antiguo
rm -f ~/booking_backend/backend.zip
mkdir -p ~/domains/booking.tenri.cl/booking_backend
cp -a ~/booking_backend/. ~/domains/booking.tenri.cl/booking_backend/
```

> La API queda caída desde este momento hasta terminar la Fase B (minutos).

### Fase B — cierre (DESPUÉS de que el deploy quede en verde)

```bash
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

## 3. Auto-deploy del backend (elegir UNA opción)

### Opción A — paso SSH en el pipeline (recomendada, aplica al instante)

El workflow ya trae un paso SSH que se activa solo al configurar los secrets.

1. En el servidor (SSH o Terminal de DirectAdmin), crear una llave dedicada:

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N "" -C "github-actions"
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
cat ~/.ssh/github_deploy
```

2. Copiar la salida del último `cat` (la llave privada completa, incluidas las
   líneas `BEGIN`/`END`) y en GitHub → repo → **Settings → Secrets and
   variables → Actions** crear:

| Secret | Valor |
|---|---|
| `SSH_HOST` | `66.235.169.112` (o el hostname del servidor) |
| `SSH_USERNAME` | usuario de DirectAdmin (p. ej. `atlasdig`) |
| `SSH_PRIVATE_KEY` | la llave privada copiada |

3. Listo: el siguiente push a `main` aplica el backend solo. Si el paso falla
   con timeout de conexión, el hosting bloquea las IPs de GitHub → borra los
   secrets y usa la Opción B.

### Opción B — cron watcher (si el hosting bloquea SSH externo)

Cron de DirectAdmin cada minuto (aplica con ~1 min de retraso):

```
cd ~/domains/booking.tenri.cl/booking_backend && if [ -f backend.zip ] && unzip -tqq backend.zip 2>/dev/null; then unzip -o backend.zip && rm backend.zip && php artisan migrate --force && php artisan optimize:clear; fi >> storage/logs/deploy.log 2>&1
```

## Cada deploy futuro

Con la Opción A o B configurada, **no hay que hacer nada**: tras cada push a
`main` con el pipeline en verde, el backend se aplica solo (al instante con
SSH; en ~1 min con el cron, log en `storage/logs/deploy.log`).

- En la Opción B, el `unzip -tqq` valida la integridad del zip antes de tocar
  nada: si el cron se dispara mientras el FTP aún está subiendo el archivo,
  el test falla (el índice del zip va al final) y reintenta al minuto
  siguiente. El log sobrevive los deploys (el pipeline excluye
  `storage/logs/*` del zip).

Sin ninguna de las dos, el manual de siempre:

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
