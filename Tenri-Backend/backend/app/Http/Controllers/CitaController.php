<?php

namespace App\Http\Controllers;

use App\Models\BloqueoHorario;
use App\Models\Cita;
use App\Models\Servicio;
use App\Models\User;
use App\Mail\CitaCanceladaMail;
use App\Mail\CitaConfirmadaMail;
use App\Mail\NuevaCitaBarberoMail;
use App\Http\Requests\StoreCitaRequest;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\DB;

/**
 * ============================================================
 * CitaController — Pack 1 de fixes
 * ============================================================
 * Cambios respecto a Fase 4A:
 *   - FIX #13: límite de 90 días futuros en reagendar (igual que store)
 *   - FIX #13: al reagendar NO se sobrescribe el estado (si era
 *              "pendiente", queda pendiente; antes pasaba a "confirmada"
 *              porque el front lo enviaba en otro endpoint)
 *   - FIX #14: barbero puede cancelar sus propias citas confirmadas
 *              vía updateEstado() con permiso explícito
 * ============================================================
 */
class CitaController extends Controller
{
    // Turno por defecto cuando el barbero no tiene horario configurado.
    // Única fuente de verdad para errorFueraDeTurno() y disponibilidad().
    private const TURNO_INICIO_DEFAULT = '10:00';
    private const TURNO_FIN_DEFAULT    = '19:00';

    public function index(Request $request)
    {
        $query = Cita::with(['cliente', 'barbero', 'servicio'])
            ->where('barberia_id', $request->user()->barberia_id);

        if ($request->filled('desde'))      $query->whereDate('fecha', '>=', $request->desde);
        if ($request->filled('hasta'))      $query->whereDate('fecha', '<=', $request->hasta);
        if ($request->filled('barbero_id')) $query->where('barbero_id', $request->barbero_id);
        if ($request->filled('estado'))     $query->where('estado', $request->estado);

        if ($request->filled('q')) {
            $q = $request->q;
            $query->whereHas('cliente', fn ($sub) =>
                $sub->where('name', 'like', "%{$q}%")->orWhere('email', 'like', "%{$q}%")
            );
        }

        $citas = $query->orderBy('fecha', 'desc')->orderBy('hora', 'asc')
            ->paginate(10)->withQueryString();

        return response()->json($citas);
    }

    public function store(StoreCitaRequest $request)
    {
        $servicioNuevo = Servicio::findOrFail($request->servicio_id);

        // 🚫 Bloqueos
        $tieneBloqueo = BloqueoHorario::where('barbero_id', $request->barbero_id)
            ->activoEnFecha($request->fecha)->exists();

        if ($tieneBloqueo) {
            return response()->json([
                'message' => 'El barbero no está disponible en esa fecha. Por favor, elige otro día.',
            ], 409);
        }

        $horaInicio = Carbon::parse($request->hora);
        $horaFin    = $horaInicio->copy()->addMinutes($servicioNuevo->duracion);

        // La transacción + lockForUpdate sobre el barbero serializa las reservas
        // concurrentes: dos requests al mismo slot ya no pueden pasar ambos el
        // chequeo de solapamiento antes de insertar.
        $resultado = DB::transaction(function () use ($request, $servicioNuevo, $horaInicio, $horaFin) {
            $barbero = User::where('id', $request->barbero_id)->lockForUpdate()->first();

            if ($error = $this->errorFueraDeTurno($barbero, $horaInicio, $horaFin)) {
                return ['error' => $error, 'status' => 422];
            }

            // 🛡️ Anti-choques
            if ($this->haySolape($request->barbero_id, $request->fecha, $horaInicio, $horaFin)) {
                return [
                    'error'  => '¡Ups! Este horario acaba de ser reservado por otro cliente.',
                    'status' => 409,
                ];
            }

            $cita = Cita::create([
                'cliente_id'  => $request->user()->id,
                'barbero_id'  => $request->barbero_id,
                'servicio_id' => $request->servicio_id,
                'fecha'       => $request->fecha,
                'hora'        => $request->hora,
                'estado'      => 'confirmada',
                'barberia_id' => $servicioNuevo->barberia_id,
            ]);

            return ['cita' => $cita];
        });

        if (isset($resultado['error'])) {
            return response()->json(['message' => $resultado['error']], $resultado['status']);
        }

        $cita = $resultado['cita'];

        $cita->load(['barbero', 'servicio', 'cliente']);

        try {
            Mail::to($request->user()->email)->send(new CitaConfirmadaMail($cita));
            Mail::to($cita->barbero->email)->send(new NuevaCitaBarberoMail($cita));
        } catch (\Throwable $e) {
            \Log::warning('Cita creada OK pero fallaron correos: ' . $e->getMessage());
        }

        return response()->json($cita, 201);
    }

