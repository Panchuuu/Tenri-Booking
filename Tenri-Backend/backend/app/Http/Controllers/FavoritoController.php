<?php

namespace App\Http\Controllers;

use App\Models\Barberia;
use Illuminate\Http\Request;

class FavoritoController extends Controller
{
    /**
     * IDs de las barberías favoritas del usuario autenticado.
     * Devuelve solo IDs: el landing ya tiene las barberías cargadas
     * y únicamente necesita saber cuáles marcar con el corazón.
     */
    public function index(Request $request)
    {
        return response()->json([
            'barberia_ids' => $request->user()->barberiasFavoritas()->pluck('barberias.id'),
        ]);
    }

    /**
     * Alterna el favorito: si existe lo quita, si no lo agrega.
     * toggle() es atómico a nivel de fila (la unique constraint de la
     * tabla evita duplicados ante doble click).
     */
    public function toggle(Request $request, int $barberiaId)
    {
        // 404 limpio si la barbería no existe (evita FK error 500).
        Barberia::findOrFail($barberiaId);

        $resultado = $request->user()->barberiasFavoritas()->toggle($barberiaId);

        return response()->json([
            'es_favorita' => count($resultado['attached']) > 0,
        ]);
    }
}
