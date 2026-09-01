<?php

namespace App\Http\Controllers;

use App\Models\Barberia;
use App\Models\Cita;
use App\Models\Servicio;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Lo que el panel de tenri.cl ve y administra de esta plataforma.
 *
 * Canal server-to-server: no hay usuario autenticado — la request viene del
 * backend del panel, firmada con HMAC (middleware `firma.panel`). Por eso los
 * guards de "no puedes modificarte a ti mismo" del SuperAdminUsuarioController
 * no aplican acá: no hay un "yo" que proteger. El resto de las invariantes se
 * conserva: revocar tokens al suspender, roles válidos, no borrar con citas.
 *
 * `schema` versiona la forma del payload: si esta cambia de forma incompatible,
 * se sube el número y el panel viejo lo detecta en vez de leer mal.
 */
class IntegracionPanelController extends Controller
{
    public const SCHEMA = 1;

    /** Los roles que existen en la plataforma; espejo de ActualizarRolUsuarioRequest. */
    private const ROLES = ['superadmin', 'admin', 'barbero', 'cliente'];

    /** La foto de métricas de la plataforma completa, para el panel y su sondeo. */
    public function metricas(): JsonResponse
    {
        $hoy = now()->toDateString();
        $hace30 = now()->subDays(30)->toDateString();

        return response()->json([
            'schema' => self::SCHEMA,
            'generated_at' => now()->toIso8601String(),
            'app' => [
                'version' => config('app.version'),
            ],
            'users' => [
                'total' => User::count(),
                'clientes' => User::where('rol', 'cliente')->count(),
                // El scope y no `rol = 'barbero'`: el rol dual (admin que
                // atiende) también cuenta como barbero.
                'barberos' => User::barberos()->count(),
                'admins' => User::where('rol', 'admin')->count(),
                'suspendidos' => User::where('suspendido', true)->count(),
                'nuevos_30d' => User::where('created_at', '>=', now()->subDays(30))->count(),
            ],
            'content' => [
                'barberias' => Barberia::count(),
                'barberias_activas' => Barberia::activas()->count(),
                'servicios' => Servicio::count(),
                'citas' => Cita::count(),
                // Canceladas fuera: una agenda que se llenó y se vació no es
                // actividad del negocio.
                'citas_30d' => Cita::where('fecha', '>=', $hace30)->where('estado', '!=', 'cancelada')->count(),
                'citas_hoy' => Cita::where('fecha', $hoy)->where('estado', '!=', 'cancelada')->count(),
            ],
            'ratings' => [
                'promedio' => ($prom = Cita::whereNotNull('calificacion')->avg('calificacion')) !== null
                    ? round((float) $prom, 2)
                    : null,
                'total' => Cita::whereNotNull('calificacion')->count(),
            ],
        ]);
    }

    /** Las barberías con los conteos que la pantalla de gestión dibuja. */
    public function barberias(): JsonResponse
    {
        $hace30 = now()->subDays(30)->toDateString();

        $barberias = Barberia::query()
            ->withCount([
                'usuarios',
                'citas',
                'citas as citas_30d' => fn ($q) => $q->where('fecha', '>=', $hace30)->where('estado', '!=', 'cancelada'),
                'citas as total_resenas' => fn ($q) => $q->whereNotNull('calificacion'),
            ])
            ->withAvg(['citas as calificacion_promedio' => fn ($q) => $q->whereNotNull('calificacion')], 'calificacion')
            ->orderBy('nombre')
            ->get()
            ->map(function (Barberia $b) {
                // barberos_count por barbería usa la misma regla del rol dual
                // que el conteo global; hasMany + scope no se combinan en un
                // withCount sin duplicar la condición, así que va aparte.
                $b->setAttribute('barberos_count', User::barberos()->where('barberia_id', $b->id)->count());

                return $b;
            });

        return response()->json([
            'schema' => self::SCHEMA,
            'barberias' => $barberias,
        ]);
    }

    /**
     * Suspende o reactiva una barbería (toggle).
     *
     * Suspender no borra nada: la barbería sale del listado público, deja de
     * aceptar reservas y sus usuarios pierden el acceso (login bloqueado y
     * tokens revocados). Todo se revierte al reactivar — a diferencia del
     * DELETE de superadmin, que arrastra usuarios y citas en cascada y por eso
     * no se expone por este canal.
     */
    public function toggleSuspensionBarberia(int $id): JsonResponse
    {
        $barberia = Barberia::findOrFail($id);

        $barberia->alternarSuspension();

        return response()->json([
            'schema' => self::SCHEMA,
            'barberia' => $barberia->fresh(),
        ]);
    }

    /**
     * Los usuarios de la plataforma, paginados.
     *
     * Misma consulta que SuperAdminUsuarioController@index, con los filtros
     * llegando en el cuerpo firmado en vez del query string (la firma cubre el
     * cuerpo; el query string quedaría fuera de ella).
     */
    public function usuarios(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'page' => 'sometimes|integer|min:1',
            'buscar' => 'sometimes|string|max:120',
            'rol' => 'sometimes|string|in:'.implode(',', self::ROLES),
        ]);

        $query = User::with('barberia:id,nombre')
            ->select('id', 'name', 'email', 'rol', 'suspendido', 'barberia_id', 'avatar', 'created_at');

        if (! empty($datos['rol'])) {
            $query->where('rol', $datos['rol']);
        }

        if (! empty($datos['buscar'])) {
            $query->where(function ($q) use ($datos) {
                $q->where('name', 'like', '%'.$datos['buscar'].'%')
                  ->orWhere('email', 'like', '%'.$datos['buscar'].'%');
            });
        }

        $usuarios = $query->orderBy('created_at', 'desc')
            ->paginate(15, ['*'], 'page', $datos['page'] ?? 1);

        return response()->json([
            'schema' => self::SCHEMA,
            'usuarios' => $usuarios,
        ]);
    }

    /** Cambia el rol de un usuario. Las citas y la barbería quedan como están. */
    public function cambiarRolUsuario(Request $request, int $id): JsonResponse
    {
        $datos = $request->validate(
            ['rol' => 'required|string|in:'.implode(',', self::ROLES)],
            ['rol.in' => 'El rol elegido no existe.', 'rol.required' => 'Falta indicar el rol.'],
        );

        $usuario = User::findOrFail($id);
        $usuario->rol = $datos['rol'];
        $usuario->save();

        return response()->json([
            'schema' => self::SCHEMA,
            'usuario' => $usuario,
        ]);
    }

    /** Suspende o reactiva un usuario (toggle). Al suspender se revocan sus tokens. */
    public function toggleSuspensionUsuario(int $id): JsonResponse
    {
        $usuario = User::findOrFail($id);

        $usuario->suspendido = ! $usuario->suspendido;
        $usuario->save();

        if ($usuario->suspendido) {
            $usuario->tokens()->delete();
        }

        return response()->json([
            'schema' => self::SCHEMA,
            'usuario' => $usuario,
        ]);
    }
}