    public function misReservas(Request $request)
    {
        $citas = Cita::with(['barbero', 'servicio.barberia'])
            ->where('cliente_id', $request->user()->id)
            ->orderBy('fecha', 'desc')->orderBy('hora', 'desc')->get();

        return response()->json($citas);
    }

    public function resumenFinancieroHoy(Request $request)
    {
        return $this->resumenPorPeriodo($request, 'hoy');
    }

    public function resumenPorPeriodo(Request $request, $periodoDefault = null)
    {
        $periodo = $request->query('periodo', $periodoDefault ?? 'hoy');

        if ($request->filled('desde') && $request->filled('hasta')) {
            $desde   = Carbon::parse($request->desde)->startOfDay();
            $hasta   = Carbon::parse($request->hasta)->endOfDay();
            $periodo = 'custom';
        } else {
            switch ($periodo) {
                case 'semana':
                    $desde = Carbon::now()->startOfWeek();
                    $hasta = Carbon::now()->endOfWeek();
                    break;
                case 'mes':
                    $desde = Carbon::now()->startOfMonth();
                    $hasta = Carbon::now()->endOfMonth();
                    break;
                case 'hoy':
                default:
                    $desde = Carbon::now()->startOfDay();
                    $hasta = Carbon::now()->endOfDay();
                    break;
            }
        }

        $citas = Cita::with(['servicio', 'barbero'])
            ->where('barberia_id', $request->user()->barberia_id)
            ->whereBetween('fecha', [$desde->toDateString(), $hasta->toDateString()])
            ->where('estado', 'finalizada')->get();

        $total = 0;
        $desgloseBarberos = [];
        $desglosePorDia   = [];

        foreach ($citas as $c) {
            if ($c->servicio && $c->barbero) {
                $precio = (int) $c->servicio->precio;
                $total += $precio;
                $desgloseBarberos[$c->barbero->name] = ($desgloseBarberos[$c->barbero->name] ?? 0) + $precio;
                $desglosePorDia[$c->fecha] = ($desglosePorDia[$c->fecha] ?? 0) + $precio;
            }
        }

        ksort($desglosePorDia);

        return response()->json([
            'periodo'           => $periodo,
            'desde'             => $desde->toDateString(),
            'hasta'             => $hasta->toDateString(),
            'cantidad_cortes'   => $citas->count(),
            'total_ingresos'    => $total,
            'desglose_barberos' => $desgloseBarberos,
            'desglose_por_dia'  => $desglosePorDia,
            'fecha'             => $desde->toDateString(),
        ]);
    }

