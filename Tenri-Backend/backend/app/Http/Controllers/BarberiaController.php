<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreBarberiaRequest;
use App\Http\Requests\UpdateBarberiaRequest;
use App\Http\Requests\UpdateConfigBarberiaRequest;
use App\Models\Barberia;
use App\Models\Servicio;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class BarberiaController extends Controller
{
    /**
     * Catálogo público de rubros (clave => etiqueta) para poblar los
     * filtros del landing y el select del panel del dueño.
     */
    public function rubros()
    {
        return response()->json(
            collect(Barberia::RUBROS)
                ->map(fn ($etiqueta, $clave) => ['clave' => $clave, 'etiqueta' => $etiqueta])
                ->values()
        );
    }

    public function index(Request $request)
    {
        // Clamp inferior incluido: per_page=0/negativo/no-numérico rompería
        // paginate() con DivisionByZeroError en un endpoint público.
        $porPagina = max(1, min((int) $request->query('per_page', 12), 50));

        return response()->json(
            Barberia::query()
                ->with('servicios:id,barberia_id,nombre')
                ->withAvg(['citas as calificacion_promedio' => fn ($q) => $q->whereNotNull('calificacion')], 'calificacion')
                ->withCount(['citas as total_resenas' => fn ($q) => $q->whereNotNull('calificacion')])
                ->orderBy('nombre')
                ->paginate($porPagina)
        );
    }

    /**
     * Detalle público por slug. El frontend antes buscaba el slug en la
     * página 1 del listado: las barberías 11+ quedaban inaccesibles.
     */
    public function showPorSlug(string $slug)
    {
        return response()->json(
            Barberia::where('slug', $slug)
                ->withAvg(['citas as calificacion_promedio' => fn ($q) => $q->whereNotNull('calificacion')], 'calificacion')
                ->withCount(['citas as total_resenas' => fn ($q) => $q->whereNotNull('calificacion')])
                ->firstOrFail()
        );
    }

    public function store(StoreBarberiaRequest $request)
    {
        $rutaLogo = null;
        if ($request->hasFile('logo')) {
            $rutaLogo = $request->file('logo')->store('logos_barberias', 'public');
        }

        // 🔒 Slug único: el unique de `nombre` no basta — "Barbería VIP" y
        // "Barberia-VIP" son nombres distintos pero colapsan al mismo slug,
        // y el slug es la URL pública (showPorSlug devolvería la equivocada).
        $slugBase = Str::slug($request->nombre_barberia) ?: 'tienda';
        $slug = $slugBase;
        for ($i = 2; Barberia::where('slug', $slug)->exists(); $i++) {
            $slug = "{$slugBase}-{$i}";
        }

        $barberia = Barberia::create([
            'nombre'          => $request->nombre_barberia,
            'slug'            => $slug,
            'color_principal' => $request->color_principal,
            'logo'            => $rutaLogo,
        ]);

        User::create([
            'name'        => $request->admin_nombre,
            'email'       => $request->admin_email,
            'password'    => Hash::make($request->admin_password),
            'rol'         => 'admin',
            'barberia_id' => $barberia->id,
        ]);

        return response()->json([
            'mensaje'  => 'Barbería y administrador creados con éxito',
            'barberia' => $barberia,
        ], 201);
    }

    public function miBarberia(Request $request)
    {
        // El superadmin pasa el middleware role:admin (bypass) pero no tiene
        // barbería asignada: sin este guard, findOrFail(null) revienta en 404.
        if (!$request->user()->barberia_id) {
            return response()->json(['error' => 'Tu cuenta no tiene una barbería asignada.'], 403);
        }

        $barberia = Barberia::findOrFail($request->user()->barberia_id);
        return response()->json($barberia);
    }

    /**
     * Actualiza configuración de la barbería del admin autenticado.
     *
     * 🎯 Pack 2/C: validación migrada a UpdateConfigBarberiaRequest.
     *    Antes: validate() inline con max:43200 (sin mensajes ES).
     *    Ahora: el FormRequest valida tiempo_cancelacion 0-43200 minutos
     *           (30 días) + 4 mensajes en español (required/integer/min/max).
     *
     * 🔧 FIX #4 (PDF): "no se limita el tiempo máximo que se puede
     *    cancelar con anticipación y además da error." Ahora el límite
     *    superior está enforced y el mensaje de error es claro.
     */
    public function updateConfig(UpdateConfigBarberiaRequest $request)
    {
        if (!$request->user()->barberia_id) {
            return response()->json(['error' => 'Tu cuenta no tiene una barbería asignada.'], 403);
        }

        $barberia = Barberia::findOrFail($request->user()->barberia_id);

        // Cada formulario del panel envía solo sus campos ('sometimes' en el
        // FormRequest): aplicamos únicamente lo presente en el request.
        if ($request->has('tiempo_cancelacion')) {
            $barberia->tiempo_cancelacion = $request->tiempo_cancelacion;
        }

        // ── Perfil de la tienda (Mi Tienda) ──
        // El slug NO se regenera al renombrar: es la URL pública y cambiarlo
        // rompería links compartidos y códigos QR ya impresos.
        if ($request->has('nombre')) {
            $barberia->nombre = $request->nombre;
        }
        if ($request->has('rubro')) {
            $barberia->rubro = $request->rubro;
        }
        if ($request->has('color_principal')) {
            $barberia->color_principal = $request->color_principal;
        }
        if ($request->hasFile('logo')) {
            if ($barberia->logo && Storage::disk('public')->exists($barberia->logo)) {
                Storage::disk('public')->delete($barberia->logo);
            }
            $barberia->logo = $request->file('logo')->store('logos_barberias', 'public');
        }

        // Ubicación física (opcional): dirección visible + coordenadas
        // para el "cerca de mí" del landing.
        if ($request->has('direccion')) {
            $barberia->direccion = $request->direccion ?: null;
        }
        if ($request->has('latitud')) {
            $barberia->latitud  = $request->latitud !== null && $request->latitud !== '' ? $request->latitud : null;
            $barberia->longitud = $request->longitud !== null && $request->longitud !== '' ? $request->longitud : null;
        }

        $barberia->save();

        return response()->json([
            'mensaje'  => 'Configuración actualizada correctamente',
            'barberia' => $barberia,
        ]);
    }

    /**
     * 🔧 FIX FASE 1:
     * Endpoint para que el Admin obtenga SU equipo sin tener que
     * mandar el slug hardcodeado ("tenri-barber") como hacía el
     * frontend. Filtra automáticamente por la barbería del admin
     * autenticado.
     */
    public function miEquipo(Request $request)
    {
        // Scope barberos(): incluye al dueño si también atiende (rol dual).
        $barberos = User::barberos()
            ->where('barberia_id', $request->user()->barberia_id)
            ->get();

        return response()->json($barberos);
    }

    /**
     * 🔧 FIX FASE 1:
     * Lo mismo para el catálogo de servicios del admin.
     */
    public function misServicios(Request $request)
    {
        $servicios = Servicio::where('barberia_id', $request->user()->barberia_id)
            ->orderBy('nombre')
            ->get();

        return response()->json($servicios);
    }

    /**
     * Actualizar nombre, color y logo de una barbería (solo superadmin).
     */
    public function update(UpdateBarberiaRequest $request, $id)
    {
        $barberia = Barberia::findOrFail($id);

        $barberia->nombre          = $request->nombre;
        $barberia->color_principal = $request->color_principal;

        // Logo: reemplazar si viene uno nuevo, conservar el actual si no.
        if ($request->hasFile('logo')) {
            // Eliminar logo anterior del disco si existe.
            if ($barberia->logo && Storage::disk('public')->exists($barberia->logo)) {
                Storage::disk('public')->delete($barberia->logo);
            }
            $barberia->logo = $request->file('logo')->store('logos_barberias', 'public');
        }

        $barberia->save();

        return response()->json([
            'mensaje'  => 'Barbería actualizada correctamente.',
            'barberia' => $barberia,
        ]);
    }

    /**
     * Eliminar una barbería permanentemente (solo superadmin).
     * Las FKs con cascadeOnDelete() limpian automáticamente:
     * usuarios asignados, servicios, citas y bloqueos de esa barbería.
     */
    public function destroy($id)
    {
        $barberia = Barberia::findOrFail($id);
        $nombre   = $barberia->nombre;

        // Limpiar logo del disco antes del delete (evita archivo huérfano).
        if ($barberia->logo && Storage::disk('public')->exists($barberia->logo)) {
            Storage::disk('public')->delete($barberia->logo);
        }

        $barberia->delete();

        return response()->json([
            'mensaje' => "Barbería '{$nombre}' eliminada permanentemente junto con sus servicios, citas y personal asignado.",
        ]);
    }
}
