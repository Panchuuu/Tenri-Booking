<?php

/**
 * ============================================================
 * Puente booking.tenri.cl/api → Laravel (../booking_backend)
 * ============================================================
 * En el hosting (DirectAdmin) el frontend vive en
 * domains/<dominio>/public_html/ y el backend Laravel en
 * domains/<dominio>/booking_backend (fuera del docroot).
 * Este archivo se sube como public_html/api/index.php y hace
 * de front-controller: toda petición /api/* entra por aquí.
 *
 * Laravel ve la URI completa (/api/citas, /api/login, ...) y
 * como routes/api.php ya usa el prefijo "api", el ruteo calza
 * sin configuración extra.
 *
 * Si la estructura del hosting cambia, ajusta $backendPath.
 */

use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// public_html/api/ → public_html/ → domains/<dominio>/ → booking_backend
$backendPath = dirname(__DIR__, 2) . '/booking_backend';

if (!is_file($backendPath . '/vendor/autoload.php')) {
    http_response_code(503);
    header('Content-Type: application/json');
    echo json_encode(['message' => 'Backend no disponible: revisa la ruta de booking_backend en public_html/api/index.php']);
    exit;
}

// Modo mantenimiento (php artisan down)
if (file_exists($maintenance = $backendPath . '/storage/framework/maintenance.php')) {
    require $maintenance;
}

require $backendPath . '/vendor/autoload.php';

(require_once $backendPath . '/bootstrap/app.php')
    ->handleRequest(Request::capture());
