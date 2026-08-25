<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use App\Models\Cita;

class RecordatorioCitaMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public $cita;

    public function __construct(Cita $cita)
    {
        $this->cita = $cita;
    }

    public function build()
    {
        return $this->subject('⏰ Recordatorio: tu cita es mañana - TENRI Barber')
                    ->view('emails.recordatorio_cita');
    }
}
