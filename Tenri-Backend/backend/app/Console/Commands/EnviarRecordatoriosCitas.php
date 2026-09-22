<?php

namespace App\Console\Commands;

use App\Mail\RecordatorioCitaMail;
use App\Models\Cita;
use App\Services\WhatsApp;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class EnviarRecordatoriosCitas extends Command
{
    protected $signature = 'citas:enviar-recordatorios';

    protected $description = 'Avisa por WhatsApp -o por correo- a los clientes con cita mañana (pendiente o confirmada)';

    /**
     * Un recordatorio que no se lee no recuerda nada.
     *
     * Por eso sale por WhatsApp cuando la persona dejó su teléfono, y por
     * correo cuando no, o cuando WhatsApp no está disponible. Nunca por los
     * dos: el mismo aviso repetido en dos canales es ruido, y el que molesta
     * es el que hace que la próxima vez no lo lean.
     */
    public function handle(WhatsApp $whatsapp): int
    {
        $manana = Carbon::tomorrow()->toDateString();

        $citas = Cita::with(['cliente', 'servicio', 'barbero', 'barberia'])
            ->whereDate('fecha', $manana)
            ->whereIn('estado', ['pendiente', 'confirmada'])
            ->whereNull('recordatorio_enviado_at')
            ->get();

        $enviados = 0;

        $porWhatsapp = 0;

        foreach ($citas as $cita) {
            $cliente = $cita->cliente;

            if (! $cliente?->email && ! $cliente?->telefono) {
                continue;
            }

            try {
                $salioPorWhatsapp = $whatsapp->enviar($cliente->telefono, $this->mensaje($cita));

                if ($salioPorWhatsapp) {
                    $porWhatsapp++;
                } elseif ($cliente->email) {
                    Mail::to($cliente->email)->queue(new RecordatorioCitaMail($cita));
                } else {
                    // Sin WhatsApp y sin correo no hay aviso posible: se deja
                    // sin marcar para que el próximo intento lo reintente.
                    continue;
                }

                // Marcar DESPUÉS de enviar: si falla, el próximo run del cron
                // lo reintenta. La marca hace el comando idempotente.
                $cita->recordatorio_enviado_at = now();
                $cita->save();
                $enviados++;
            } catch (\Throwable $e) {
                // Un aviso problemático no debe frenar el resto del lote.
                Log::error("Recordatorio de cita #{$cita->id} no se pudo enviar: {$e->getMessage()}");
            }
        }

        $this->info("Recordatorios enviados: {$enviados} de {$citas->count()} citas para {$manana} ({$porWhatsapp} por WhatsApp).");

        return self::SUCCESS;
    }

    /**
     * El texto del recordatorio.
     *
     * Corto y con lo que hace falta para decidir: cuándo, dónde y con quién. La
     * invitación a avisar si no puede venir no es cortesía: es lo que libera el
     * cupo a tiempo para que lo tome alguien de la lista de espera.
     */
    private function mensaje(Cita $cita): string
    {
        $hora = Carbon::parse($cita->hora)->format('H:i');
        $fecha = Carbon::parse($cita->fecha)->locale('es')->isoFormat('dddd D [de] MMMM');

        $lineas = [
            "Hola {$cita->cliente->name}, te recordamos tu hora en {$cita->barberia->nombre}.",
            '',
            "🗓 {$fecha} a las {$hora}",
            "✂️ {$cita->servicio->nombre}".($cita->barbero ? " con {$cita->barbero->name}" : ''),
        ];

        if (filled($cita->barberia->direccion)) {
            $lineas[] = "📍 {$cita->barberia->direccion}";
        }

        $lineas[] = '';
        $lineas[] = 'Si no puedes venir, avísanos para liberar el cupo.';

        return implode(PHP_EOL, $lineas);
    }
}