    /**
     * 🔄 Reagendar cita.
     *
     * 🔧 FIX #13: límite 90 días futuros + el estado se mantiene
     *             (no se sobrescribe a "confirmada" automáticamente).
     */
    public function reagendar(Request $request, $id)
    {
        $fechaMaxima = now()->addDays(90)->toDateString();

        $request->validate([
            'fecha' => "required|date|after_or_equal:today|before_or_equal:{$fechaMaxima}",
            'hora'  => 'required|date_format:H:i',
        ], [
            'fecha.after_or_equal'  => 'No puedes reagendar a una fecha pasada.',
            'fecha.before_or_equal' => 'Solo puedes reagendar hasta 90 días en el futuro.',
            'hora.date_format'      => 'La hora debe tener formato HH:MM.',
        ]);

        $user = $request->user();
        $cita = Cita::with('servicio')->findOrFail($id);

        // Permisos
        if ($user->rol === 'cliente' && $cita->cliente_id !== $user->id) {
            return response()->json(['error' => 'No puedes reagendar esta cita.'], 403);
        }
        if ($user->rol === 'admin' && $cita->barberia_id !== $user->barberia_id) {
            return response()->json(['error' => 'No tienes permiso sobre esta cita.'], 403);
        }
        if ($user->rol === 'barbero' && $cita->barbero_id !== $user->id) {
            return response()->json(['error' => 'Esta cita no te pertenece.'], 403);
        }

        if (in_array($cita->estado, ['finalizada', 'cancelada'])) {
            return response()->json(['error' => 'Esta cita ya no se puede modificar.'], 400);
        }

        // Bloqueos
        $tieneBloqueo = BloqueoHorario::where('barbero_id', $cita->barbero_id)
            ->activoEnFecha($request->fecha)->exists();
        if ($tieneBloqueo) {
            return response()->json([
                'error' => 'El barbero no está disponible en esa fecha. Elige otra.',
            ], 409);
        }

        $nuevoInicio = Carbon::parse($request->hora);
        $nuevoFin    = $nuevoInicio->copy()->addMinutes($cita->servicio->duracion ?? 30);

        // Mismo lock que en store(): serializa reservas/reagendos concurrentes
        // sobre el mismo barbero para evitar la doble reserva.
        $resultado = DB::transaction(function () use ($request, $cita, $nuevoInicio, $nuevoFin) {
            $barbero = User::where('id', $cita->barbero_id)->lockForUpdate()->first();

            if ($error = $this->errorFueraDeTurno($barbero, $nuevoInicio, $nuevoFin)) {
                return ['error' => $error, 'status' => 422];
            }

            // Anti-choques (excluyendo ESTA cita)
            if ($this->haySolape($cita->barbero_id, $request->fecha, $nuevoInicio, $nuevoFin, $cita->id)) {
                return [
                    'error'  => 'Ese horario ya está reservado para otra cita.',
                    'status' => 409,
                ];
            }

            // 🔧 FIX #13: NO sobrescribimos el estado. Si era pendiente queda pendiente.
            $cita->fecha = $request->fecha;
            $cita->hora  = $request->hora;
            $cita->save();

            return [];
        });

        if (isset($resultado['error'])) {
            return response()->json(['error' => $resultado['error']], $resultado['status']);
        }

        $cita->load(['cliente', 'barbero', 'servicio']);

        return response()->json([
            'message' => 'Cita reagendada con éxito',
            'cita'    => $cita,
        ]);
    }

    /**
     * 📝 Cambiar estado de una cita.
     *
     * 🔧 FIX #14: barbero puede cancelar sus citas confirmadas/pendientes.
     *             Antes solo el admin podía cambiar estados.
     *
     * Reglas:
     *  - Admin: cualquier transición sobre citas de su barbería
     *  - Barbero: solo puede finalizar/cancelar sus propias citas
     *  - Cliente: no puede usar este endpoint (usa cancelarMiCita)
     */
    public function updateEstado(Request $request, $id)
    {
        $request->validate([
            'estado' => 'required|in:pendiente,confirmada,finalizada,cancelada',
        ]);

        $user = $request->user();
        $cita = Cita::findOrFail($id);

        // Cliente no puede usar este endpoint
        if ($user->rol === 'cliente') {
            return response()->json(['error' => 'Usa el endpoint de cancelación de cliente.'], 403);
        }

        // Admin: misma barbería
        if ($user->rol === 'admin' && $cita->barberia_id !== $user->barberia_id) {
            return response()->json(['error' => 'No tienes permiso sobre esta cita.'], 403);
        }

        // 🔧 FIX #14: barbero puede cancelar/finalizar SUS citas
        if ($user->rol === 'barbero') {
            if ($cita->barbero_id !== $user->id) {
                return response()->json(['error' => 'Esta cita no te pertenece.'], 403);
            }
            // Solo permitimos transiciones razonables
            $transicionesPermitidas = ['confirmada', 'finalizada', 'cancelada'];
            if (!in_array($request->estado, $transicionesPermitidas)) {
                return response()->json([
                    'error' => 'Como barbero solo puedes confirmar, finalizar o cancelar.',
                ], 403);
            }
            // No re-modificar finalizadas
            if (in_array($cita->estado, ['finalizada', 'cancelada'])) {
                return response()->json(['error' => 'Esta cita ya no se puede modificar.'], 400);
            }
        }

        $estadoAnterior = $cita->estado;
        $cita->estado = $request->estado;
        $cita->save();

        // 📧 Si el barbero cancela, avisamos al cliente
        if ($estadoAnterior !== 'cancelada' && $cita->estado === 'cancelada' && $user->rol === 'barbero') {
            $cita->load(['servicio', 'cliente']);
            try {
                if ($cita->cliente) {
                    Mail::to($cita->cliente->email)->send(new CitaCanceladaMail($cita));
                }
            } catch (\Throwable $e) {
                \Log::warning('Cita cancelada por barbero, pero falló correo al cliente: ' . $e->getMessage());
            }
        }

        return response()->json([
            'mensaje' => 'Estado actualizado con éxito',
            'cita'    => $cita,
        ]);
    }

