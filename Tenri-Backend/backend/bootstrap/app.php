<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // 👇 AQUÍ REGISTRAMOS NUESTRO MIDDLEWARE DE ROLES
        $middleware->alias([
            'role' => \App\Http\Middleware\CheckRole::class,
            // Canal server-to-server con el panel de tenri.cl (firma HMAC).
            'firma.panel' => \App\Http\Middleware\VerificarFirmaPanel::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();