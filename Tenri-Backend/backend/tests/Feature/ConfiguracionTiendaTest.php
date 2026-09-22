<?php

namespace Tests\Feature;

use App\Models\Barberia;
use App\Models\Servicio;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * La puesta en marcha de una tienda recién creada.
 *
 * Quien compra Booking recibe un local con nombre y poco más. Lo que se prueba
 * acá es que el panel sepa decirle qué le falta para recibir su primera
 * reserva, y que el tutorial se ofrezca una sola vez.
 */
class ConfiguracionTiendaTest extends TestCase
{
    use RefreshDatabase;

    private function tiendaRecienCreada(): array
    {
        $barberia = Barberia::factory()->create([
            'direccion' => null,
            'latitud' => null,
            'longitud' => null,
            'logo' => null,
            'onboarding_resuelto_en' => null,
        ]);

        $duenio = User::factory()->create([
            'rol' => 'admin',
            'es_barbero' => false,
            'barberia_id' => $barberia->id,
        ]);
        $duenio->darAccesoA($barberia, 'admin');

        return [$duenio, $barberia];
    }

    public function test_una_tienda_recien_creada_no_tiene_nada_configurado(): void
    {
        [$duenio, $barberia] = $this->tiendaRecienCreada();

        $respuesta = $this->actingAs($duenio)->getJson('/api/mi-barberia/configuracion');

        $respuesta->assertOk()
            ->assertJsonPath('porcentaje', 0)
            ->assertJsonPath('tutorial_pendiente', true)
            ->assertJsonPath('barberia.id', $barberia->id)
            ->assertJsonCount(4, 'pasos');

        foreach ($respuesta->json('pasos') as $paso) {
            $this->assertFalse($paso['completo'], "El paso {$paso['clave']} no debería estar completo.");
        }
    }

    public function test_cada_cosa_configurada_sube_el_avance(): void
    {
        [$duenio, $barberia] = $this->tiendaRecienCreada();

        // La dirección cuenta cuando además quedó ubicada en el mapa: sin
        // coordenadas no aparece en las búsquedas cercanas.
        $barberia->update(['direccion' => 'Av. Siempre Viva 742']);
        $this->assertSame(0, $barberia->fresh()->avanceDeConfiguracion());

        $barberia->update(['latitud' => -33.44, 'longitud' => -70.65]);
        $this->assertSame(25, $barberia->fresh()->avanceDeConfiguracion());

        $barberia->update(['logo' => 'logos_barberias/x.png']);
        $this->assertSame(50, $barberia->fresh()->avanceDeConfiguracion());

        // El dueño puede ser quien atiende: no hace falta contratar a nadie.
        // Atender es **de este local**: el mismo dueño puede no atender en otro.
        $duenio->atenderEn($barberia->id, true);
        $this->assertSame(75, $barberia->fresh()->avanceDeConfiguracion());

        Servicio::factory()->create(['barberia_id' => $barberia->id]);
        $this->assertSame(100, $barberia->fresh()->avanceDeConfiguracion());
    }

    public function test_el_tutorial_se_ofrece_una_sola_vez(): void
    {
        [$duenio] = $this->tiendaRecienCreada();

        $this->actingAs($duenio)
            ->postJson('/api/mi-barberia/configuracion/tutorial')
            ->assertOk()
            ->assertJsonPath('tutorial_pendiente', false);

        // Ya no vuelve a aparecer, aunque la configuración siga a medias.
        $this->actingAs($duenio)
            ->getJson('/api/mi-barberia/configuracion')
            ->assertOk()
            ->assertJsonPath('tutorial_pendiente', false)
            ->assertJsonPath('porcentaje', 0);
    }

    /**
     * Saltarlo no es perderse la lista: los pendientes siguen ahí para quien
     * prefiera resolverlos a su ritmo.
     */
    public function test_saltar_el_tutorial_no_esconde_los_pendientes(): void
    {
        [$duenio] = $this->tiendaRecienCreada();

        $this->actingAs($duenio)->postJson('/api/mi-barberia/configuracion/tutorial')->assertOk();

        $this->actingAs($duenio)
            ->getJson('/api/mi-barberia/configuracion')
            ->assertOk()
            ->assertJsonCount(4, 'pasos');
    }

    /** Los locales que ya venían andando no reciben un tutorial de primeros pasos. */
    public function test_un_local_anterior_al_tutorial_no_lo_recibe(): void
    {
        $barberia = Barberia::factory()->create(['onboarding_resuelto_en' => now()]);
        $duenio = User::factory()->create(['rol' => 'admin', 'barberia_id' => $barberia->id]);
        $duenio->darAccesoA($barberia, 'admin');

        $this->actingAs($duenio)
            ->getJson('/api/mi-barberia/configuracion')
            ->assertOk()
            ->assertJsonPath('tutorial_pendiente', false);
    }

    public function test_un_cliente_no_ve_la_configuracion_de_ningun_local(): void
    {
        $cliente = User::factory()->create(['rol' => 'cliente', 'barberia_id' => null]);

        $this->actingAs($cliente)
            ->getJson('/api/mi-barberia/configuracion')
            ->assertStatus(403);
    }
}
