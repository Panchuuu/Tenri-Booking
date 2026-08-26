<?php

namespace Tests\Feature;

use App\Models\Barberia;
use App\Models\Cita;
use App\Models\Servicio;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class AgendaTest extends TestCase
{
    use RefreshDatabase;

    private function setupCompleto(): array
    {
        $barberia = Barberia::factory()->create(['tiempo_cancelacion' => 0]);
        $admin    = User::factory()->admin($barberia->id)->create();
        $barbero  = User::factory()->barbero($barberia->id)->create();
        $servicio = Servicio::factory()->create(['barberia_id' => $barberia->id]);
        $cliente  = User::factory()->cliente()->create();
        return [$barberia, $admin, $barbero, $servicio, $cliente];
    }

    public function test_admin_puede_ver_todas_las_citas(): void
    {
        [$barberia, $admin, $barbero, $servicio, $cliente] = $this->setupCompleto();

        Cita::factory()->count(4)->create([
            'barberia_id' => $barberia->id,
            'barbero_id'  => $barbero->id,
            'servicio_id' => $servicio->id,
            'cliente_id'  => $cliente->id,
        ]);

        $response = $this->actingAs($admin)
                         ->getJson('/api/citas');

        $response->assertStatus(200);
    }

    public function test_admin_puede_confirmar_cita(): void
    {
        Mail::fake();
        [$barberia, $admin, $barbero, $servicio, $cliente] = $this->setupCompleto();

        $cita = Cita::factory()->create([
            'barberia_id' => $barberia->id,
            'barbero_id'  => $barbero->id,
            'servicio_id' => $servicio->id,
            'cliente_id'  => $cliente->id,
            'estado'      => 'pendiente',
        ]);

        $response = $this->actingAs($admin)
                         ->patchJson("/api/citas/{$cita->id}/estado", [
                             'estado' => 'confirmada',
                         ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('citas', [
            'id'     => $cita->id,
            'estado' => 'confirmada',
        ]);
    }

    public function test_admin_puede_cancelar_cita(): void
    {
        Mail::fake();
        [$barberia, $admin, $barbero, $servicio, $cliente] = $this->setupCompleto();

        $cita = Cita::factory()->create([
            'barberia_id' => $barberia->id,
            'barbero_id'  => $barbero->id,
            'servicio_id' => $servicio->id,
            'cliente_id'  => $cliente->id,
            'estado'      => 'confirmada',
        ]);

        $response = $this->actingAs($admin)
                         ->patchJson("/api/citas/{$cita->id}/estado", [
                             'estado' => 'cancelada',
                         ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('citas', [
            'id'     => $cita->id,
            'estado' => 'cancelada',
        ]);
    }

    public function test_cliente_puede_reagendar_su_cita(): void
    {
        [$barberia, $admin, $barbero, $servicio, $cliente] = $this->setupCompleto();

        $cita = Cita::factory()->create([
            'barberia_id' => $barberia->id,
            'barbero_id'  => $barbero->id,
            'servicio_id' => $servicio->id,
            'cliente_id'  => $cliente->id,
            'fecha'       => now()->addDays(3)->format('Y-m-d'),
            'hora'        => '10:00',
            'estado'      => 'confirmada',
        ]);

        $nuevaFecha = now()->addDays(7)->format('Y-m-d');

        $response = $this->actingAs($cliente)
                         ->patchJson("/api/citas/{$cita->id}/reagendar", [
                             'fecha' => $nuevaFecha,
                             'hora'  => '14:00',
                         ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('citas', [
            'id'    => $cita->id,
            'fecha' => $nuevaFecha,
            'hora'  => '14:00',
        ]);
    }

    public function test_cliente_no_puede_cancelar_cita_de_otro_cliente(): void
    {
        [$barberia, $admin, $barbero, $servicio, $cliente] = $this->setupCompleto();
        $otroCliente = User::factory()->cliente()->create();

        $cita = Cita::factory()->create([
            'barberia_id' => $barberia->id,
            'barbero_id'  => $barbero->id,
            'servicio_id' => $servicio->id,
            'cliente_id'  => $cliente->id,
            'fecha'       => now()->addDays(5)->format('Y-m-d'),
            'hora'        => '15:00',
            'estado'      => 'confirmada',
        ]);

        $response = $this->actingAs($otroCliente)
                         ->patchJson("/api/mis-citas/{$cita->id}/cancelar");

        $response->assertStatus(404);
    }

    public function test_cliente_no_puede_ver_agenda_del_admin(): void
    {
        $cliente = User::factory()->cliente()->create();

        $response = $this->actingAs($cliente)
                         ->getJson('/api/citas');

        $response->assertStatus(403);
    }

    public function test_reactivar_cancelada_es_rechazado_si_el_horario_fue_tomado(): void
    {
        [$barberia, $admin, $barbero, $servicio, $cliente] = $this->setupCompleto();
        $fecha = now()->addDays(3)->format('Y-m-d');

        $cancelada = Cita::factory()->create([
            'barberia_id' => $barberia->id,
            'barbero_id'  => $barbero->id,
            'servicio_id' => $servicio->id,
            'cliente_id'  => $cliente->id,
            'fecha'       => $fecha,
            'hora'        => '10:00',
            'estado'      => 'cancelada',
        ]);

        // Al cancelarse, el hueco se liberó y otro cliente lo tomó.
        Cita::factory()->create([
            'barberia_id' => $barberia->id,
            'barbero_id'  => $barbero->id,
            'servicio_id' => $servicio->id,
            'fecha'       => $fecha,
            'hora'        => '10:00',
            'estado'      => 'confirmada',
        ]);

        $this->actingAs($admin)
             ->patchJson("/api/citas/{$cancelada->id}/estado", ['estado' => 'confirmada'])
             ->assertStatus(409);

        $this->assertDatabaseHas('citas', [
            'id'     => $cancelada->id,
            'estado' => 'cancelada',
        ]);
    }

    public function test_reactivar_cancelada_funciona_si_el_hueco_sigue_libre(): void
    {
        [$barberia, $admin, $barbero, $servicio, $cliente] = $this->setupCompleto();

        $cancelada = Cita::factory()->create([
            'barberia_id' => $barberia->id,
            'barbero_id'  => $barbero->id,
            'servicio_id' => $servicio->id,
            'cliente_id'  => $cliente->id,
            'fecha'       => now()->addDays(3)->format('Y-m-d'),
            'hora'        => '10:00',
            'estado'      => 'cancelada',
        ]);

        $this->actingAs($admin)
             ->patchJson("/api/citas/{$cancelada->id}/estado", ['estado' => 'confirmada'])
             ->assertStatus(200);

        $this->assertDatabaseHas('citas', [
            'id'     => $cancelada->id,
            'estado' => 'confirmada',
        ]);
    }
}
