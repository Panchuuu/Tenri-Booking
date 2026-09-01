<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckRole
{
    /**
     * Maneja la petición entrante y verifica el rol.
     */
    public function handle(Request $request, Closure $next, ...$roles): Response
    {
        // 1. Verificamos que el usuario esté autenticado
        if (!$request->user()) {
            return response()->json(['error' => 'No autenticado.'], 401);
        }

        // 2. El 'superadmin' (Tú) tiene poder absoluto, pasa directo a cualquier ruta
        if ($request->user()->rol === 'superadmin') {
            return $next($request);
        }

        // 3. Verificamos si el rol del usuario está dentro de los roles permitidos para esta ruta
        if (in_array($request->user()->rol, $roles)) {
            return $next($request);
        }

        // 3b. Rol dual: un admin que también atiende (es_barbero) cuenta
        //     como barbero en las rutas que lo exijan.
        if (in_array('barbero', $roles) && $request->user()->esBarberoActivo()) {
            return $next($request);
        }

        return response()->json([
            'error' => 'Acceso denegado. Este nivel de seguridad requiere permisos de: ' . implode(', ', $roles)
        ], 403);
    }
}