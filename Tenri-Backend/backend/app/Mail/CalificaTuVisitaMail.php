<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use App\Models\Cita;

/**
 * Se envía cuando una cita pasa a "finalizada" (por el admin, el barbero
 * o el comando citas:finalizar-vencidas) y el cliente aún no calificó.
 * Invita a dejar la reseña desde Mis Reservas.
 */
class CalificaTuVisitaMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public $cita;

    public function __construct(Cita $cita)
    {
        $this->cita = $cita;
    }

    public function build()
    {
        // Asunto con la tienda real (multi-tenant); fallback a la marca
        // de la plataforma si la cita no tiene barbería asociada.
        $tienda = $this->cita->barberia->nombre ?? 'TENRI Barber';

        return $this->subject("⭐ ¿Cómo estuvo tu visita a {$tienda}?")
                    ->view('emails.califica_tu_visita');
    }
}
