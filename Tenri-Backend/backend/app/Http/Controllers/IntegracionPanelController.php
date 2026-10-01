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
                $b->setAttribute('barberos_count', $b->quienesAtienden()->count());

                return $b;
            });

        return response()->json([
            'schema' => self::SCHEMA,
            'barberias' => $barberias,
        ]);
    }

    /**
     * Da de alta una barbería nueva, con su usuario administrador.
     *
     * Lo dispara una compra en tenri.cl: el panel ya cobró y ya generó una
     * contraseña al azar para el admin (la manda acá, cifrada por el canal
     * firmado; el correo con esa contraseña lo envía el panel, no acá). Este
     * lado solo crea lo que StoreBarberiaRequest exige del lado del
     * superadmin manual -incluido el mismo `unique` de nombre y de correo-
     * porque es la misma operación con dos puertas de entrada distintas.
     */
    public function crearBarberia(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'nombre_barberia' => 'required|string|min:3|max:60|unique:barberias,nombre',
            'color_principal' => 'required|string|max:20',
            'admin_nombre' => 'required|string|min:2|max:80',

            /**
             * Sin la regla `dns`, a diferencia del alta manual del superadmin.
             *
             * Acá el correo no lo tipea nadie en este momento: o viene de una
             * cuenta de tenri.cl que ya se validó al registrarse, o de un
             * formulario del panel que ya lo validó allá. Consultar DNS sería
             * meter una llamada de red en el camino de una compra ya cobrada, y
             * un DNS lento o caído dejaría al cliente pagado y sin tienda.
             */
            'admin_email' => 'required|string|email:rfc,filter|max:120',

            // Una de las dos, no las dos. La compra en tenri.cl manda el hash
            // de la cuenta del comprador; el alta manual manda una generada.
            'admin_password' => ['required_without:admin_password_hash', 'missing_with:admin_password_hash', 'string', 'min:8'],
            'admin_password_hash' => ['required_without:admin_password', 'string', 'max:255'],

            'plan' => 'sometimes|string|max:40',
        ], [
            /**
             * En español y explicando qué hacer.
             *
             * Este mensaje no se queda acá: viaja al panel de tenri.cl, donde
             * lo lee la persona que tiene que resolver una compra cobrada sin
             * tienda, y puede terminar frente al comprador. El texto por
             * defecto de Laravel ("The nombre barberia has already been taken")
             * no le sirve a ninguno de los dos.
             */
            'nombre_barberia.unique' => 'Ese nombre de tienda ya está tomado por otro local. Hay que elegir otro.',
            'nombre_barberia.required' => 'Falta el nombre de la tienda.',
            'nombre_barberia.min' => 'El nombre de la tienda necesita al menos 3 letras.',
            'nombre_barberia.max' => 'El nombre de la tienda no puede pasar de 60 caracteres.',
            'admin_email.email' => 'El correo del administrador no tiene un formato válido.',
            'admin_nombre.required' => 'Falta el nombre del administrador.',
            'color_principal.required' => 'Falta el color principal de la tienda.',
        ]);

        ['barberia' => $barberia, 'admin_creado' => $adminCreado] = Barberia::crearConAdmin($datos);

        return response()->json([
            'schema' => self::SCHEMA,
            'barberia' => $barberia->fresh(),

            // False cuando el correo ya tenia cuenta y este local se le sumo a
            // los que ya tiene: conserva su contrasena, asi que el correo de
            // bienvenida no debe mandarle una nueva.
            'admin_creado' => $adminCreado,
        ], 201);
    }

    /**
     * Si un nombre de tienda está libre, y con qué dirección pública quedaría.
     *
     * Lo consulta el checkout de tenri.cl mientras el comprador escribe: el
     * nombre se pide **antes** de pagar, así que el formulario tiene que poder
     * decir la verdad ahí mismo y no después del cobro.
     *
     * Ojo con lo que esto **no** es: una reserva. Entre esta consulta y el alta
     * pasa el pago entero -minutos con tarjeta, días con transferencia- y en el
     * medio el nombre se puede ocupar. Quien provisiona tiene que seguir
     * tratando el 422 del alta como un caso posible.
     */
    public function nombreDisponible(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'nombre' => 'required|string|min:3|max:60',

        ]);

        $nombre = trim($datos['nombre']);

        return response()->json([
            'schema' => self::SCHEMA,
            'disponible' => ! Barberia::where('nombre', $nombre)->exists(),
            'slug' => Barberia::slugDisponible($nombre),
        ]);
    }

    /**
     * Le copia a un admin la contraseña que acaba de poner en tenri.cl.
     *
     * Su cuenta de acá se creó con el hash de la de allá, así que si cambia una
     * y no la otra, la promesa -"entras con las mismas credenciales"- se rompe
     * en silencio y sin que nadie se entere hasta el próximo login.
     *
     * Se identifica por local **y** correo, no solo por correo: el panel sabe
     * qué tienda compró esa persona, y así una sincronización no puede tocar
     * una cuenta que no sea la de esa tienda. Un superadmin no se sincroniza
     * nunca: su acceso no depende de tenri.cl.
     */
    public function sincronizarPassword(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'barberia_id' => 'required|integer',
            'email' => 'required|string|email:rfc,filter|max:120',
            'password_hash' => 'required|string|max:255',
        ]);

        $usuario = User::where('email', $datos['email'])
            ->where('barberia_id', $datos['barberia_id'])
            ->where('rol', '!=', 'superadmin')
            ->first();

        if (! $usuario) {
            // No es un error: la cuenta pudo cambiar de correo o de local. El
            // puente lo registra y sigue.
            return response()->json(['schema' => self::SCHEMA, 'sincronizado' => false]);
        }

        $usuario->forceFill(['password' => $datos['password_hash']])->save();

        return response()->json(['schema' => self::SCHEMA, 'sincronizado' => true]);
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
