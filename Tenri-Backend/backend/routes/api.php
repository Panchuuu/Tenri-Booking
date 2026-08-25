<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\BarberiaController;
use App\Http\Controllers\SuperAdminUsuarioController;
use App\Http\Controllers\BarberoController;
use App\Http\Controllers\BloqueoHorarioController;
use App\Http\Controllers\CitaController;
use App\Http\Controllers\FavoritoController;
use App\Http\Controllers\ServicioController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// ==========================================
// 🔓 PÚBLICAS
// ==========================================
Route::get('/rubros',    [BarberiaController::class, 'rubros']);
Route::get('/servicios', [ServicioController::class, 'index']);
Route::get('/barberos', [BarberoController::class, 'index']);
Route::get('/barberias', [BarberiaController::class, 'index']);
Route::get('/barberias/{slug}', [BarberiaController::class, 'showPorSlug']);
Route::get('/barberos/{id}/disponibilidad', [CitaController::class, 'disponibilidad']);

Route::middleware('throttle:10,1')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login',    [AuthController::class, 'login']);
});

// ==========================================
// 🔒 PROTEGIDAS (Sanctum)
// ==========================================
Route::middleware('auth:sanctum')->group(function () {

    Route::get('/user', fn (Request $request) => $request->user());
    Route::put('/perfil', [AuthController::class, 'updatePerfil']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // 👑 SUPERADMIN
    Route::middleware('role:superadmin')->group(function () {
        Route::post  ('/barberias',      [BarberiaController::class, 'store']);
        Route::post  ('/barberias/{id}', [BarberiaController::class, 'update']); // multipart
        Route::put   ('/barberias/{id}', [BarberiaController::class, 'update']); // JSON
        Route::delete('/barberias/{id}', [BarberiaController::class, 'destroy']);

        // 🎯 Pack 3: CRUD de usuarios para superadmin
        Route::get   ('/superadmin/usuarios',                [SuperAdminUsuarioController::class, 'index']);
        Route::patch ('/superadmin/usuarios/{id}/rol',       [SuperAdminUsuarioController::class, 'cambiarRol']);
        Route::patch ('/superadmin/usuarios/{id}/suspender', [SuperAdminUsuarioController::class, 'toggleSuspendido']);
        Route::delete('/superadmin/usuarios/{id}',           [SuperAdminUsuarioController::class, 'destroy']);
    });

    // ⚙️ ADMIN
    Route::middleware('role:admin')->group(function () {
        // 📊 FASE 4A: stats por periodo (hoy, semana, mes, custom)
        Route::get('/finanzas/hoy',     [CitaController::class, 'resumenFinancieroHoy']);
        Route::get('/finanzas/resumen', [CitaController::class, 'resumenPorPeriodo']);

        // Barbería
        Route::get('/mi-barberia',  [BarberiaController::class, 'miBarberia']);
        Route::put('/mi-barberia',  [BarberiaController::class, 'updateConfig']);
        // POST + _method=PUT para multipart (subida de logo desde Mi Tienda)
        Route::post('/mi-barberia', [BarberiaController::class, 'updateConfig'])->middleware('throttle:30,1');
        Route::get('/mi-equipo',     [BarberiaController::class, 'miEquipo']);
        Route::get('/mis-servicios', [BarberiaController::class, 'misServicios']);

        // Barberos (las rutas con subida de imagen llevan rate limit)
        Route::post  ('/barberos',           [BarberoController::class, 'store'])->middleware('throttle:30,1');
        Route::post  ('/barberos/asignar',   [BarberoController::class, 'asignarRol']);
        Route::post  ('/barberos/{id}',      [BarberoController::class, 'update'])->middleware('throttle:30,1'); // POST + _method=PUT para multipart
        Route::put   ('/barberos/{id}',      [BarberoController::class, 'update'])->middleware('throttle:30,1');
        Route::delete('/barberos/{id}',      [BarberoController::class, 'destroy']);

        // Servicios
        Route::post  ('/servicios',      [ServicioController::class, 'store'])->middleware('throttle:30,1');
        Route::put   ('/servicios/{id}', [ServicioController::class, 'update'])->middleware('throttle:30,1');
        Route::delete('/servicios/{id}', [ServicioController::class, 'destroy']);

        // 🚫 FASE 4A: bloqueos de horario
        Route::get   ('/bloqueos',      [BloqueoHorarioController::class, 'index']);
        Route::post  ('/bloqueos',      [BloqueoHorarioController::class, 'store']);
        Route::delete('/bloqueos/{id}', [BloqueoHorarioController::class, 'destroy']);
    });

    // 💈 ADMIN + BARBERO
    Route::middleware('role:admin,barbero')->group(function () {
        Route::get  ('/citas',                [CitaController::class, 'index']);
        Route::patch('/citas/{id}/estado',    [CitaController::class, 'updateEstado']);
        Route::get  ('/barbero/citas',        [CitaController::class, 'citasBarbero']);
    });

    // 👤 COMUNES
    Route::get('/mis-reservas', [CitaController::class, 'misReservas']);

    // ❤️ Favoritos: cualquier usuario autenticado puede marcar barberías.
    Route::get ('/mis-favoritos',                 [FavoritoController::class, 'index']);
    Route::post('/barberias/{id}/favorito',       [FavoritoController::class, 'toggle'])->middleware('throttle:30,1');

    // Escrituras de citas con rate limit: sin él, un script podía llenar
    // la agenda de un barbero o spamear calificaciones sin freno.
    Route::middleware('throttle:20,1')->group(function () {
        Route::post ('/citas',                    [CitaController::class, 'store']);
        Route::patch('/mis-citas/{id}/cancelar',  [CitaController::class, 'cancelarMiCita']);
        Route::post ('/mis-citas/{id}/calificar', [CitaController::class, 'calificar']);

        // 🔄 FASE 4A: reagendar (lo puede hacer cliente, admin o barbero según rol)
        Route::patch('/citas/{id}/reagendar', [CitaController::class, 'reagendar']);
    });
});
