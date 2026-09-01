<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * El estado de salud de este servicio, para que otro lo sondee.
 *
 * El contrato no se inventó acá: es el mismo que ya hablan el ERP y
 * api.tenri.cl (la copia de referencia vive en Tenri-Web-Page,
 * `HealthController`). Se copia deliberadamente, campo por campo, porque el
 * panel de estado de tenri.cl sondea a todos con la misma sonda:
 *
 * ```
 * 200 {"status":"ok"}         producción, sano
 * 503 {"status":"degraded"}   producción, algo falla
 * 200 {"status":"ok","checks":{...},"time":"..."}   local, con detalle
 * ```
 *
 * El 503 con JSON es lo que separa "degradado" de "caído" en la página de
 * estado: si el cuerpo trae `status`, habló la aplicación y no el hosting.
 * El detalle de checks no sale en producción — es un endpoint abierto, y los
 * nombres de los subsistemas que fallan son un mapa útil para quien mire.
 *
 * Nada que dependa de un tercero va acá: cada servicio responde por sí mismo.
 */
class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $checks = [
            'app' => ['ok' => true],
            // `DB::connection()` no abre nada hasta que se usa: preguntar si
            // la conexión existe daría true con la base caída, que es
            // exactamente el caso que este endpoint existe para atrapar.
            'database' => $this->verificar(fn () => DB::select('select 1') !== []),
            'cache' => $this->verificar(function () {
                $clave = 'health_'.bin2hex(random_bytes(4));
                Cache::put($clave, 'ok', 5);
                $ok = Cache::get($clave) === 'ok';
                Cache::forget($clave);

                return $ok;
            }),
            'queue' => $this->verificar(fn () => is_string(config('queue.default')) && Queue::size() >= 0),
            // Escribir de verdad y no solo preguntar por los permisos: el
            // disco lleno deja la app respondiendo pero sin poder guardar un
            // logo o un avatar, y eso falla después lejos de la causa.
            'storage' => $this->verificar(function () {
                $archivo = 'health/'.bin2hex(random_bytes(4)).'.txt';
                Storage::put($archivo, 'ok');
                $ok = Storage::get($archivo) === 'ok';
                Storage::delete($archivo);

                return $ok;
            }),
        ];

        $saludable = collect($checks)->every(fn ($check) => $check['ok'] === true);

        $cuerpo = ['status' => $saludable ? 'ok' : 'degraded'];

        if (app()->environment('local')) {
            $cuerpo['checks'] = $checks;
            $cuerpo['time'] = now()->toIso8601String();
        }

        return response()->json($cuerpo, $saludable ? 200 : 503);
    }

    /** @return array{ok:bool,error?:string} */
    private function verificar(callable $prueba): array
    {
        try {
            return ['ok' => (bool) $prueba()];
        } catch (Throwable $e) {
            return ['ok' => false, 'error' => $e->getMessage()];
        }
    }
}