    public function citasBarbero(Request $request)
    {
        $citas = Cita::with(['servicio', 'cliente'])
            ->where('barbero_id', $request->user()->id)
            ->orderBy('fecha', 'desc')->orderBy('hora', 'desc')
            ->paginate(10);

        return response()->json($citas);
    }

    public function disponibilidad(Request $request, $id)
    {
        $fecha = $request->query('fecha');
        if (!$fecha) {
            return response()->json(['error' => 'Falta indicar la fecha'], 400);
        }

        // Solo barberos: antes cualquier ID de usuario respondía 200,
        // permitiendo enumerar cuentas por un endpoint público.
        $barbero = User::where('id', $id)->where('rol', 'barbero')->firstOrFail();

        $bloqueo = BloqueoHorario::where('barbero_id', $id)
            ->activoEnFecha($fecha)->first();

        if ($bloqueo) {
            return response()->json([
                'bloqueado'   => true,
                'motivo'      => $bloqueo->motivo,
                'descripcion' => $bloqueo->descripcion,
                'ocupadas'    => [],
                'pasadas'     => [],
                'hora_inicio' => date('H:i', strtotime($barbero->hora_inicio ?? self::TURNO_INICIO_DEFAULT)),
                'hora_fin'    => date('H:i', strtotime($barbero->hora_fin    ?? self::TURNO_FIN_DEFAULT)),
            ]);
        }

        $citas = Cita::with('servicio')
            ->where('barbero_id', $id)
            ->where('fecha', $fecha)
            ->where('estado', '!=', 'cancelada')->get();

        $ocupadas = [];
        foreach ($citas as $cita) {
            $duracion     = $cita->servicio->duracion ?? 30;
            $horaInicio   = Carbon::parse($cita->hora);
            $horaFin      = $horaInicio->copy()->addMinutes($duracion);
            $tiempoActual = $horaInicio->copy();
            while ($tiempoActual < $horaFin) {
                $ocupadas[] = $tiempoActual->format('H:i');
                $tiempoActual->addMinutes(30);
            }
        }

        $pasadas = [];
        $hoy = Carbon::now('America/Santiago');

        if ($fecha === $hoy->toDateString()) {
            $horaInicioTurno = Carbon::parse($barbero->hora_inicio ?? self::TURNO_INICIO_DEFAULT, 'America/Santiago');
            $horaFinTurno    = Carbon::parse($barbero->hora_fin    ?? self::TURNO_FIN_DEFAULT, 'America/Santiago');
            $horaLimite      = $hoy->copy()->addMinutes(15);
            while ($horaInicioTurno < $horaFinTurno) {
                if ($horaInicioTurno <= $horaLimite) {
                    $pasadas[] = $horaInicioTurno->format('H:i');
                }
                $horaInicioTurno->addMinutes(30);
            }
        }

        return response()->json([
            'bloqueado'   => false,
            'ocupadas'    => array_values(array_unique($ocupadas)),
            'pasadas'     => array_values(array_unique($pasadas)),
            'hora_inicio' => date('H:i', strtotime($barbero->hora_inicio ?? self::TURNO_INICIO_DEFAULT)),
            'hora_fin'    => date('H:i', strtotime($barbero->hora_fin    ?? self::TURNO_FIN_DEFAULT)),
        ]);
    }

    public function cancelarMiCita(Request $request, $id)
    {
        $cita = Cita::with('barberia')
            ->where('id', $id)->where('cliente_id', $request->user()->id)
            ->firstOrFail();

        if (in_array($cita->estado, ['finalizada', 'cancelada'])) {
            return response()->json(['error' => 'Esta cita ya no se puede modificar.'], 400);
        }

        $fechaHoraCita    = Carbon::parse($cita->fecha . ' ' . $cita->hora);
        $minutosRestantes = Carbon::now()->diffInMinutes($fechaHoraCita, false);
        $tiempoMinimo     = $cita->barberia->tiempo_cancelacion ?? 30;

        if ($minutosRestantes < $tiempoMinimo) {
            $textoFinal = $this->formatearTiempo($tiempoMinimo);
            return response()->json([
                'error' => "No puedes cancelar. Esta barbería exige un aviso de al menos {$textoFinal} de anticipación.",
            ], 403);
        }

        $cita->estado = 'cancelada';
        $cita->save();
        $cita->load('servicio');

        try {
            Mail::to($request->user()->email)->send(new CitaCanceladaMail($cita));
        } catch (\Throwable $e) {
            \Log::warning('Cita cancelada OK pero falló correo: ' . $e->getMessage());
        }

        return response()->json(['mensaje' => 'Cita cancelada con éxito', 'cita' => $cita]);
    }

