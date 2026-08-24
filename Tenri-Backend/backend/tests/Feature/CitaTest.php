<?php

namespace Tests\Feature;

use App\Models\Barberia;
use App\Models\BloqueoHorario;
use App\Models\Cita;
use App\Models\Servicio;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class CitaTest extends TestCase
{
    use RefreshDatabase;

    private function setupBarberia(): array
    {
        $barberia = Barberia::factory()->create();
        $barbero  = User::factory()->barbero($barberia->id)->create();
        $servicio = Servicio::factory()->create(['barberia_id' => $barberia->id]);
        $cliente  = User::factory()->cliente()->create();
        return [$barberia, $barbero, $servicio, $cliente];
    }

    public function test_cliente_puede_crear_cita(): void
    {
        Mail::fake();
        [$barberia, $barbero, $servicio, $cliente] = $this->setupBarberia();

        $response = $this->actingAs($cliente)
                         ->postJson('/api/citas', [
                             'barberia_id' => $barberia->id,
                             'barbero_id'  => $barbero->id,
                             'servicio_id' => $servicio->id,
                             'fecha'       => now()->addDays(3)->format('Y-m-d'),
                             'hora'        => '10:00',
                         ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('citas', [
            'cliente_id'  => $cliente->id,
            'barbero_id'  => $barbero->id,
            'servicio_id' => $servicio->id,
        ]);
    }

    public function test_cliente_puede_cancelar_su_cita(): void
    {
        Mail::fake();
        // tiempo_cancelacion=0 evita el check de minutos restantes.
        $barberia = \App\Models\Barberia::factory()->create([
            'tiempo_cancelacion' => 0,
        ]);
        $barbero  = User::factory()->barbero($barberia->id)->create();
        $servicio = \App\Models\Servicio::factory()->create([
            'barberia_id' => $barberia->id,
        ]);
        $cliente  = User::factory()->cliente()->create();

        $cita = Cita::factory()->create([
            'barberia_id' => $barberia->id,
            'barbero_id'  => $barbero->id,
            'servicio_id' => $servicio->id,
            'cliente_id'  => $cliente->id,
            'fecha'       => now()->addDays(5)->format('Y-m-d'),
            'hora'        => '15:00',
            'estado'      => 'confirmada',
        ]);

        $response = $this->actingAs($cliente)
                         ->patchJson("/api/mis-citas/{$cita->id}/cancelar");

        $response->assertStatus(200);
        $this->assertDatabaseHas('citas', [
            'id'     => $cita->id,
            'estado' => 'cancelada',
        ]);
    }

    public function test_no_se_puede_reservar_con_mas_de_90_dias_de_anticipacion(): void
    {
        [$barberia, $barbero, $servicio, $cliente] = $this->setupBarberia();

        $response = $this->actingAs($cliente)
                         ->postJson('/api/citas', [
                             'barberia_id' => $barberia->id,
                             'barbero_id'  => $barbero->id,
                             'servicio_id' => $servicio->id,
                             'fecha'       => now()->addDays(91)->format('Y-m-d'),
                             'hora'        => '10:00',
                         ]);

        $response->assertStatus(422);
    }

    /**
     * Setup con duración de servicio controlada, para los tests
     * de solapamiento y horario laboral (barbero: 09:00–18:00).
     */
    private function setupConDuracion(int $duracionMinutos): array
    {
        $barberia = Barberia::factory()->create();
        $barbero  = User::factory()->barbero($barberia->id)->create();
        $servicio = Servicio::factory()->create([
            'barberia_id'      => $barberia->id,
            'duracion_minutos' => $duracionMinutos,
        ]);
        $cliente  = User::factory()->cliente()->create();
        return [$barberia, $barbero, $servicio, $cliente];
    }

    private function reservar(User $cliente, User $barbero, Servicio $servicio, string $hora, int $diasFuturo = 3)
    {
        return $this->actingAs($cliente)->postJson('/api/citas', [
            'barbero_id'  => $barbero->id,
            'servicio_id' => $servicio->id,
            'fecha'       => now()->addDays($diasFuturo)->format('Y-m-d'),
            'hora'        => $hora,
        ]);
    }

    public function test_no_permite_doble_reserva_en_el_mismo_horario(): void
    {
        Mail::fake();
        [$barberia, $barbero, $servicio, $cliente] = $this->setupConDuracion(30);
        $otroCliente = User::factory()->cliente()->create();

        $this->reservar($cliente, $barbero, $servicio, '10:00')->assertStatus(201);
        $this->reservar($otroCliente, $barbero, $servicio, '10:00')->assertStatus(409);

        $this->assertEquals(1, Cita::where('barbero_id', $barbero->id)->count());
    }

    public function test_no_permite_solapamiento_parcial_de_citas(): void
    {
        Mail::fake();
        [$barberia, $barbero, $servicio, $cliente] = $this->setupConDuracion(60);
        $otroCliente = User::factory()->cliente()->create();

        // 10:00–11:00 ocupado; 10:30 se solapa con la segunda mitad.
        $this->reservar($cliente, $barbero, $servicio, '10:00')->assertStatus(201);
        $this->reservar($otroCliente, $barbero, $servicio, '10:30')->assertStatus(409);
    }

    public function test_una_cita_cancelada_libera_el_horario(): void
    {
        Mail::fake();
        [$barberia, $barbero, $servicio, $cliente] = $this->setupConDuracion(30);

        Cita::factory()->cancelada()->create([
            'barberia_id' => $barberia->id,
            'barbero_id'  => $barbero->id,
            'servicio_id' => $servicio->id,
            'fecha'       => now()->addDays(3)->format('Y-m-d'),
            'hora'        => '10:00',
        ]);

        $this->reservar($cliente, $barbero, $servicio, '10:00')->assertStatus(201);
    }

    public function test_rechaza_hora_fuera_del_turno_del_barbero(): void
    {
        Mail::fake();
        [$barberia, $barbero, $servicio, $cliente] = $this->setupConDuracion(30);

        // El turno del barbero de factory es 09:00–18:00.
        $this->reservar($cliente, $barbero, $servicio, '03:00')->assertStatus(422);
        $this->reservar($cliente, $barbero, $servicio, '08:30')->assertStatus(422);
        $this->reservar($cliente, $barbero, $servicio, '18:00')->assertStatus(422);
    }

    public function test_rechaza_cita_que_termina_despues_del_cierre(): void
    {
        Mail::fake();
        [$barberia, $barbero, $servicio, $cliente] = $this->setupConDuracion(60);

        // 17:30 + 60 min = 18:30, después del cierre (18:00).
        $this->reservar($cliente, $barbero, $servicio, '17:30')->assertStatus(422);
        // 17:00 + 60 min = 18:00 justo: sí cabe.
        $this->reservar($cliente, $barbero, $servicio, '17:00')->assertStatus(201);
    }

    public function test_no_se_puede_reservar_en_fecha_bloqueada(): void
    {
        Mail::fake();
        [$barberia, $barbero, $servicio, $cliente] = $this->setupConDuracion(30);

        BloqueoHorario::create([
            'barbero_id'   => $barbero->id,
            'barberia_id'  => $barberia->id,
            'fecha_inicio' => now()->addDays(2)->format('Y-m-d'),
            'fecha_fin'    => now()->addDays(4)->format('Y-m-d'),
            'motivo'       => 'vacaciones',
        ]);

        $this->reservar($cliente, $barbero, $servicio, '10:00', 3)->assertStatus(409);
    }

    public function test_reagendar_rechaza_horario_ocupado(): void
    {
        Mail::fake();
        [$barberia, $barbero, $servicio, $cliente] = $this->setupConDuracion(30);

        $fecha = now()->addDays(3)->format('Y-m-d');

        Cita::factory()->confirmada()->create([
            'barberia_id' => $barberia->id,
            'barbero_id'  => $barbero->id,
            'servicio_id' => $servicio->id,
            'fecha'       => $fecha,
            'hora'        => '11:00',
        ]);

        $mia = Cita::factory()->confirmada()->create([
            'barberia_id' => $barberia->id,
            'barbero_id'  => $barbero->id,
            'servicio_id' => $servicio->id,
            'cliente_id'  => $cliente->id,
            'fecha'       => $fecha,
            'hora'        => '15:00',
        ]);

        $this->actingAs($cliente)
             ->patchJson("/api/citas/{$mia->id}/reagendar", ['fecha' => $fecha, 'hora' => '11:00'])
             ->assertStatus(409);
    }

    public function test_reagendar_rechaza_hora_fuera_del_turno(): void
    {
        Mail::fake();
        [$barberia, $barbero, $servicio, $cliente] = $this->setupConDuracion(30);

        $mia = Cita::factory()->confirmada()->create([
            'barberia_id' => $barberia->id,
            'barbero_id'  => $barbero->id,
            'servicio_id' => $servicio->id,
            'cliente_id'  => $cliente->id,
            'fecha'       => now()->addDays(3)->format('Y-m-d'),
            'hora'        => '15:00',
        ]);

        $this->actingAs($cliente)
             ->patchJson("/api/citas/{$mia->id}/reagendar", [
                 'fecha' => now()->addDays(4)->format('Y-m-d'),
                 'hora'  => '03:00',
             ])
             ->assertStatus(422);
    }

    public function test_usuario_no_autenticado_no_puede_crear_cita(): void
    {
        [$barberia, $barbero, $servicio] = $this->setupBarberia();

        $response = $this->postJson('/api/citas', [
            'barberia_id' => $barberia->id,
            'barbero_id'  => $barbero->id,
            'servicio_id' => $servicio->id,
            'fecha'       => now()->addDays(3)->format('Y-m-d'),
            'hora'        => '10:00',
        ]);

        $response->assertStatus(401);
    }
}
