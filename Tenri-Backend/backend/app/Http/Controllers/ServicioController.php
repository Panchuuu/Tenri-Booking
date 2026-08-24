<?php

namespace App\Http\Controllers;

use App\Models\Servicio;
use App\Models\Barberia;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use App\Http\Requests\StoreServicioRequest;

class ServicioController extends Controller
{
    public function index(Request $request) {
        $slug = $request->query('barberia'); 

        if (!$slug) {
            return response()->json(['error' => 'Debes indicar la barbería'], 400);
        }

        $barberia = Barberia::where('slug', $slug)->firstOrFail();

        return Servicio::where('barberia_id', $barberia->id)->get();
    }

    public function store(StoreServicioRequest $request) {

        $rutaImagen = null;

        if ($request->hasFile('imagen')) {
            $rutaImagen = $request->file('imagen')->store('servicios', 'public');
        }

        $servicio = Servicio::create([
            'nombre' => $request->nombre,
            'precio' => $request->precio,
            'duracion_minutos' => $request->duracion,
            'descripcion' => $request->descripcion,
            'imagen' => $rutaImagen, 
            'barberia_id' => $request->user()->barberia_id 
        ]);

        return response()->json($servicio, 201);
    }

    public function update(Request $request, $id) {
        $servicio = Servicio::where('id', $id)
                            ->where('barberia_id', $request->user()->barberia_id)
                            ->firstOrFail();
        
        // (Podríamos hacer lo mismo con un UpdateServicioRequest, 
        // pero lo dejamos así por ahora para que veas la diferencia)
        $request->validate([
            'nombre' => 'required|string',
            'precio' => 'required|numeric',
            'duracion' => 'required|numeric',
            'imagen' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:2048'
        ]);

        $datosActualizar = [
            'nombre' => $request->nombre,
            'precio' => $request->precio,
            'duracion_minutos' => $request->duracion,
            'descripcion' => $request->descripcion
        ];

        if ($request->hasFile('imagen')) {
            // Borrar la imagen anterior: antes quedaban huérfanas en disco.
            if ($servicio->imagen && Storage::disk('public')->exists($servicio->imagen)) {
                Storage::disk('public')->delete($servicio->imagen);
            }
            $datosActualizar['imagen'] = $request->file('imagen')->store('servicios', 'public');
        }

        $servicio->update($datosActualizar);

        return response()->json($servicio);
    }

    public function destroy(Request $request, $id) {
        $servicio = Servicio::where('id', $id)
                            ->where('barberia_id', $request->user()->barberia_id)
                            ->firstOrFail();

        if ($servicio->imagen && Storage::disk('public')->exists($servicio->imagen)) {
            Storage::disk('public')->delete($servicio->imagen);
        }

        $servicio->delete();
        return response()->json(['mensaje' => 'Servicio eliminado correctamente']);
    }
}