<?php

namespace App\Http\Controllers;

use App\Models\Barberia;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * La puesta en marcha de un local recién creado.
 *
 * Quien compra Booking recibe una tienda con nombre y poco más. Esta pantalla
 * le dice qué le falta para poder recibir su primera reserva, en el orden en
 * que conviene hacerlo, y le deja tocar cada punto para ir a resolverlo.
 *
 * El tutorial se ofrece una vez y se puede saltar: quien ya sabe moverse no
 * tiene por qué pasar por él, y la lista de pendientes queda igual arriba del
 * panel hasta que esté todo listo.
 */
class ConfiguracionTiendaController extends Controller
{
    /**
     * Cómo va la configuración del local activo.
     *
     * `tutorial_pendiente` es lo que decide si el panel ofrece el paso a paso
     * al entrar. Deja de estarlo cuando lo terminan o lo saltan, no cuando la
     * configuración se completa: son dos cosas distintas y se responden por
     * separado.
     */
    public function estado(Request $request): JsonResponse
    {
        $barberia = $this->barberiaDe($request);

        if (! $barberia) {
            return response()->json(['message' => 'No tienes un local seleccionado.'], 409);
        }

        return response()->json([
            'barberia' => [
                'id' => $barberia->id,
                'nombre' => $barberia->nombre,
                'slug' => $barberia->slug,
            ],
            'porcentaje' => $barberia->avanceDeConfiguracion(),
            'pasos' => $barberia->pasosDeConfiguracion(),
            'tutorial_pendiente' => $barberia->onboarding_resuelto_en === null,
        ]);
    }

    /**
     * Marca el tutorial como resuelto, se haya seguido o saltado.
     *
     * No se distingue entre una cosa y la otra a propósito: lo que importa es
     * que ya se le ofreció a esta persona. Si saltó y después quiere la lista,
     * la tiene arriba del panel igual.
     */
    public function resolverTutorial(Request $request): JsonResponse
    {
        $barberia = $this->barberiaDe($request);

        if (! $barberia) {
            return response()->json(['message' => 'No tienes un local seleccionado.'], 409);
        }

        $barberia->forceFill(['onboarding_resuelto_en' => now()])->save();

        return response()->json(['tutorial_pendiente' => false]);
    }

    private function barberiaDe(Request $request): ?Barberia
    {
        return $request->user()->barberia_id
            ? Barberia::find($request->user()->barberia_id)
            : null;
    }
}
