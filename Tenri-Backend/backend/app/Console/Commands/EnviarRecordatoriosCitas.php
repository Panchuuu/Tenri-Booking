<?php

namespace App\Console\Commands;

use App\Mail\RecordatorioCitaMail;
use App\Models\Cita;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class EnviarRecordatoriosCitas extends Command
{
    protected $signature = 'citas:enviar-recordatorios';

    protected $description = 'Encola el email de recordatorio a los clientes con cita mañana (pendiente o confirmada)';

    public function handle(): int
    {
        $manana = Carbon::tomorrow()->toDateString();

        $citas = Cita::with(['cliente', 'servicio', 'barbero', 'barberia'])
            ->whereDate('fecha', $manana)
            ->whereIn('estado', ['pendiente', 'confirmada'])
            ->whereNull('recordatorio_enviado_at')
            ->get();

        $enviados = 0;

        foreach ($citas as $cita) {
            if (!$cita->cliente?->email) {
                continue;
            }

            try {
                Mail::to($cita->cliente->email)->queue(new RecordatorioCitaMail($cita));

                // Marcar DESPUÉS de encolar: si el encolado falla, el próximo
                // run del cron lo reintenta. La marca hace el comando idempotente.
                $cita->recordatorio_enviado_at = now();
                $cita->save();
                $enviados++;
            } catch (\Throwable $e) {
                // Un email problemático no debe frenar el resto del lote.
                Log::error("Recordatorio de cita #{$cita->id} no se pudo encolar: {$e->getMessage()}");
            }
        }

        $this->info("Recordatorios encolados: {$enviados} de {$citas->count()} citas para {$manana}.");

        return self::SUCCESS;
    }
}
