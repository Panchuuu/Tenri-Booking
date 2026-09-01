<?php

namespace App\Http\Controllers;

use App\Models\Cita;
use App\Models\User;
use App\Mail\CitaCanceladaMail;
use App\Http\Requests\AsignarRolRequest;
use App\Http\Requests\UpdateBarberoRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

class BarberoController extends Controller
{
    /**
     * 🎨 FASE 4A: incluye avatar_url, bio, especialidad y rating.
     */
    public function index(Request $request)
    {
        // Scope barberos(): rol puro + dueños que también atienden.
        $query = User::barberos();

        if ($request->filled('barberia')) {
            $query->whereHas('barberia', fn ($q) => $q->where('slug', $request->barberia));
        }

        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $request->validate([
            'name'     => 'required|string|max:80',
            'email'    => 'required|email:rfc,dns,filter|max:120|unique:users',
            'password' => 'required|min:8',
        ]);

        $usuario = User::create([
            'name'        => $request->name,
            'email'       => $request->email,
            'password'    => bcrypt($request->password),
            'rol'         => 'barbero',
            'barberia_id' => $request->user()->barberia_id,
        ]);

        return response()->json(['mensaje' => 'Barbero creado', 'barbero' => $usuario], 201);
    }

    /**
     * Asignar rol de barbero a un usuario existente.
     *
     * 🎯 Pack 2/C: validación migrada a AsignarRolRequest (FormRequest).
     * Antes: validate() inline + mensaje custom para email.exists.
     * Ahora: el FormRequest valida email (rfc,dns,filter,max:120,exists)
     *        + cross-field hora_fin > hora_inicio (FIX #10)
     *        + 6 mensajes en español cubriendo todos los casos.
     */
    public function asignarRol(AsignarRolRequest $request)
    {
        // El FormRequest ya validó. Llegamos aquí solo si email existe
        // y los horarios son consistentes.
        $usuario = User::where('email', $request->email)->firstOrFail();

        // 🔒 Reglas de reclutamiento: solo se puede sumar al equipo a un
        // cliente, o re-asignar a un barbero que YA es de esta barbería
        // (actualiza sus horarios). Sin esto, un admin podía "capturar"
        // por email a admins de otros negocios (dejándolos sin panel),
        // robarse barberos de la competencia o degradar a un superadmin.
        $esCliente  = $usuario->rol === 'cliente';
        $esMiBarbero = $usuario->rol === 'barbero'
            && $usuario->barberia_id === $request->user()->barberia_id;
        // 🧢 Rol dual: el dueño (admin de ESTA barbería) puede sumarse al
        // equipo sin perder su panel — se marca es_barbero en vez de
        // cambiarle el rol. Cubre también re-asignaciones de horario.
        $esAdminDeMiBarberia = $usuario->rol === 'admin'
            && $usuario->barberia_id === $request->user()->barberia_id;

        if (!$esCliente && !$esMiBarbero && !$esAdminDeMiBarberia) {
            return response()->json([
                'error' => 'Ese usuario no está disponible para unirse a tu equipo.',
            ], 422);
        }

        if ($usuario->suspendido) {
            return response()->json([
                'error' => 'Ese usuario está suspendido y no puede unirse a tu equipo.',
            ], 422);
        }

        if ($esAdminDeMiBarberia) {
            $usuario->es_barbero = true; // conserva rol admin y su panel
        } else {
            $usuario->rol         = 'barbero';
            $usuario->barberia_id = $request->user()->barberia_id;
        }

        if ($request->filled('hora_inicio')) $usuario->hora_inicio = $request->hora_inicio;
        if ($request->filled('hora_fin'))    $usuario->hora_fin    = $request->hora_fin;

        $usuario->save();

        return response()->json(['mensaje' => 'Rol asignado', 'barbero' => $usuario]);
    }

