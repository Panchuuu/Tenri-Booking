<?php

namespace Tests\Feature;

use App\Models\Barberia;
use App\Models\Cita;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CalificacionPublicaTest extends TestCase
{
    use RefreshDatabase;

    public function test_listado_publico_incluye_promedio_y_total_de_resenas(): void
    {
        $barberia = Barberia::factory()->create();

        Cita::factory()->create(['barberia_id' => $barberia->id, 'estado' => 'finalizada', 'calificacion' => 5]);
        Cita::factory()->create(['barberia_id' => $barberia->id, 'estado' => 'finalizada', 'calificacion' => 3]);
        // Sin calificación: no debe contar en el promedio.
        Cita::factory()->create(['barberia_id' => $barberia->id, 'estado' => 'finalizada']);

        $json = $this->getJson('/api/barberias?per_page=50')
             ->assertStatus(200)
             ->json();

        $fila = collect($json['data'])->firstWhere('id', $barberia->id);

        $this->assertNotNull($fila);
        $this->assertEquals(4, (float) $fila['calificacion_promedio']);
        $this->assertEquals(2, $fila['total_resenas']);
    }

    public function test_detalle_por_slug_incluye_promedio_y_ubicacion(): void
    {
        $barberia = Barberia::factory()->create([
            'direccion' => 'Av. Siempre Viva 742, Santiago',
            'latitud'   => -33.4489,
            'longitud'  => -70.6693,
        ]);

        Cita::factory()->create(['barberia_id' => $barberia->id, 'estado' => 'finalizada', 'calificacion' => 4]);

        $this->getJson("/api/barberias/{$barberia->slug}")
             ->assertStatus(200)
             ->assertJsonPath('total_resenas', 1)
             ->assertJsonPath('direccion', 'Av. Siempre Viva 742, Santiago');
    }

    public function test_barberia_sin_resenas_expone_promedio_nulo(): void
    {
        $barberia = Barberia::factory()->create();

        $this->getJson("/api/barberias/{$barberia->slug}")
             ->assertStatus(200)
             ->assertJsonPath('calificacion_promedio', null)
             ->assertJsonPath('total_resenas', 0);
    }
}
