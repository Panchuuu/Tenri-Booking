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

    public function test_admin_puede_actualizar_ubicacion(): void
    {
        [$admin, $barberia] = $this->crearAdminConBarberia();

        $this->actingAs($admin)->putJson('/api/mi-barberia', [
            'direccion' => 'Av. Providencia 1234, Local 5, Santiago',
            'latitud'   => -33.4489,
            'longitud'  => -70.6693,
        ])->assertStatus(200);

        $barberia->refresh();
        $this->assertEquals('Av. Providencia 1234, Local 5, Santiago', $barberia->direccion);
        $this->assertEqualsWithDelta(-33.4489, $barberia->latitud, 0.0001);
        $this->assertEqualsWithDelta(-70.6693, $barberia->longitud, 0.0001);
    }

    public function test_coordenada_suelta_es_rechazada(): void
    {
        [$admin] = $this->crearAdminConBarberia();

        // Una latitud sin longitud (o viceversa) no sirve para "cerca de mí".
        $this->actingAs($admin)->putJson('/api/mi-barberia', [
            'latitud' => -33.4489,
        ])->assertStatus(422);

        $this->actingAs($admin)->putJson('/api/mi-barberia', [
            'longitud' => -70.6693,
        ])->assertStatus(422);
    }

    public function test_admin_puede_borrar_su_ubicacion(): void
    {
        [$admin, $barberia] = $this->crearAdminConBarberia();
        $barberia->update([
            'direccion' => 'Av. Vieja 111',
            'latitud'   => -33.4,
            'longitud'  => -70.6,
        ]);

        // Mi Tienda envía los campos vacíos para limpiar la ubicación.
        $this->actingAs($admin)->putJson('/api/mi-barberia', [
            'direccion' => '',
            'latitud'   => null,
            'longitud'  => null,
        ])->assertStatus(200);

        $barberia->refresh();
        $this->assertNull($barberia->direccion);
        $this->assertNull($barberia->latitud);
        $this->assertNull($barberia->longitud);
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
