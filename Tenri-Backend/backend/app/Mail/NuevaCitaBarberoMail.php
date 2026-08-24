<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use App\Models\Cita;

class NuevaCitaBarberoMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public $cita; // Variable pública para pasar datos a la vista

    // Constructor: Recibe la cita recién creada con todas sus relaciones (cliente, servicio)
    public function __construct(Cita $cita)
    {
        $this->cita = $cita;
    }

    // Configuración del asunto y la vista que se renderizará
    public function build()
    {
        return $this->subject('🔔 Tienes una nueva reserva - TENRI SPA')
                    ->view('emails.nueva_cita_barbero');
    }
}