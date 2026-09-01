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

    public function test_superadmin_ve_todas_las_barberias_incluidas_las_suspendidas(): void
    {
        $superadmin = User::factory()->superadmin()->create();
        $activa     = Barberia::factory()->create();
        $suspendida = Barberia::factory()->create();
        $suspendida->alternarSuspension();

        // El público no la ve; el superadmin sí — es quien puede reactivarla.
        $this->getJson('/api/barberias')->assertOk()->assertJsonPath('total', 1);

        $respuesta = $this->actingAs($superadmin)
            ->getJson('/api/superadmin/barberias')
            ->assertOk();

        $barberias = collect($respuesta->json('barberias'));
        $this->assertCount(2, $barberias);
        $this->assertFalse($barberias->firstWhere('id', $suspendida->id)['activa']);
        $this->assertTrue($barberias->firstWhere('id', $activa->id)['activa']);
    }

    public function test_admin_no_puede_ver_el_listado_de_superadmin(): void
    {
        $barberia = Barberia::factory()->create();
        $admin    = User::factory()->admin($barberia->id)->create();

        $this->actingAs($admin)->getJson('/api/superadmin/barberias')->assertStatus(403);
        $this->actingAs($admin)->patchJson("/api/superadmin/barberias/{$barberia->id}/suspender")->assertStatus(403);
    }

    public function test_superadmin_puede_suspender_y_reactivar_una_barberia(): void
    {
        $superadmin = User::factory()->superadmin()->create();
        $barberia   = Barberia::factory()->create();
        $admin      = User::factory()->admin($barberia->id)->create();
        $admin->createToken('sesion-viva');

        // Suspender: sale del público y las sesiones de sus usuarios caen.
        $this->actingAs($superadmin)
            ->patchJson("/api/superadmin/barberias/{$barberia->id}/suspender")
            ->assertOk()
            ->assertJsonPath('barberia.activa', false);

        $this->getJson('/api/barberias')->assertOk()->assertJsonPath('total', 0);
        $this->assertSame(0, $admin->tokens()->count());

        // Reactivar: todo vuelve, nada se borró.
        $this->actingAs($superadmin)
            ->patchJson("/api/superadmin/barberias/{$barberia->id}/suspender")
            ->assertOk()
            ->assertJsonPath('barberia.activa', true);

        $this->getJson('/api/barberias')->assertOk()->assertJsonPath('total', 1);
        $this->assertDatabaseHas('users', ['id' => $admin->id]);
    }
}
