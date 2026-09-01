<?php

namespace App\Http\Controllers;

use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Http\Requests\UpdatePerfilRequest;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

class AuthController extends Controller
{
    public function register(RegisterRequest $request)
    {
        $user = User::create([
            'name'     => $request->name,
            'email'    => $request->email,
            'password' => Hash::make($request->password),
            'rol'      => 'cliente',
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'access_token' => $token,
            'user'         => $this->withAvatarUrl($user),
        ], 201);
    }

    public function login(LoginRequest $request)
    {
        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Credenciales incorrectas'], 401);
        }

        // 🎯 Pack 3: rechazar login de usuarios suspendidos.
        if ($user->suspendido) {
            return response()->json([
                'message' => 'Tu cuenta está suspendida. Contacta al administrador.',
            ], 403);
        }

        // Barbería suspendida: sus admins y barberos no entran. Los clientes
        // no tienen barbería propia y no se ven afectados, y el superadmin
        // queda exento — es quien tiene que poder entrar a reactivarla.
        if ($user->rol !== 'superadmin' && $user->barberia_id !== null && ! $user->barberia()->activas()->exists()) {
            return response()->json([
                'message' => 'La barbería de tu cuenta está suspendida. Contacta al administrador.',
            ], 403);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'access_token' => $token,
            'user'         => $this->withAvatarUrl($user),
        ]);
    }

    /**
     * 🆕 FIX FASE 1:
     * Endpoint logout que revoca el token actual del usuario.
     * Antes el frontend solo borraba el token del localStorage,
     * dejando el token "huérfano" pero válido en el servidor.
     */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['mensaje' => 'Sesión cerrada correctamente.']);
    }

    /**
     * Actualiza el perfil del usuario autenticado.
     *
     * 🎯 Pack 2/C: el FormRequest UpdatePerfilRequest ya:
     *    - Valida con reglas alineadas (Pack 1/Pack 2): email rfc,dns,filter,
     *      password min:8+regex, avatar mimes consistentes, name max:80.
     *    - Incluye bio/especialidad SOLO si el rol del usuario es barbero
     *      (reglas condicionales en UpdatePerfilRequest::rules()).
     *
     * 🔧 FIX #15 (PDF): "Barbero no puede cambiar su propia foto de perfil".
     *    En realidad la foto ya podía cambiarse vía este endpoint. Lo que
     *    faltaba era persistir bio y especialidad cuando el barbero los
     *    edita desde su propia página /barbero/perfil (Bloque E del Pack 2).
     *    Ahora ambos campos se guardan si llegan y el rol es 'barbero'.
     *
     * Patrón:
     *    - $request->validated() para campos del body (filtra todo lo no
     *      validado, evita mass assignment de cualquier campo extra).
     *    - $request->hasFile/file para el avatar (multipart, no llega
     *      vía validated()).
     */
    public function updatePerfil(UpdatePerfilRequest $request)
    {
        $user = $request->user();
        $validated = $request->validated();

        // Campos base — siempre presentes (required en el FormRequest).
        $user->name  = $validated['name'];
        $user->email = $validated['email'];

        // Password opcional. Solo se hashea si viene presente y no vacío.
        if (!empty($validated['password'])) {
            $user->password = Hash::make($validated['password']);
        }

        // Avatar — multipart, se lee directo del request (no de validated).
        if ($request->hasFile('avatar')) {
            if ($user->avatar && Storage::disk('public')->exists($user->avatar)) {
                Storage::disk('public')->delete($user->avatar);
            }
            $user->avatar = $request->file('avatar')->store('avatares', 'public');
        }

        // 🔧 FIX #15: bio y especialidad solo para barbero.
        // Doble check defensa-en-profundidad: el FormRequest ya filtra
        // estos campos por rol, pero validamos el rol aquí también para
        // prevenir cualquier bypass futuro de la validación.
        if ($user->rol === 'barbero') {
            if (array_key_exists('bio', $validated)) {
                $user->bio = $validated['bio'];
            }
            if (array_key_exists('especialidad', $validated)) {
                $user->especialidad = $validated['especialidad'];
            }
        }

        $user->save();

        return response()->json([
            'mensaje' => 'Perfil actualizado con éxito',
            'user'    => $this->withAvatarUrl($user),
        ]);
    }

    /**
     * Helper privado: anexa avatar_url al usuario antes de devolverlo.
     */
    private function withAvatarUrl(User $user): User
    {
        if ($user->avatar) {
            $user->avatar_url = asset('storage/' . $user->avatar);
        }
        return $user;
    }
}
