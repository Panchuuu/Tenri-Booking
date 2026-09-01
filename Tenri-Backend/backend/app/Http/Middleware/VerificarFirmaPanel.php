<?php

namespace App\Http\Middleware;

use App\Support\HmacFirma;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * El canal server-to-server con el panel de administración de tenri.cl.
 *
 * No hay usuario ni token Sanctum en este canal: quien llama es el backend del
 * panel (api.tenri.cl), firmando cada request con HMAC sobre método, ruta y
 * cuerpo. La clave compartida vive en PANEL_INTEGRATION_KEY y es la misma que
 * el panel tiene en su BOOKING_PANEL_KEY.
 *
 * Falla cerrado: sin clave configurada, todo el canal responde 401 — igual que
 * una firma inválida, para no revelar cuál de las dos cosas pasó.
 */
class VerificarFirmaPanel
{
    public function handle(Request $request, Closure $next): Response
    {
        $secreto = config('services.panel.integration_key');

        if (! is_string($secreto) || $secreto === '') {
            return response()->json(['message' => 'No autorizado.'], 401);
        }

        // aceptarSinRuta en false desde el día uno: este canal nació después
        // del parche que ata la firma a método y ruta, no hereda la transición.
        if (! HmacFirma::verificaConRuta($secreto, $request, aceptarSinRuta: false)) {
            return response()->json(['message' => 'No autorizado.'], 401);
        }

        return $next($request);
    }
}
