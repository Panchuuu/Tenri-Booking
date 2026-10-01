<?php

namespace Tests\Feature;

use App\Mail\RecordatorioCitaMail;
use App\Models\Barberia;
use App\Models\Cita;
use App\Models\Servicio;
use App\Models\User;
use App\Services\WhatsApp;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * El recordatorio de la hora, por el canal que se lee.
 *
 * Un recordatorio que queda sin abrir en la bandeja de entrada no recuerda
 * nada, y la hora se pierde igual. Sale por WhatsApp cuando la persona dejó su
 * teléfono, y por correo cuando no. Nunca por los dos: el aviso repetido es
 * ruido, y el ruido es lo que hace que el próximo no se lea.
 */
class RecordatorioPorWhatsappTest extends TestCase
{
    use RefreshDatabase;

    private function citaParaManana(?string $telefono): Cita
    {
        $barberia = Barberia::factory()->create(['direccion' => 'Av. Siempre Viva 742']);

        return Cita::create([
            'cliente_id' => User::factory()->create(['rol' => 'cliente', 'telefono' => $telefono])->id,
            'barbero_id' => User::factory()->create(['rol' => 'barbero', 'barberia_id' => $barberia->id])->id,
            'servicio_id' => Servicio::factory()->create(['barberia_id' => $barberia->id])->id,
            'barberia_id' => $barberia->id,
            'fecha' => Carbon::tomorrow()->toDateString(),
            'hora' => '15:30',
            'estado' => 'confirmada',
        ]);
    }

    public function test_con_telefono_el_recordatorio_sale_por_whatsapp(): void
    {
        Mail::fake();
        $cita = $this->citaParaManana('9 1234 5678');

        $this->mock(WhatsApp::class, function ($mock) {
            $mock->shouldReceive('enviar')
                ->once()
                ->withArgs(fn ($telefono, $mensaje) => $telefono === '9 1234 5678'
                    // Lo mínimo para decidir: cuándo y dónde.
                    && str_contains($mensaje, '15:30')
                    && str_contains($mensaje, 'Av. Siempre Viva 742'))
                ->andReturn(true);
        });

        $this->artisan('citas:enviar-recordatorios')->assertSuccessful();

        $this->assertNotNull($cita->fresh()->recordatorio_enviado_at);

        // Y no se le manda además el correo: es el mismo aviso dos veces.
        Mail::assertNothingQueued();
    }

    public function test_sin_telefono_el_recordatorio_sale_por_correo(): void
    {
        Mail::fake();
        $cita = $this->citaParaManana(null);

        $this->mock(WhatsApp::class, function ($mock) {
            $mock->shouldReceive('enviar')->andReturn(false);
        });

        $this->artisan('citas:enviar-recordatorios')->assertSuccessful();

        Mail::assertQueued(RecordatorioCitaMail::class);
        $this->assertNotNull($cita->fresh()->recordatorio_enviado_at);
    }

    /** Si WhatsApp está caído, el correo lo cubre. Nadie se queda sin aviso. */
    public function test_si_whatsapp_falla_igual_se_avisa_por_correo(): void
    {
        Mail::fake();
        $cita = $this->citaParaManana('912345678');

        $this->mock(WhatsApp::class, function ($mock) {
            $mock->shouldReceive('enviar')->once()->andReturn(false);
        });

        $this->artisan('citas:enviar-recordatorios')->assertSuccessful();

        Mail::assertQueued(RecordatorioCitaMail::class);
        $this->assertNotNull($cita->fresh()->recordatorio_enviado_at);
    }

    /** El comando corre cada noche: no puede avisar dos veces de lo mismo. */
    public function test_no_se_avisa_dos_veces_de_la_misma_cita(): void
    {
        Mail::fake();
        $this->citaParaManana('912345678');

        $this->mock(WhatsApp::class, function ($mock) {
            $mock->shouldReceive('enviar')->once()->andReturn(true);
        });

        $this->artisan('citas:enviar-recordatorios')->assertSuccessful();
        $this->artisan('citas:enviar-recordatorios')->assertSuccessful();
    }
}
