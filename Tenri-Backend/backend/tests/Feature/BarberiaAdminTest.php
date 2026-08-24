<?php

namespace Tests\Feature;

use App\Models\Barberia;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BarberiaAdminTest extends TestCase
{
    use RefreshDatabase;

    private function crearAdminConBarberia(): array
    {
        $barberia = Barberia::factory()->create();
        $admin    = User::factory()->admin($barberia->id)->create();
        return [$admin, $barberia];
    }

    public function test_barberia_publica_por_slug(): void
    {
        $barberia = Barberia::factory()->create();

        $this->getJson("/api/barberias/{$barberia->slug}")
             ->assertStatus(200)
             ->assertJsonPath('id', $barberia->id);

        $this->getJson('/api/barberias/slug-inexistente')
             ->assertStatus(404);
    }

    public function test_superadmin_sin_barberia_recibe_403_en_mi_barberia(): void
    {
        $superadmin = User::factory()->superadmin()->create();

        // El bypass de CheckRole lo deja entrar; antes findOrFail(null) daba 404.
        $this->actingAs($superadmin)->getJson('/api/mi-barberia')->assertStatus(403);
        $this->actingAs($superadmin)->putJson('/api/mi-barberia', ['tiempo_cancelacion' => 60])->assertStatus(403);
    }

    public function test_admin_puede_ver_su_barberia(): void
    {
        [$admin, $barberia] = $this->crearAdminConBarberia();

        $response = $this->actingAs($admin)
                         ->getJson('/api/mi-barberia');

        $response->assertStatus(200)
                 ->assertJsonPath('id', $barberia->id);
    }

    public function test_admin_puede_actualizar_config_de_su_barberia(): void
    {
        [$admin, $barberia] = $this->crearAdminConBarberia();

        $response = $this->actingAs($admin)
                         ->putJson('/api/mi-barberia', [
                             'tiempo_cancelacion' => 60,
                         ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('barberias', [
            'id'                  => $barberia->id,
            'tiempo_cancelacion'  => 60,
        ]);
    }

    public function test_admin_puede_ver_su_equipo(): void
    {
        [$admin, $barberia] = $this->crearAdminConBarberia();
        User::factory()->barbero($barberia->id)->count(3)->create();

        $response = $this->actingAs($admin)
                         ->getJson('/api/mi-equipo');

        $response->assertStatus(200);
    }

    public function test_admin_puede_asignar_rol_barbero(): void
    {
        [$admin, $barberia] = $this->crearAdminConBarberia();
        $usuario = User::factory()->cliente()->create([
            'email' => 'asignar.barbero@gmail.com',
        ]);

        $response = $this->actingAs($admin)
                         ->postJson('/api/barberos/asignar', [
                             'email'       => $usuario->email,
                             'hora_inicio' => '09:00',
                             'hora_fin'    => '18:00',
                         ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('users', [
            'id'  => $usuario->id,
            'rol' => 'barbero',
        ]);
    }

    public function test_admin_puede_remover_barbero(): void
    {
        [$admin, $barberia] = $this->crearAdminConBarberia();
        $barbero = User::factory()->barbero($barberia->id)->create();

        $response = $this->actingAs($admin)
                         ->deleteJson("/api/barberos/{$barbero->id}");

        $response->assertStatus(200);
        $this->assertDatabaseHas('users', [
            'id'          => $barbero->id,
            'rol'         => 'cliente',
            'barberia_id' => null,
        ]);
    }

    public function test_cliente_no_puede_acceder_a_mi_barberia(): void
    {
        $cliente = User::factory()->cliente()->create();

        $response = $this->actingAs($cliente)
                         ->getJson('/api/mi-barberia');

        $response->assertStatus(403);
    }

    public function test_admin_no_puede_ver_barberia_de_otro_tenant(): void
    {
        [$admin] = $this->crearAdminConBarberia();

        // Otra barbería con su propio admin
        $otraBarberia = Barberia::factory()->create();
        $otroAdmin    = User::factory()->admin($otraBarberia->id)->create();

        // El admin solo puede ver su propia barbería
        $response = $this->actingAs($admin)
                         ->getJson('/api/mi-barberia');

        $response->assertStatus(200)
                 ->assertJsonPath('id', $admin->barberia_id);
    }
}
