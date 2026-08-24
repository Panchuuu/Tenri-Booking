<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use App\Models\Cita;

class CitaCanceladaMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    // Variable pública que usaremos en la vista HTML
    public $cita;

    // Constructor que recibe la cita cancelada
    public function __construct(Cita $cita)
    {
        $this->cita = $cita;
    }

    // Definimos el asunto y la vista que va a pintar
    public function build()
    {
        return $this->subject('❌ Reserva Cancelada - TENRI Barber')
                    ->view('emails.cita_cancelada');
    }
}