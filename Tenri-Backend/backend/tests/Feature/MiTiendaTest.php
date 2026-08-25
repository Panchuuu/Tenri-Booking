<?php

namespace Tests\Feature;

use App\Models\Barberia;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MiTiendaTest extends TestCase
{
    use RefreshDatabase;

    private function crearAdminConBarberia(): array
    {
        $barberia = Barberia::factory()->create();
        $admin    = User::factory()->admin($barberia->id)->create();
        return [$admin, $barberia];
    }

    public function test_catalogo_de_rubros_es_publico(): void
    {
        $respuesta = $this->getJson('/api/rubros')->assertStatus(200)->json();

        $claves = array_column($respuesta, 'clave');
        $this->assertContains('barberia', $claves);
        $this->assertContains('salon_belleza', $claves);
        $this->assertContains('perfumeria', $claves);
        $this->assertNotEmpty(array_column($respuesta, 'etiqueta'));
    }

    public function test_admin_puede_actualizar_perfil_de_su_tienda(): void
    {
        [$admin, $barberia] = $this->crearAdminConBarberia();
        $slugOriginal = $barberia->slug;

        $this->actingAs($admin)->putJson('/api/mi-barberia', [
            'nombre'          => 'Estética Aurora',
            'rubro'           => 'centro_estetica',
            'color_principal' => '#8b5cf6',
        ])->assertStatus(200);

        $barberia->refresh();
        $this->assertEquals('Estética Aurora', $barberia->nombre);
        $this->assertEquals('centro_estetica', $barberia->rubro);
        $this->assertEquals('#8b5cf6', $barberia->color_principal);
        // El slug es la URL pública: renombrar NO debe cambiarlo.
        $this->assertEquals($slugOriginal, $barberia->slug);
    }

    public function test_rubro_invalido_es_rechazado(): void
    {
        [$admin] = $this->crearAdminConBarberia();

        $this->actingAs($admin)->putJson('/api/mi-barberia', [
            'rubro' => 'venta_de_autos',
        ])->assertStatus(422);
    }

    public function test_nombre_duplicado_es_rechazado(): void
    {
        [$admin] = $this->crearAdminConBarberia();
        $otra = Barberia::factory()->create();

        $this->actingAs($admin)->putJson('/api/mi-barberia', [
            'nombre' => $otra->nombre,
        ])->assertStatus(422);
    }

    public function test_actualizar_solo_politica_no_exige_campos_de_perfil(): void
    {
        [$admin, $barberia] = $this->crearAdminConBarberia();
        $nombreOriginal = $barberia->nombre;

        $this->actingAs($admin)->putJson('/api/mi-barberia', [
            'tiempo_cancelacion' => 120,
        ])->assertStatus(200);

        $barberia->refresh();
        $this->assertEquals(120, $barberia->tiempo_cancelacion);
        $this->assertEquals($nombreOriginal, $barberia->nombre);
    }

    public function test_rubro_aparece_en_listado_publico(): void
    {
        Barberia::factory()->create(['rubro' => 'perfumeria']);

        $json = $this->getJson('/api/barberias?per_page=50')->assertStatus(200)->json();

        $rubros = array_column($json['data'], 'rubro');
        $this->assertContains('perfumeria', $rubros);
        $this->assertContains('Perfumería', array_column($json['data'], 'rubro_nombre'));
    }
}
