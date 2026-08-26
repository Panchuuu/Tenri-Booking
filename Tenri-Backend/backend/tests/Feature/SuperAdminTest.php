<?php

namespace Tests\Feature;

use App\Models\Barberia;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SuperAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_superadmin_puede_listar_usuarios(): void
    {
        $superadmin = User::factory()->superadmin()->create();
        User::factory()->count(5)->create();

        $response = $this->actingAs($superadmin)
                         ->getJson('/api/superadmin/usuarios');

        $response->assertStatus(200);
    }

    public function test_admin_no_puede_listar_usuarios_del_sistema(): void
    {
        $barberia = Barberia::factory()->create();
        $admin    = User::factory()->admin($barberia->id)->create();

        $response = $this->actingAs($admin)
                         ->getJson('/api/superadmin/usuarios');

        $response->assertStatus(403);
    }

    public function test_superadmin_puede_cambiar_rol_de_usuario(): void
    {
        $superadmin = User::factory()->superadmin()->create();
        $usuario    = User::factory()->cliente()->create();

        $response = $this->actingAs($superadmin)
                         ->patchJson("/api/superadmin/usuarios/{$usuario->id}/rol", [
                             'rol' => 'admin',
                         ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('users', [
            'id'  => $usuario->id,
            'rol' => 'admin',
        ]);
    }

    public function test_superadmin_puede_suspender_usuario(): void
    {
        $superadmin = User::factory()->superadmin()->create();
        $usuario    = User::factory()->cliente()->create();

        $response = $this->actingAs($superadmin)
                         ->patchJson("/api/superadmin/usuarios/{$usuario->id}/suspender");

        $response->assertStatus(200);
        $this->assertDatabaseHas('users', [
            'id'         => $usuario->id,
            'suspendido' => true,
        ]);
    }

    public function test_superadmin_no_puede_suspenderse_a_si_mismo(): void
    {
        $superadmin = User::factory()->superadmin()->create();

        $response = $this->actingAs($superadmin)
                         ->patchJson("/api/superadmin/usuarios/{$superadmin->id}/suspender");

        $response->assertStatus(403);
    }

    public function test_superadmin_puede_eliminar_usuario(): void
    {
        $superadmin = User::factory()->superadmin()->create();
        $usuario    = User::factory()->cliente()->create();

        $response = $this->actingAs($superadmin)
                         ->deleteJson("/api/superadmin/usuarios/{$usuario->id}");

        $response->assertStatus(200);
        $this->assertDatabaseMissing('users', ['id' => $usuario->id]);
    }

    public function test_superadmin_puede_crear_barberia(): void
    {
        $superadmin = User::factory()->superadmin()->create();

        $response = $this->actingAs($superadmin)
                         ->postJson('/api/barberias', [
                             'nombre_barberia' => 'Barbería Test',
                             'color_principal' => '#10b981',
                             'admin_nombre'    => 'Admin Test',
                             'admin_email'     => 'admin@test.cl',
                             'admin_password'  => 'Admin1234',
                         ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('barberias', ['nombre' => 'Barbería Test']);
    }

    public function test_nombres_distintos_con_mismo_slug_no_colisionan(): void
    {
        $superadmin = User::factory()->superadmin()->create();

        // "Barbería VIP" y "Barberia-VIP" son nombres distintos (pasan el
        // unique de nombre) pero normalizan al mismo slug "barberia-vip",
        // que es la URL pública de la tienda.
        $this->actingAs($superadmin)->postJson('/api/barberias', [
            'nombre_barberia' => 'Barbería VIP',
            'color_principal' => '#10b981',
            'admin_nombre'    => 'Admin Uno',
            'admin_email'     => 'admin.uno@test.cl',
            'admin_password'  => 'Admin1234',
        ])->assertStatus(201);

        $this->actingAs($superadmin)->postJson('/api/barberias', [
            'nombre_barberia' => 'Barberia-VIP',
            'color_principal' => '#f59e0b',
            'admin_nombre'    => 'Admin Dos',
            'admin_email'     => 'admin.dos@test.cl',
            'admin_password'  => 'Admin1234',
        ])->assertStatus(201);

        $this->assertDatabaseHas('barberias', ['slug' => 'barberia-vip']);
        $this->assertDatabaseHas('barberias', ['slug' => 'barberia-vip-2']);
    }
}