    public function update(UpdateBarberoRequest $request, $id)
    {
        $usuario = User::findOrFail($id);

        if ($usuario->barberia_id !== $request->user()->barberia_id) {
            return response()->json(['error' => 'No tienes permiso sobre este barbero.'], 403);
        }

        // 🔒 Este endpoint gestiona BARBEROS. Sin el check, un admin podía
        // editar (o abajo, degradar a cliente) a otro admin de su misma
        // barbería, o a sí mismo, vía un request directo.
        // 🧢 Rol dual: un admin con es_barbero SÍ es editable aquí (su
        // ficha de barbero: horario, bio, especialidad, foto).
        if (!$usuario->esBarberoActivo()) {
            return response()->json(['error' => 'Solo puedes gestionar cuentas de barberos.'], 403);
        }

        if ($request->filled('name'))        $usuario->name        = $request->name;
        if ($request->filled('hora_inicio')) $usuario->hora_inicio = $request->hora_inicio;
        if ($request->filled('hora_fin'))    $usuario->hora_fin    = $request->hora_fin;
        if ($request->has('bio'))            $usuario->bio          = $request->bio;
        if ($request->has('especialidad'))   $usuario->especialidad = $request->especialidad;

        if ($request->hasFile('avatar')) {
            if ($usuario->avatar && Storage::disk('public')->exists($usuario->avatar)) {
                Storage::disk('public')->delete($usuario->avatar);
            }
            $usuario->avatar = $request->file('avatar')->store('avatares', 'public');
        }

        $usuario->save();

        return response()->json(['mensaje' => 'Barbero actualizado', 'barbero' => $usuario]);
    }

    /**
     * ============================================================
     * 🔧 FIX #17: al remover un barbero, CANCELAR todas sus citas
     *             pendientes/confirmadas + avisar a los clientes
     * ============================================================
     * Antes: el destroy solo cambiaba el rol → quedaban citas huérfanas
     *        que el cliente todavía veía como "pendientes" y podía
     *        intentar reagendar.
     *
     * Ahora:
     *   1. Buscamos todas las citas no-finalizadas del barbero
     *   2. Las marcamos como "cancelada" en una transacción
     *   3. Enviamos email al cliente de cada cita cancelada
     *   4. Removemos al barbero del equipo
     * ============================================================
     */
    public function destroy(Request $request, $id)
    {
        $usuario = User::findOrFail($id);

        if ($usuario->barberia_id !== $request->user()->barberia_id) {
            return response()->json(['error' => 'No tienes permiso.'], 403);
        }

        // 🔒 Mismo guard que update(): remover solo aplica a barberos.
        if (!$usuario->esBarberoActivo()) {
            return response()->json(['error' => 'Solo puedes gestionar cuentas de barberos.'], 403);
        }

        // Buscamos citas activas (no finalizadas ni canceladas) del barbero
        $citasActivas = Cita::with(['cliente', 'servicio'])
            ->where('barbero_id', $usuario->id)
            ->whereNotIn('estado', ['finalizada', 'cancelada'])
            ->get();

        $cantidadCanceladas = $citasActivas->count();

        DB::transaction(function () use ($usuario, $citasActivas) {
            foreach ($citasActivas as $cita) {
                $cita->estado = 'cancelada';
                $cita->save();
            }

            if ($usuario->rol === 'admin') {
                // 🧢 Rol dual: el dueño deja de atender, pero conserva
                // su rol admin y su barbería.
                $usuario->es_barbero = false;
            } else {
                // Despasamos al barbero a cliente normal
                $usuario->rol         = 'cliente';
                $usuario->barberia_id = null;
            }
            $usuario->save();
        });

        // 📧 Los correos se encolan DESPUÉS del commit: si la transacción
        // fallara, ningún cliente recibiría un aviso de una cancelación
        // que nunca ocurrió. Como CitaCanceladaMail es ShouldQueue, send()
        // solo encola el job; un fallo SMTP real se vería en el worker,
        // no aquí (este catch cubre solo fallos al encolar).
        foreach ($citasActivas as $cita) {
            try {
                if ($cita->cliente && $cita->cliente->email) {
                    Mail::to($cita->cliente->email)->send(new CitaCanceladaMail($cita));
                }
            } catch (\Throwable $e) {
                \Log::warning("Error al encolar email cita #{$cita->id}: " . $e->getMessage());
            }
        }

        return response()->json([
            'mensaje'             => 'Barbero removido del equipo',
            'citas_canceladas'    => $cantidadCanceladas,
            'detalle'             => $cantidadCanceladas > 0
                ? "Se cancelaron {$cantidadCanceladas} citas activas y se notificará a los clientes por correo."
                : 'El barbero no tenía citas activas.',
        ]);
    }
}
