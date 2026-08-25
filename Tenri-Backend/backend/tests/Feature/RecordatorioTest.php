<?php

namespace Tests\Feature;

use App\Mail\RecordatorioCitaMail;
use App\Models\Cita;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class RecordatorioTest extends TestCase
{
    use RefreshDatabase;

    public function test_encola_recordatorio_para_citas_de_manana(): void
    {
        Mail::fake();

        $manana = Carbon::tomorrow()->toDateString();
        $cita   = Cita::factory()->confirmada()->create(['fecha' => $manana]);

        $this->artisan('citas:enviar-recordatorios')->assertSuccessful();

        Mail::assertQueued(RecordatorioCitaMail::class, function ($mail) use ($cita) {
            return $mail->cita->id === $cita->id
                && $mail->hasTo($cita->cliente->email);
        });

        $this->assertNotNull($cita->fresh()->recordatorio_enviado_at);
    }

    public function test_no_reenvia_recordatorios_ya_enviados(): void
    {
        Mail::fake();

        $manana = Carbon::tomorrow()->toDateString();
        Cita::factory()->confirmada()->create([
            'fecha'                   => $manana,
            'recordatorio_enviado_at' => now(),
        ]);

        $this->artisan('citas:enviar-recordatorios')->assertSuccessful();

        Mail::assertNothingQueued();
    }

    public function test_ignora_citas_canceladas_y_de_otras_fechas(): void
    {
        Mail::fake();

        $manana = Carbon::tomorrow()->toDateString();

        // Cancelada mañana: no debe recibir recordatorio.
        Cita::factory()->cancelada()->create(['fecha' => $manana]);
        // Confirmada pero para pasado mañana: aún no le toca.
        Cita::factory()->confirmada()->create(['fecha' => Carbon::tomorrow()->addDay()->toDateString()]);

        $this->artisan('citas:enviar-recordatorios')->assertSuccessful();

        Mail::assertNothingQueued();
    }
}
