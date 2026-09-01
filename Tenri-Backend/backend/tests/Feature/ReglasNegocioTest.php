<?php

namespace Tests\Feature;

use App\Mail\CalificaTuVisitaMail;
use App\Models\Barberia;
use App\Models\Cita;
use App\Models\Servicio;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * ============================================================
 * Reglas de negocio — Pack "mejoras funcionales"
 * ============================================================
 *  1. El reagendo del cliente respeta tiempo_cancelacion
 *  2. Tope de citas activas por cliente (MAX 3)
 *  3. El cliente no puede tener dos citas solapadas (ni en
 *     barberías distintas)
 *  4. citas:finalizar-vencidas cierra confirmadas pasadas +24h
 *  5. Al finalizar una cita se invita al cliente a calificar
 * ============================================================
 */
class ReglasNegocioTest extends TestCase
{
    use RefreshDatabase;

    private function setupBarberia(array $barberiaAttrs = []): array
    {
        $barberia = Barberia::factory()->create($barberiaAttrs);
        $barbero  = User::factory()->barbero($barberia->id)->create();
        $servicio = Servicio::factory()->create([
            'barberia_id'      => $barberia->id,
            'duracion_minutos' => 30,
        ]);
        $cliente  = User::factory()->cliente()->create();
        return [$barberia, $barbero, $servicio, $cliente];
    }

    private function crearCita(array $attrs): Cita
    {
        return Cita::factory()->create(array_merge([
            'estado' => 'confirmada',
        ], $attrs));
    }

    // ── 1. Anticipación mínima para reagendar ──────────────────

    public function test_cliente_no_puede_reagendar_dentro_de_la_ventana_de_anticipacion(): void
    {
        // Política máxima (30 días): una cita a 5 días queda dentro de la ventana.
        [$barberia, $barbero, $servicio, $cliente] = $this->setupBarberia([
            'tiempo_cancelacion' => 43200,
        ]);

        $cita = $this->crearCita([
            'barberia_id' => $barberia->id,
            'barbero_id'  => $barbero->id,
            'servicio_id' => $servicio->id,
            'cliente_id'  => $cliente->id,
            'fecha'       => now()->addDays(5)->format('Y-m-d'),
            'hora'        => '15:00',
        ]);

        $response = $this->actingAs($cliente)->patchJson("/api/citas/{$cita->id}/reagendar", [
            'fecha' => now()->addDays(6)->format('Y-m-d'),
            'hora'  => '11:00',
        ]);

        $response->assertStatus(403);
        $this->assertDatabaseHas('citas', ['id' => $cita->id, 'hora' => '15:00']);
    }

