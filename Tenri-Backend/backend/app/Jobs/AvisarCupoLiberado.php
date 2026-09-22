<?php

namespace App\Jobs;

use App\Mail\CupoLiberadoMail;
use App\Models\Cita;
use App\Models\ListaEspera;
use App\Services\WhatsApp;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Le avisa a quien esperaba que se liberó un cupo.
 *
 * Se dispara cuando una cita se cancela, venga de donde venga: del cliente, del
 * barbero o del panel. Ese hueco, hoy, se queda vacío porque nadie se entera a
 * tiempo. Es la pérdida más silenciosa del negocio.
 *
 * En cola y no en línea: cancelar una cita no puede tardar lo que tarden tres
 * mensajes de WhatsApp, ni fallar porque el proveedor esté caído.
 */
class AvisarCupoLiberado implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * A cuántos se les avisa por cupo.
     *
     * Avisarle solo al primero deja el hueco sin llenar cuando esa persona no
     * contesta, que es lo más probable a dos horas de la hora. Avisarle a toda
     * la lista es spam y decepciona a muchos. Tres es el punto donde el cupo se
     * llena casi siempre sin convertirse en una carrera multitudinaria, y el
     * mensaje dice con todas sus letras que es para quien lo tome primero.
     */
    private const A_CUANTOS_SE_AVISA = 3;

    public function __construct(public int $citaId) {}

    public function handle(WhatsApp $whatsapp): void
    {
        $cita = Cita::with(['barberia', 'barbero', 'servicio'])->find($this->citaId);

        if ($cita === null || $cita->estado !== 'cancelada') {
            return;
        }

        // Un hueco que ya pasó no le sirve a nadie.
        if (Carbon::parse($cita->fecha)->isBefore(now()->startOfDay())) {
            return;
        }

        $esperando = ListaEspera::with('cliente')
            ->where('barberia_id', $cita->barberia_id)
            ->whereDate('fecha', $cita->fecha)
            ->where('estado', ListaEspera::ESPERANDO)
            // Quien esperaba por una persona en particular solo quiere saber
            // de los huecos de esa persona.
            ->where(fn ($q) => $q->whereNull('barbero_id')->orWhere('barbero_id', $cita->barbero_id))
            ->orderBy('id')
            ->limit(self::A_CUANTOS_SE_AVISA)
            ->get();

        foreach ($esperando as $espera) {
            $this->avisar($espera, $cita, $whatsapp);
        }
    }

    private function avisar(ListaEspera $espera, Cita $cita, WhatsApp $whatsapp): void
    {
        $cliente = $espera->cliente;

        if ($cliente === null) {
            return;
        }

        try {
            $salio = $whatsapp->enviar($cliente->telefono, $this->mensaje($cita, $cliente->name));

            if (! $salio && $cliente->email) {
                Mail::to($cliente->email)->send(new CupoLiberadoMail($cita, $cliente->name));
                $salio = true;
            }

            if (! $salio) {
                return;
            }

            // Se marca solo si el aviso salió: si no, sigue en la fila para el
            // próximo hueco en vez de quedar marcada sin haberse enterado.
            $espera->update([
                'estado' => ListaEspera::AVISADO,
                'avisado_en' => now(),
            ]);
        } catch (Throwable $e) {
            Log::warning('Lista de espera: no se pudo avisar de un cupo', [
                'lista_espera_id' => $espera->id,
                'cita_id' => $cita->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function mensaje(Cita $cita, string $nombre): string
    {
        $hora = Carbon::parse($cita->hora)->format('H:i');
        $fecha = Carbon::parse($cita->fecha)->locale('es')->isoFormat('dddd D [de] MMMM');
        $url = rtrim((string) config('app.frontend_url'), '/').'/barberia/'.$cita->barberia->slug;

        return implode(PHP_EOL, [
            "Hola {$nombre}, se liberó una hora en {$cita->barberia->nombre}.",
            '',
            "🗓 {$fecha} a las {$hora}",
            "✂️ {$cita->servicio->nombre}".($cita->barbero ? " con {$cita->barbero->name}" : ''),
            '',
            'Es para quien la tome primero:',
            $url,
        ]);
    }
}
