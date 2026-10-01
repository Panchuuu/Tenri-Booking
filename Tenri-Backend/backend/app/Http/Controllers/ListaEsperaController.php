<?php

namespace App\Http\Controllers;

use App\Models\Barberia;
use App\Models\ListaEspera;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use Illuminate\Http\Request;

/**
 * La lista de espera de un local.
 *
 * Un día lleno hoy se pierde dos veces: se va quien quería venir, y cuando
 * alguien cancela a última hora ese hueco queda vacío porque nadie se entera.
 * Acá se anota quien quiere venir igual, y {@see \App\Jobs\AvisarCupoLiberado}
 * le avisa en cuanto se libera algo.
 *
 * Anotarse no reserva nada ni compromete a nadie: es pedir que te avisen.
 */
class ListaEsperaController extends Controller
{
    /** Alguien pide que le avisen si se libera una hora de ese día. */
    public function store(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'barberia_id' => 'required|integer|exists:barberias,id',
            // Hoy incluido: un hueco de esta tarde es el más valioso de todos.
            'fecha' => 'required|date|after_or_equal:today',
            'servicio_id' => 'nullable|integer|exists:servicios,id',
            'barbero_id' => 'nullable|integer|exists:users,id',
        ]);

        $barberia = Barberia::activas()->find($datos['barberia_id']);

        if (! $barberia) {
            return response()->json(['error' => 'Ese local no está recibiendo reservas.'], 422);
        }

        /**
         * Anotarse dos veces para el mismo día sería recibir el aviso
         * repetido, así que se actualiza la que ya existe. Eso además revive a
         * quien ya fue avisado y quiere seguir esperando.
         *
         * Se busca con `whereDate` y no con `updateOrCreate`: la columna es
         * `date` pero el cast del modelo escribe la fecha con hora, así que
         * comparar el texto crudo no encuentra la fila que sí existe y el
         * insert choca contra el índice único.
         */
        $fecha = Carbon::parse($datos['fecha'])->toDateString();

        $espera = ListaEspera::where('barberia_id', $barberia->id)
            ->where('cliente_id', $request->user()->id)
            ->whereDate('fecha', $fecha)
            ->first();

        $valores = [
            'servicio_id' => $datos['servicio_id'] ?? null,
            'barbero_id' => $datos['barbero_id'] ?? null,
            'estado' => ListaEspera::ESPERANDO,
            'avisado_en' => null,
        ];

        if ($espera) {
            $espera->update($valores);
        } else {
            $espera = ListaEspera::create([
                ...$valores,
                'barberia_id' => $barberia->id,
                'cliente_id' => $request->user()->id,
                'fecha' => $fecha,
            ]);
        }

        return response()->json([
            'mensaje' => 'Te avisamos apenas se libere una hora.',
            'espera' => $espera->load(['barberia:id,nombre,slug', 'barbero:id,name', 'servicio:id,nombre']),
        ], 201);
    }

    /** En qué listas está esperando quien pregunta. */
    public function mias(Request $request): JsonResponse
    {
        $esperas = ListaEspera::with(['barberia:id,nombre,slug', 'barbero:id,name', 'servicio:id,nombre'])
            ->where('cliente_id', $request->user()->id)
            ->whereDate('fecha', '>=', now()->toDateString())
            ->where('estado', '!=', ListaEspera::CERRADA)
            ->orderBy('fecha')
            ->get();

        return response()->json($esperas);
    }

    /** Se baja de la lista. */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $espera = ListaEspera::where('id', $id)
            ->where('cliente_id', $request->user()->id)
            ->firstOrFail();

        $espera->update(['estado' => ListaEspera::CERRADA]);

        return response()->json(['mensaje' => 'Te sacamos de la lista.']);
    }

    /**
     * Quiénes esperan en el local que se está administrando.
     *
     * Le sirve al local para dos cosas: saber qué días tiene demanda que no
     * está pudiendo atender, y tener a quién llamar cuando se le cae una hora.
     */
    public function delLocal(Request $request): JsonResponse
    {
        $esperas = ListaEspera::with(['cliente:id,name,email,telefono', 'barbero:id,name', 'servicio:id,nombre'])
            ->where('barberia_id', $request->user()->barberia_id)
            ->vigentes()
            ->orderBy('fecha')
            ->orderBy('id')
            ->get();

        return response()->json($esperas);
    }
}