    public function test_cliente_puede_reagendar_fuera_de_la_ventana_de_anticipacion(): void
    {
        [$barberia, $barbero, $servicio, $cliente] = $this->setupBarberia([
            'tiempo_cancelacion' => 0,
        ]);

        $cita = $this->crearCita([
            'barberia_id' => $barberia->id,
            'barbero_id'  => $barbero->id,
            'servicio_id' => $servicio->id,
            'cliente_id'  => $cliente->id,
            'fecha'       => now()->addDays(5)->format('Y-m-d'),
            'hora'        => '15:00',
        ]);

        $response = $this->actingAs($cliente)->patchJson("/api/citas/{$cita->id}/reagendar", [
            'fecha' => now()->addDays(6)->format('Y-m-d'),
            'hora'  => '11:00',
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('citas', ['id' => $cita->id, 'hora' => '11:00']);
    }

    // ── 2. Tope de citas activas ───────────────────────────────

    public function test_cliente_no_puede_superar_el_maximo_de_citas_activas(): void
    {
        Mail::fake();
        [$barberia, $barbero, $servicio, $cliente] = $this->setupBarberia();

        // 3 citas activas futuras en horarios distintos
        foreach (['10:00', '12:00', '14:00'] as $hora) {
            $this->crearCita([
                'barberia_id' => $barberia->id,
                'barbero_id'  => $barbero->id,
                'servicio_id' => $servicio->id,
                'cliente_id'  => $cliente->id,
                'fecha'       => now()->addDays(3)->format('Y-m-d'),
                'hora'        => $hora,
            ]);
        }

        $response = $this->actingAs($cliente)->postJson('/api/citas', [
            'barbero_id'  => $barbero->id,
            'servicio_id' => $servicio->id,
            'fecha'       => now()->addDays(4)->format('Y-m-d'),
            'hora'        => '16:00',
        ]);

        $response->assertStatus(422);
        $this->assertSame(3, Cita::where('cliente_id', $cliente->id)->count());
    }

    public function test_las_citas_finalizadas_no_cuentan_para_el_tope(): void
    {
        Mail::fake();
        [$barberia, $barbero, $servicio, $cliente] = $this->setupBarberia();

        foreach (['10:00', '12:00', '14:00'] as $hora) {
            $this->crearCita([
                'barberia_id' => $barberia->id,
                'barbero_id'  => $barbero->id,
                'servicio_id' => $servicio->id,
                'cliente_id'  => $cliente->id,
                'fecha'       => now()->subDays(10)->format('Y-m-d'),
                'hora'        => $hora,
                'estado'      => 'finalizada',
            ]);
        }

        $response = $this->actingAs($cliente)->postJson('/api/citas', [
            'barbero_id'  => $barbero->id,
            'servicio_id' => $servicio->id,
            'fecha'       => now()->addDays(4)->format('Y-m-d'),
            'hora'        => '16:00',
        ]);

        $response->assertStatus(201);
    }

    // ── 3. Anti-solape del propio cliente ──────────────────────

    public function test_cliente_no_puede_reservar_dos_citas_solapadas_en_barberias_distintas(): void
    {
        Mail::fake();
        [$barberiaA, $barberoA, $servicioA, $cliente] = $this->setupBarberia();

        // Segunda barbería independiente
        $barberiaB = Barberia::factory()->create();
        $barberoB  = User::factory()->barbero($barberiaB->id)->create();
        $servicioB = Servicio::factory()->create([
            'barberia_id'      => $barberiaB->id,
            'duracion_minutos' => 30,
        ]);

        $fecha = now()->addDays(3)->format('Y-m-d');

        $this->crearCita([
            'barberia_id' => $barberiaA->id,
            'barbero_id'  => $barberoA->id,
            'servicio_id' => $servicioA->id,
            'cliente_id'  => $cliente->id,
            'fecha'       => $fecha,
            'hora'        => '10:00',
        ]);

        // Mismo día y hora, otra barbería: el cliente no puede estar en dos lugares.
        $response = $this->actingAs($cliente)->postJson('/api/citas', [
            'barbero_id'  => $barberoB->id,
            'servicio_id' => $servicioB->id,
            'fecha'       => $fecha,
            'hora'        => '10:00',
        ]);

        $response->assertStatus(409);
    }

    // ── 4. Auto-finalización de citas vencidas ─────────────────

    public function test_comando_finaliza_citas_confirmadas_vencidas_y_respeta_las_vigentes(): void
    {
        Mail::fake();
        [$barberia, $barbero, $servicio, $cliente] = $this->setupBarberia();

        $vencida = $this->crearCita([
            'barberia_id' => $barberia->id,
            'barbero_id'  => $barbero->id,
            'servicio_id' => $servicio->id,
            'cliente_id'  => $cliente->id,
            'fecha'       => now()->subDays(2)->format('Y-m-d'),
            'hora'        => '10:00',
        ]);

        $vigente = $this->crearCita([
            'barberia_id' => $barberia->id,
            'barbero_id'  => $barbero->id,
            'servicio_id' => $servicio->id,
            'cliente_id'  => $cliente->id,
            'fecha'       => now()->addDays(2)->format('Y-m-d'),
            'hora'        => '10:00',
        ]);

        $pendienteVieja = $this->crearCita([
            'barberia_id' => $barberia->id,
            'barbero_id'  => $barbero->id,
            'servicio_id' => $servicio->id,
            'cliente_id'  => $cliente->id,
            'fecha'       => now()->subDays(2)->format('Y-m-d'),
            'hora'        => '12:00',
            'estado'      => 'pendiente',
        ]);

        $this->artisan('citas:finalizar-vencidas')->assertExitCode(0);

        $this->assertDatabaseHas('citas', ['id' => $vencida->id,        'estado' => 'finalizada']);
        $this->assertDatabaseHas('citas', ['id' => $vigente->id,        'estado' => 'confirmada']);
        $this->assertDatabaseHas('citas', ['id' => $pendienteVieja->id, 'estado' => 'pendiente']);

        // La auto-finalizada dispara la invitación a calificar
        Mail::assertQueued(CalificaTuVisitaMail::class, fn ($mail) => $mail->cita->id === $vencida->id);
    }

    // ── 5. Correo "califica tu visita" ─────────────────────────

    public function test_finalizar_una_cita_envia_invitacion_a_calificar(): void
    {
        Mail::fake();
        [$barberia, $barbero, $servicio, $cliente] = $this->setupBarberia();
        $admin = User::factory()->admin($barberia->id)->create();

        $cita = $this->crearCita([
            'barberia_id' => $barberia->id,
            'barbero_id'  => $barbero->id,
            'servicio_id' => $servicio->id,
            'cliente_id'  => $cliente->id,
            'fecha'       => now()->subDay()->format('Y-m-d'),
            'hora'        => '10:00',
        ]);

        $response = $this->actingAs($admin)->patchJson("/api/citas/{$cita->id}/estado", [
            'estado' => 'finalizada',
        ]);

        $response->assertStatus(200);
        Mail::assertQueued(CalificaTuVisitaMail::class, fn ($mail) => $mail->cita->id === $cita->id);
    }

    public function test_cancelar_una_cita_no_envia_invitacion_a_calificar(): void
    {
        Mail::fake();
        [$barberia, $barbero, $servicio, $cliente] = $this->setupBarberia();
        $admin = User::factory()->admin($barberia->id)->create();

        $cita = $this->crearCita([
            'barberia_id' => $barberia->id,
            'barbero_id'  => $barbero->id,
            'servicio_id' => $servicio->id,
            'cliente_id'  => $cliente->id,
            'fecha'       => now()->addDays(2)->format('Y-m-d'),
            'hora'        => '10:00',
        ]);

        $this->actingAs($admin)->patchJson("/api/citas/{$cita->id}/estado", [
            'estado' => 'cancelada',
        ])->assertStatus(200);

        Mail::assertNotQueued(CalificaTuVisitaMail::class);
    }
}
