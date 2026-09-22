<?php

namespace Tests\Feature;

use App\Mail\CupoLiberadoMail;
use App\Models\Barberia;
use App\Models\Cita;
use App\Models\ListaEspera;
use App\Models\Servicio;
use App\Models\User;
use App\Services\WhatsApp;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use RuntimeException;
use Tests\TestCase;

/**
 * La lista de espera.
 *
 * Un día lleno se pierde dos veces: se va quien quería venir, y cuando alguien
 * cancela a última hora ese hueco queda vacío porque nadie se entera. Lo que se
 * prueba acá es que las dos puntas se junten: que anotarse sea fácil y que el
 * aviso salga solo, venga la cancelación de donde venga.
 */
class ListaEsperaTest extends TestCase
{
    use RefreshDatabase;

    private function local(): Barberia
    {
        return Barberia::factory()->create();
    }

    private function citaDe(Barberia $barberia, ?User $barbero = null, string $fecha = '2030-01-15'): Cita
    {
        $barbero ??= User::factory()->create(['rol' => 'barbero', 'barberia_id' => $barberia->id]);

        return Cita::create([
            'cliente_id' => User::factory()->create(['rol' => 'cliente'])->id,
            'barbero_id' => $barbero->id,
            'servicio_id' => Servicio::factory()->create(['barberia_id' => $barberia->id])->id,
            'barberia_id' => $barberia->id,
            'fecha' => $fecha,
            'hora' => '15:00',
            'estado' => 'confirmada',
        ]);
    }

    private function esperando(Barberia $barberia, ?User $barbero = null, string $fecha = '2030-01-15'): ListaEspera
    {
        return ListaEspera::create([
            'barberia_id' => $barberia->id,
            'cliente_id' => User::factory()->create(['rol' => 'cliente', 'telefono' => '912345678'])->id,
            'barbero_id' => $barbero?->id,
            'fecha' => $fecha,
            'estado' => ListaEspera::ESPERANDO,
        ]);
    }

    // ─── Anotarse ────────────────────────────────────────────────────────────

    public function test_un_cliente_pide_que_le_avisen_si_se_libera_una_hora(): void
    {
        $barberia = $this->local();
        $cliente = User::factory()->create(['rol' => 'cliente']);

        $this->actingAs($cliente)
            ->postJson('/api/lista-espera', ['barberia_id' => $barberia->id, 'fecha' => '2030-01-15'])
            ->assertStatus(201);

        $this->assertDatabaseHas('lista_espera', [
            'barberia_id' => $barberia->id,
            'cliente_id' => $cliente->id,
            'estado' => ListaEspera::ESPERANDO,
        ]);
    }

    /** Anotarse dos veces para el mismo día sería recibir el aviso repetido. */
    public function test_anotarse_dos_veces_el_mismo_dia_no_duplica(): void
    {
        $barberia = $this->local();
        $cliente = User::factory()->create(['rol' => 'cliente']);

        foreach ([1, 2] as $_) {
            $this->actingAs($cliente)
                ->postJson('/api/lista-espera', ['barberia_id' => $barberia->id, 'fecha' => '2030-01-15'])
                ->assertStatus(201);
        }

        $this->assertSame(1, ListaEspera::count());
    }

    public function test_no_se_puede_esperar_un_dia_que_ya_paso(): void
    {
        $barberia = $this->local();

        $this->actingAs(User::factory()->create(['rol' => 'cliente']))
            ->postJson('/api/lista-espera', ['barberia_id' => $barberia->id, 'fecha' => '2020-01-15'])
            ->assertStatus(422);
    }

    public function test_no_se_puede_esperar_en_un_local_suspendido(): void
    {
        $barberia = $this->local();
        $barberia->alternarSuspension();

        $this->actingAs(User::factory()->create(['rol' => 'cliente']))
            ->postJson('/api/lista-espera', ['barberia_id' => $barberia->id, 'fecha' => '2030-01-15'])
            ->assertStatus(422);
    }

    public function test_el_cliente_puede_bajarse_de_la_lista(): void
    {
        $barberia = $this->local();
        $cliente = User::factory()->create(['rol' => 'cliente']);
        $espera = ListaEspera::create([
            'barberia_id' => $barberia->id, 'cliente_id' => $cliente->id,
            'fecha' => '2030-01-15', 'estado' => ListaEspera::ESPERANDO,
        ]);

        $this->actingAs($cliente)->deleteJson("/api/lista-espera/{$espera->id}")->assertOk();

        $this->assertSame(ListaEspera::CERRADA, $espera->fresh()->estado);
    }

    public function test_nadie_puede_bajar_a_otro_de_la_lista(): void
    {
        $barberia = $this->local();
        $espera = $this->esperando($barberia);

        $this->actingAs(User::factory()->create(['rol' => 'cliente']))
            ->deleteJson("/api/lista-espera/{$espera->id}")
            ->assertStatus(404);
    }

    // ─── El aviso ────────────────────────────────────────────────────────────

