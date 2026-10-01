<?php

namespace Tests\Feature;

use App\Models\Barberia;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Una persona con varios locales.
 *
 * Un dueño puede abrir más de uno, y alguien puede ser dueña de uno y atender
 * como barbera en el de un socio. Entra una vez y elige con cuál trabajar.
 *
 * El reparto que se prueba acá: `barberia_usuario` dice a qué locales tiene
 * acceso y con qué rol en cada uno, y `users.barberia_id` dice cuál está usando
 * ahora. Todo lo demás de la plataforma sigue mirando esa columna, así que
 * cambiar de local es cambiarla.
 */
class MultiLocalTest extends TestCase
{
    use RefreshDatabase;

    private function duenioConDosLocales(): array
    {
        $primero = Barberia::factory()->create(['nombre' => 'Local Uno']);
        $segundo = Barberia::factory()->create(['nombre' => 'Local Dos']);

        $duenio = User::factory()->create([
            'email' => 'duenio@test.cl',
            'password' => Hash::make('SuClave123'),
            'rol' => 'admin',
            'barberia_id' => $primero->id,
        ]);

        $duenio->darAccesoA($primero, 'admin');
        $duenio->darAccesoA($segundo, 'admin');

        return [$duenio, $primero, $segundo];
    }

    public function test_al_entrar_le_llegan_sus_locales_y_cual_esta_usando(): void
    {
        [$duenio, $primero, $segundo] = $this->duenioConDosLocales();

        $respuesta = $this->postJson('/api/login', ['email' => 'duenio@test.cl', 'password' => 'SuClave123']);

        $respuesta->assertOk()->assertJsonCount(2, 'locales');

        $locales = collect($respuesta->json('locales'));
        $this->assertTrue($locales->firstWhere('id', $primero->id)['activo']);
        $this->assertFalse($locales->firstWhere('id', $segundo->id)['activo']);
        $this->assertSame('admin', $locales->firstWhere('id', $segundo->id)['rol']);
    }

    public function test_quien_tiene_un_solo_local_no_tiene_nada_que_elegir(): void
    {
        $local = Barberia::factory()->create();
        $duenio = User::factory()->create([
            'email' => 'solo@test.cl', 'password' => Hash::make('SuClave123'),
            'rol' => 'admin', 'barberia_id' => $local->id,
        ]);
        $duenio->darAccesoA($local, 'admin');

        $this->postJson('/api/login', ['email' => 'solo@test.cl', 'password' => 'SuClave123'])
            ->assertOk()
            ->assertJsonCount(1, 'locales');
    }

    public function test_cambiar_de_local_cambia_el_que_ve_el_panel(): void
    {
        [$duenio, , $segundo] = $this->duenioConDosLocales();

        $this->actingAs($duenio)
            ->putJson('/api/sesion/local', ['barberia_id' => $segundo->id])
            ->assertOk()
            ->assertJsonPath('user.barberia_id', $segundo->id);

        $this->assertSame($segundo->id, $duenio->fresh()->barberia_id);
    }

    /**
     * El rol viaja con el local: la misma persona puede ser dueña de uno y
     * barbera en otro, y lo que puede hacer depende de dónde está parada.
     */
    public function test_al_cambiar_de_local_adopta_el_rol_que_tiene_ahi(): void
    {
        [$duenio, , $segundo] = $this->duenioConDosLocales();
        $duenio->darAccesoA($segundo, 'barbero');

        $this->actingAs($duenio)
            ->putJson('/api/sesion/local', ['barberia_id' => $segundo->id])
            ->assertOk()
            ->assertJsonPath('user.rol', 'barbero');
    }

    public function test_no_se_puede_saltar_a_un_local_ajeno(): void
    {
        [$duenio] = $this->duenioConDosLocales();
        $ajeno = Barberia::factory()->create(['nombre' => 'Local De Otro']);

        $this->actingAs($duenio)
            ->putJson('/api/sesion/local', ['barberia_id' => $ajeno->id])
            ->assertStatus(403);

        $this->assertNotSame($ajeno->id, $duenio->fresh()->barberia_id);
    }

