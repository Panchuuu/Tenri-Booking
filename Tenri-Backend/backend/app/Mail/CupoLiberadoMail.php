<?php

namespace App\Mail;

use App\Models\Cita;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * Se liberó una hora del día que estabas esperando.
 *
 * Es el respaldo del aviso por WhatsApp: sale cuando la persona no dejó
 * teléfono o cuando el canal no estaba disponible. El cupo es de quien lo tome
 * primero, y el correo lo dice, porque a esa altura ya se le avisó a más de
 * una persona.
 */
class CupoLiberadoMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public Cita $cita,
        public string $nombreCliente,
    ) {}

    public function build()
    {
        return $this->subject('Se liberó una hora en '.$this->cita->barberia->nombre)
            ->view('emails.cupo_liberado');
    }
}