    /**
     * Lo que justifica la función entera: el hueco de una cancelación deja de
     * perderse. Se dispara desde el modelo, así que cubre las tres formas de
     * cancelar sin depender de cuál se usó.
     */
    public function test_cancelar_una_cita_avisa_a_quien_esperaba_ese_dia(): void
    {
        $barberia = $this->local();
        $espera = $this->esperando($barberia);
        $cita = $this->citaDe($barberia);

        $this->mock(WhatsApp::class, function ($mock) {
            $mock->shouldReceive('enviar')->once()->andReturn(true);
        });

        $cita->update(['estado' => 'cancelada']);

        $espera->refresh();
        $this->assertSame(ListaEspera::AVISADO, $espera->estado);
        $this->assertNotNull($espera->avisado_en);
    }

    /** Sin teléfono, el aviso sale por correo. Nadie se queda sin enterarse. */
    public function test_sin_telefono_el_aviso_sale_por_correo(): void
    {
        Mail::fake();

        $barberia = $this->local();
        $cliente = User::factory()->create(['rol' => 'cliente', 'telefono' => null]);
        ListaEspera::create([
            'barberia_id' => $barberia->id, 'cliente_id' => $cliente->id,
            'fecha' => '2030-01-15', 'estado' => ListaEspera::ESPERANDO,
        ]);

        $this->mock(WhatsApp::class, function ($mock) {
            $mock->shouldReceive('enviar')->andReturn(false);
        });

        $this->citaDe($barberia)->update(['estado' => 'cancelada']);

        // El mailable va a la cola, como el resto de los correos de booking.
        Mail::assertQueued(CupoLiberadoMail::class, fn ($mail) => $mail->hasTo($cliente->email));
    }

    /** Quien esperaba por una persona no quiere saber del hueco de otra. */
    public function test_quien_espera_por_un_barbero_no_recibe_el_hueco_de_otro(): void
    {
        $barberia = $this->local();
        $suBarbero = User::factory()->create(['rol' => 'barbero', 'barberia_id' => $barberia->id]);
        $otro = User::factory()->create(['rol' => 'barbero', 'barberia_id' => $barberia->id]);

        $espera = $this->esperando($barberia, $suBarbero);

        $this->mock(WhatsApp::class, function ($mock) {
            $mock->shouldReceive('enviar')->never();
        });

        $this->citaDe($barberia, $otro)->update(['estado' => 'cancelada']);

        $this->assertSame(ListaEspera::ESPERANDO, $espera->fresh()->estado);
    }

    public function test_un_hueco_de_otro_dia_no_le_sirve_a_quien_espera(): void
    {
        $barberia = $this->local();
        $espera = $this->esperando($barberia, fecha: '2030-01-15');

        $this->mock(WhatsApp::class, function ($mock) {
            $mock->shouldReceive('enviar')->never();
        });

        $this->citaDe($barberia, fecha: '2030-02-20')->update(['estado' => 'cancelada']);

        $this->assertSame(ListaEspera::ESPERANDO, $espera->fresh()->estado);
    }

    /**
     * Se avisa a los primeros tres y no a toda la lista: el cupo se llena sin
     * convertirse en una decepción masiva.
     */
    public function test_se_avisa_a_los_primeros_de_la_fila_y_no_a_todos(): void
    {
        $barberia = $this->local();

        foreach (range(1, 5) as $_) {
            $this->esperando($barberia);
        }

        $this->mock(WhatsApp::class, function ($mock) {
            $mock->shouldReceive('enviar')->times(3)->andReturn(true);
        });

        $this->citaDe($barberia)->update(['estado' => 'cancelada']);

        $this->assertSame(3, ListaEspera::where('estado', ListaEspera::AVISADO)->count());
        $this->assertSame(2, ListaEspera::where('estado', ListaEspera::ESPERANDO)->count());
    }

    /**
     * Si el aviso no sale por ningún canal, sigue en la fila para el próximo
     * hueco en vez de quedar marcada sin haberse enterado.
     */
    public function test_si_el_aviso_falla_no_se_marca_como_avisado(): void
    {
        $barberia = $this->local();
        $espera = $this->esperando($barberia);

        $this->mock(WhatsApp::class, function ($mock) {
            $mock->shouldReceive('enviar')->andReturn(false);
        });

        // Y el correo tampoco sale: el servidor de correo está caído.
        Mail::shouldReceive('to')->andThrow(new RuntimeException('smtp caido'));

        $this->citaDe($barberia)->update(['estado' => 'cancelada']);

        $this->assertSame(ListaEspera::ESPERANDO, $espera->fresh()->estado);
    }

    // ─── El local ────────────────────────────────────────────────────────────

    public function test_el_local_ve_a_quienes_esperan_una_hora(): void
    {
        $barberia = $this->local();
        $this->esperando($barberia);
        $this->esperando($barberia);

        // De otro local: no le corresponde verlo.
        $this->esperando($this->local());

        $duenio = User::factory()->create(['rol' => 'admin', 'barberia_id' => $barberia->id]);

        $this->actingAs($duenio)
            ->getJson('/api/mi-barberia/lista-espera')
            ->assertOk()
            ->assertJsonCount(2);
    }
}