    public function calificar(Request $request, $id)
    {
        $request->validate([
            'calificacion' => 'required|integer|min:1|max:5',
            'comentario'   => 'nullable|string|max:500',
        ]);

        $cita = Cita::findOrFail($id);

        if ($cita->cliente_id !== $request->user()->id) {
            return response()->json(['error' => 'No tienes permiso para calificar esta cita.'], 403);
        }
        if ($cita->estado !== 'finalizada') {
            return response()->json(['error' => 'Solo puedes calificar servicios finalizados.'], 400);
        }
        if ($cita->calificacion !== null) {
            return response()->json(['error' => 'Ya calificaste esta cita.'], 400);
        }

        DB::transaction(function () use ($cita, $request) {
            $cita->calificacion = $request->calificacion;
            $cita->comentario   = $request->comentario;
            $cita->save();

            $stats = Cita::where('barbero_id', $cita->barbero_id)
                ->whereNotNull('calificacion')
                ->selectRaw('AVG(calificacion) as promedio, COUNT(*) as total')
                ->first();

            User::where('id', $cita->barbero_id)->update([
                'promedio_calificacion' => round($stats->promedio, 2),
                'total_resenas'         => $stats->total,
            ]);
        });

        return response()->json(['message' => '¡Gracias por tu valoración!', 'cita' => $cita], 200);
    }

    /**
     * La cita debe caber COMPLETA dentro del turno del barbero
     * (antes esta regla solo existía en el frontend y un POST directo
     * podía agendar a cualquier hora o desbordar el cierre).
     */
    private function errorFueraDeTurno(?User $barbero, Carbon $horaInicio, Carbon $horaFin): ?string
    {
        if (!$barbero) {
            return 'El barbero seleccionado no existe.';
        }

        $inicioTurno = Carbon::parse($barbero->hora_inicio ?? self::TURNO_INICIO_DEFAULT)
            ->setDate($horaInicio->year, $horaInicio->month, $horaInicio->day);
        $finTurno    = Carbon::parse($barbero->hora_fin ?? self::TURNO_FIN_DEFAULT)
            ->setDate($horaInicio->year, $horaInicio->month, $horaInicio->day);

        if ($horaInicio < $inicioTurno || $horaFin > $finTurno) {
            return sprintf(
                'El horario elegido no está disponible: el turno del barbero es de %s a %s y el servicio debe terminar antes del cierre.',
                $inicioTurno->format('H:i'),
                $finTurno->format('H:i')
            );
        }

        return null;
    }

    /**
     * ¿La franja [$inicio, $fin) choca con otra cita activa del barbero
     * ese día? Compartido por store() y reagendar() para que la regla de
     * solapamiento viva en un solo lugar.
     */
    private function haySolape(int $barberoId, string $fecha, Carbon $inicio, Carbon $fin, ?int $excluirCitaId = null): bool
    {
        $citas = Cita::with('servicio')
            ->where('barbero_id', $barberoId)
            ->where('fecha', $fecha)
            ->where('estado', '!=', 'cancelada')
            ->when($excluirCitaId !== null, fn ($q) => $q->where('id', '!=', $excluirCitaId))
            ->get();

        foreach ($citas as $otra) {
            $dur      = $otra->servicio->duracion ?? 30;
            $iniOtra  = Carbon::parse($otra->hora);
            $finOtra  = $iniOtra->copy()->addMinutes($dur);
            if ($inicio < $finOtra && $fin > $iniOtra) {
                return true;
            }
        }

        return false;
    }

    private function formatearTiempo(int $minutosTotal): string
    {
        $dias  = (int) floor($minutosTotal / 1440);
        $horas = (int) floor(($minutosTotal % 1440) / 60);
        $mins  = $minutosTotal % 60;

        $partes = [];
        if ($dias > 0)  $partes[] = $dias  . ($dias === 1  ? ' día'  : ' días');
        if ($horas > 0) $partes[] = $horas . ($horas === 1 ? ' hora' : ' horas');
        if ($mins > 0)  $partes[] = $mins  . ' minutos';

        if (empty($partes)) return '0 minutos';
        if (count($partes) === 1) return $partes[0];

        $ultimo = array_pop($partes);
        return implode(', ', $partes) . ' y ' . $ultimo;
    }
}