    public function test_no_se_puede_entrar_a_un_local_suspendido(): void
    {
        [$duenio, , $segundo] = $this->duenioConDosLocales();
        $segundo->alternarSuspension();

        $this->actingAs($duenio)
            ->putJson('/api/sesion/local', ['barberia_id' => $segundo->id])
            ->assertStatus(403);
    }

    /**
     * Si el local que tenía seleccionado quedó suspendido pero le queda otro en
     * pie, entra igual: sus otros locales no tienen la culpa.
     */
    public function test_si_el_local_activo_esta_suspendido_entra_al_otro(): void
    {
        [$duenio, $primero, $segundo] = $this->duenioConDosLocales();
        $primero->alternarSuspension();

        $respuesta = $this->postJson('/api/login', ['email' => 'duenio@test.cl', 'password' => 'SuClave123']);

        $respuesta->assertOk();
        $this->assertSame($segundo->id, $duenio->fresh()->barberia_id);
    }

    public function test_con_todos_los_locales_suspendidos_no_entra(): void
    {
        [, $primero, $segundo] = $this->duenioConDosLocales();
        $primero->alternarSuspension();
        $segundo->alternarSuspension();

        $this->postJson('/api/login', ['email' => 'duenio@test.cl', 'password' => 'SuClave123'])
            ->assertStatus(403);
    }

    /**
     * Atender es de cada local, no de la persona.
     *
     * El caso que lo destapó: el dueño se sumó al equipo de su local A y quedó
     * apareciendo también como parte del equipo de su local B, donde solo
     * administra. Pasaba porque `users.es_barbero` era una casilla de la
     * persona, y ahora vive en el acceso a cada local.
     */
    public function test_sumarse_al_equipo_de_un_local_no_suma_a_los_otros(): void
    {
        [$duenio, $primero, $segundo] = $this->duenioConDosLocales();

        $duenio->atenderEn($primero->id, true);

        $this->assertTrue($duenio->atiendeEn($primero->id));
        $this->assertFalse($duenio->atiendeEn($segundo->id));

        // Y el equipo de cada local dice lo mismo.
        $this->assertTrue($primero->quienesAtienden()->where('users.id', $duenio->id)->exists());
        $this->assertFalse($segundo->quienesAtienden()->where('users.id', $duenio->id)->exists());
    }

    /**
     * Y el equipo que ve el panel es el del local que se está usando, así que
     * cambiar de local cambia el equipo.
     */
    public function test_el_equipo_del_panel_es_el_del_local_activo(): void
    {
        [$duenio, $primero, $segundo] = $this->duenioConDosLocales();
        $duenio->atenderEn($primero->id, true);

        $this->actingAs($duenio->fresh())
            ->getJson('/api/mi-equipo')
            ->assertOk()
            ->assertJsonCount(1);

        $duenio->seleccionarLocal($segundo->id);

        $this->actingAs($duenio->fresh())
            ->getJson('/api/mi-equipo')
            ->assertOk()
            ->assertJsonCount(0);
    }

    /**
     * Las cuentas anteriores a `barberia_usuario` tienen local pero no acceso.
     * Sin la autocuración quedarían afuera de su propio local.
     */
    public function test_una_cuenta_vieja_sin_acceso_registrado_igual_entra(): void
    {
        $local = Barberia::factory()->create();
        $antigua = User::factory()->create([
            'email' => 'antigua@test.cl', 'password' => Hash::make('SuClave123'),
            'rol' => 'admin', 'barberia_id' => $local->id,
        ]);

        // Se le quita el acceso a mano para reproducir cómo quedaron las filas
        // de antes de la tabla: local en la columna, sin fila de acceso.
        $antigua->barberiasAdministradas()->detach();
        $this->assertSame(0, $antigua->fresh()->barberiasAdministradas()->count());

        $this->postJson('/api/login', ['email' => 'antigua@test.cl', 'password' => 'SuClave123'])
            ->assertOk()
            ->assertJsonCount(1, 'locales');

        $this->assertTrue($antigua->fresh()->puedeAdministrar($local->id));
    }

    public function test_la_sesion_puede_volver_a_pedir_sus_locales(): void
    {
        [$duenio] = $this->duenioConDosLocales();

        $this->actingAs($duenio)
            ->getJson('/api/sesion/locales')
            ->assertOk()
            ->assertJsonCount(2, 'locales');
    }
}
