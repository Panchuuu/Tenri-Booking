<?php

namespace Tests\Feature;

use App\Models\Barberia;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FavoritoTest extends TestCase
{
    use RefreshDatabase;

    public function test_favoritos_requieren_autenticacion(): void
    {
        $barberia = Barberia::factory()->create();

        $this->getJson('/api/mis-favoritos')->assertStatus(401);
        $this->postJson("/api/barberias/{$barberia->id}/favorito")->assertStatus(401);
    }

    public function test_cliente_puede_marcar_y_desmarcar_favorita(): void
    {
        $cliente  = User::factory()->cliente()->create();
        $barberia = Barberia::factory()->create();

        // Marcar
        $this->actingAs($cliente)
             ->postJson("/api/barberias/{$barberia->id}/favorito")
             ->assertStatus(200)
             ->assertJsonPath('es_favorita', true);

        $this->assertDatabaseHas('favoritos', [
            'user_id'     => $cliente->id,
            'barberia_id' => $barberia->id,
        ]);

        // Desmarcar (toggle)
        $this->actingAs($cliente)
             ->postJson("/api/barberias/{$barberia->id}/favorito")
             ->assertStatus(200)
             ->assertJsonPath('es_favorita', false);

        $this->assertDatabaseMissing('favoritos', [
            'user_id'     => $cliente->id,
            'barberia_id' => $barberia->id,
        ]);
    }

    public function test_mis_favoritos_devuelve_solo_los_del_usuario(): void
    {
        $cliente = User::factory()->cliente()->create();
        $otro    = User::factory()->cliente()->create();
        [$b1, $b2] = Barberia::factory()->count(2)->create();

        $cliente->barberiasFavoritas()->attach($b1->id);
        $otro->barberiasFavoritas()->attach($b2->id);

        $respuesta = $this->actingAs($cliente)
             ->getJson('/api/mis-favoritos')
             ->assertStatus(200)
             ->json('barberia_ids');

        $this->assertEquals([$b1->id], $respuesta);
    }

    public function test_favorito_de_barberia_inexistente_da_404(): void
    {
        $cliente = User::factory()->cliente()->create();

        $this->actingAs($cliente)
             ->postJson('/api/barberias/999999/favorito')
             ->assertStatus(404);
    }
}
