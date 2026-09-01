<?php

namespace App\Console\Commands;

use App\Mail\CalificaTuVisitaMail;
use App\Models\Cita;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Regla de negocio: una cita confirmada cuya hora pasó hace más de 24
 * horas sin que el admin/barbero la tocara se da por realizada. Sin esto
 * quedaba "confirmada" para siempre: inflaba la agenda, no sumaba en el
 * resumen financiero y el cliente nunca podía calificar.
 *
 * Idempotente: solo toma citas en estado "confirmada", así que correrlo
 * varias veces no re-procesa nada. Las "pendiente" no se tocan — que el
 * negocio decida si fueron no-show o error.
 */
class FinalizarCitasVencidas extends Command
{
    protected $signature = 'citas:finalizar-vencidas';

    protected $description = 'Finaliza citas confirmadas cuya hora pasó hace más de 24 horas e invita al cliente a calificar';

    public function handle(): int
    {
        // Margen de 24h: le da al negocio un día completo para corregir
        // manualmente (cancelar un no-show) antes del cierre automático.
        $limite = Carbon::now('America/Santiago')->subDay();

        $citas = Cita::with(['cliente', 'servicio', 'barbero', 'barberia'])
            ->where('estado', 'confirmada')
            ->where(function ($q) use ($limite) {
                $q->whereDate('fecha', '<', $limite->toDateString())
                  ->orWhere(function ($q2) use ($limite) {
                      $q2->whereDate('fecha', $limite->toDateString())
                         ->where('hora', '<=', $limite->format('H:i:s'));
                  });
            })
            ->get();

        $finalizadas = 0;

        foreach ($citas as $cita) {
            $cita->estado = 'finalizada';
            $cita->save();
            $finalizadas++;

            // Invitación a calificar — un correo fallido no frena el lote.
            if ($cita->calificacion === null && $cita->cliente?->email) {
                try {
                    Mail::to($cita->cliente->email)->queue(new CalificaTuVisitaMail($cita));
                } catch (\Throwable $e) {
                    Log::warning("Cita #{$cita->id} finalizada, pero falló el correo de calificación: {$e->getMessage()}");
                }
            }
        }

        $this->info("Citas vencidas finalizadas: {$finalizadas}.");

        return self::SUCCESS;
    }
}
