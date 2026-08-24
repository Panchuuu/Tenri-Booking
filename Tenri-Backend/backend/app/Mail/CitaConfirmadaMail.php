<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use App\Models\Cita;

class CitaConfirmadaMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public $cita; // Variable pública para usarla en la vista del correo

    // Constructor: Recibe la cita recién creada
    public function __construct(Cita $cita)
    {
        $this->cita = $cita;
    }

    // Aquí configuramos el asunto y qué vista HTML va a cargar
    public function build()
    {
        return $this->subject('✅ Confirmación de Reserva - TENRI Barber')
                    ->view('emails.cita_confirmada');
    }
}