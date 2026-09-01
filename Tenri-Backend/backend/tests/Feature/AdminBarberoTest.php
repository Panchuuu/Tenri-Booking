<?php

namespace Tests\Feature;

use App\Models\Barberia;
use App\Models\Cita;
use App\Models\Servicio;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * ============================================================
 * Rol dual — el dueño (admin) que también atiende como barbero
 * ============================================================
 * `rol` sigue siendo el rol principal; `es_barbero` agrega la
 * capacidad de atender sin perder el panel de administración.
 * ============================================================
 */
class AdminBarberoTest extends TestCase
{
    use RefreshDatabase;

    private function setupBarberiaConAdmin(): array
    {
        $barberia = Barberia::factory()->create();
        // Email con dominio real: AsignarRolRequest valida email:dns.
        $admin    = User::factory()->admin($barberia->id)->create([
            'email' => 'dueno.' . uniqid() . '@gmail.com',
        ]);
        $servicio = Servicio::factory()->create([
            'barberia_id'      => $barberia->id,
            'duracion_minutos' => 30,
        ]);
        return [$barberia, $admin, $servicio];
    }

    public function test_admin_puede_sumarse_a_su_propio_equipo_sin_perder_su_rol(): void
    {
        [, $admin] = $this->setupBarberiaConAdmin();

        $response = $this->actingAs($admin)->postJson('/api/barberos/asignar', [
            'email'       => $admin->email,
            'hora_inicio' => '10:00',
            'hora_fin'    => '18:00',
        ]);

        $response->assertStatus(200);
        $admin->refresh();
        $this->assertSame('admin', $admin->rol);
        $this->assertTrue($admin->es_barbero);
        $this->assertNotNull($admin->barberia_id);
    }

    public function test_admin_de_otra_barberia_no_puede_ser_capturado(): void
    {
        [, $admin] = $this->setupBarberiaConAdmin();

        $otraBarberia = Barberia::factory()->create();
        $otroAdmin    = User::factory()->admin($otraBarberia->id)->create([
            'email' => 'otro.dueno.' . uniqid() . '@gmail.com',
        ]);

        $response = $this->actingAs($admin)->postJson('/api/barberos/asignar', [
            'email' => $otroAdmin->email,
        ]);

        $response->assertStatus(422);
        $otroAdmin->refresh();
        $this->assertSame('admin', $otroAdmin->rol);
        $this->assertFalse((bool) $otroAdmin->es_barbero);
    }

    public function test_admin_barbero_aparece_en_el_listado_publico_de_barberos(): void
    {
        [$barberia, $admin] = $this->setupBarberiaConAdmin();
        $admin->update(['es_barbero' => true]);

        $response = $this->getJson("/api/barberos?barberia={$barberia->slug}");

        $response->assertStatus(200);
        $ids = collect($response->json())->pluck('id');
        $this->assertTrue($ids->contains($admin->id));
    }

    public function test_admin_sin_es_barbero_no_aparece_en_el_listado_publico(): void
    {
        [$barberia, $admin] = $this->setupBarberiaConAdmin();

        $response = $this->getJson("/api/barberos?barberia={$barberia->slug}");

        $response->assertStatus(200);
        $ids = collect($response->json())->pluck('id');
        $this->assertFalse($ids->contains($admin->id));
    }

    public function test_cliente_puede_reservar_con_el_admin_barbero(): void
    {
        Mail::fake();
        [, $admin, $servicio] = $this->setupBarberiaConAdmin();
        $admin->update(['es_barbero' => true, 'hora_inicio' => '10:00', 'hora_fin' => '18:00']);
        $cliente = User::factory()->cliente()->create();

        $response = $this->actingAs($cliente)->postJson('/api/citas', [
            'barbero_id'  => $admin->id,
            'servicio_id' => $servicio->id,
            'fecha'       => now()->addDays(3)->format('Y-m-d'),
            'hora'        => '11:00',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('citas', [
            'cliente_id' => $cliente->id,
            'barbero_id' => $admin->id,
        ]);
    }

    public function test_disponibilidad_responde_para_el_admin_barbero(): void
    {
        [, $admin] = $this->setupBarberiaConAdmin();
        $admin->update(['es_barbero' => true]);

        $fecha = now()->addDays(3)->format('Y-m-d');
        $this->getJson("/api/barberos/{$admin->id}/disponibilidad?fecha={$fecha}")
             ->assertStatus(200)
             ->assertJsonPath('bloqueado', false);
    }

    public function test_remover_al_dueno_del_equipo_le_quita_es_barbero_pero_conserva_admin(): void
    {
        Mail::fake();
        [$barberia, $admin, $servicio] = $this->setupBarberiaConAdmin();
        $admin->update(['es_barbero' => true]);
        $cliente = User::factory()->cliente()->create();

        // Cita activa con el dueño: debe cancelarse al removerlo
        $cita = Cita::factory()->create([
            'barberia_id' => $barberia->id,
            'barbero_id'  => $admin->id,
            'servicio_id' => $servicio->id,
            'cliente_id'  => $cliente->id,
            'fecha'       => now()->addDays(3)->format('Y-m-d'),
            'hora'        => '11:00',
            'estado'      => 'confirmada',
        ]);

        $response = $this->actingAs($admin)->deleteJson("/api/barberos/{$admin->id}");

        $response->assertStatus(200);
        $admin->refresh();
        $this->assertSame('admin', $admin->rol);
        $this->assertFalse((bool) $admin->es_barbero);
        $this->assertSame($barberia->id, $admin->barberia_id);
        $this->assertDatabaseHas('citas', ['id' => $cita->id, 'estado' => 'cancelada']);
    }

    public function test_admin_puede_editar_su_ficha_de_barbero(): void
    {
        [, $admin] = $this->setupBarberiaConAdmin();
        $admin->update(['es_barbero' => true]);

        $response = $this->actingAs($admin)->putJson("/api/barberos/{$admin->id}", [
            'especialidad' => 'Cortes clásicos · Barba',
            'bio'          => 'Dueño y barbero fundador.',
        ]);

        $response->assertStatus(200);
        $admin->refresh();
        $this->assertSame('Cortes clásicos · Barba', $admin->especialidad);
    }
}
