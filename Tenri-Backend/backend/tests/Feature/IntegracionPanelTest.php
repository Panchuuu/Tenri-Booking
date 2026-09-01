<?php

namespace Tests\Feature;

use App\Models\Barberia;
use App\Models\Cita;
use App\Models\Servicio;
use App\Models\User;
use App\Support\HmacFirma;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * El canal server-to-server con el panel de tenri.cl.
 *
 * Acá se prueba lo que este lado promete: que sin firma no entra nadie, que la
 * suspensión de una barbería tiene efectos reales (listado público, reservas,
 * login, tokens) y reversibles, y que las acciones sobre usuarios conservan las
 * invariantes del superadmin. Que la firma de los dos lados coincida lo prueba
 * el vector compartido de HmacFirmaTest.
 */
class IntegracionPanelTest extends TestCase
{
    use RefreshDatabase;

    private const CLAVE = 'clave-de-prueba-del-canal';

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.panel.integration_key' => self::CLAVE]);
    }

    /**
     * Una llamada firmada como la haría el panel: HMAC sobre método, ruta y
     * cuerpo, con la variante que ata la ruta.
     *
     * @param  array<string,mixed>  $datos
     */
    private function llamadaFirmada(string $metodo, string $ruta, array $datos = [], ?string $clave = null)
    {
        $cuerpo = json_encode($datos);

        $headers = HmacFirma::headersConRuta($clave ?? self::CLAVE, $cuerpo, strtoupper($metodo), $ruta);

        return $this->json($metodo, $ruta, $datos, $headers);
    }

    // ─── La puerta ───────────────────────────────────────────────────────────

    public function test_sin_firma_no_entra_nadie(): void
    {
        $this->postJson('/api/integracion/panel/metricas', ['schema' => 1])->assertStatus(401);
    }

    public function test_con_clave_equivocada_tampoco(): void
    {
        $this->llamadaFirmada('post', '/api/integracion/panel/metricas', ['schema' => 1], clave: 'otra-clave')
            ->assertStatus(401);
    }

    public function test_sin_clave_configurada_el_canal_falla_cerrado(): void
    {
        config(['services.panel.integration_key' => null]);

        $this->llamadaFirmada('post', '/api/integracion/panel/metricas', ['schema' => 1])
            ->assertStatus(401);
    }

    public function test_un_nonce_no_se_acepta_dos_veces(): void
    {
        $cuerpo = json_encode(['schema' => 1]);
        $headers = HmacFirma::headersConRuta(self::CLAVE, $cuerpo, 'POST', '/api/integracion/panel/metricas');

        $this->json('post', '/api/integracion/panel/metricas', ['schema' => 1], $headers)->assertOk();
        // La misma firma reenviada tal cual: replay.
        $this->json('post', '/api/integracion/panel/metricas', ['schema' => 1], $headers)->assertStatus(401);
    }

    // ─── Métricas ────────────────────────────────────────────────────────────

    public function test_las_metricas_cuentan_la_plataforma_completa(): void
    {
        $barberia = Barberia::factory()->create();
        $admin = User::factory()->admin($barberia->id)->create(['es_barbero' => true]);
        $barbero = User::factory()->barbero($barberia->id)->create();
        $cliente = User::factory()->cliente()->create();
        User::factory()->cliente()->suspendido()->create();

        $servicio = Servicio::factory()->create(['barberia_id' => $barberia->id]);
        // Cita::create y no la factory: CitaFactory crea su propia barbería y
        // barbero en cada llamada, y este test cuenta usuarios exactos.
        Cita::create([
            'barberia_id' => $barberia->id, 'servicio_id' => $servicio->id,
            'barbero_id' => $barbero->id, 'cliente_id' => $cliente->id,
            'fecha' => now()->toDateString(), 'hora' => '10:00', 'estado' => 'confirmada',
        ]);
        Cita::create([
            'barberia_id' => $barberia->id, 'servicio_id' => $servicio->id,
            'barbero_id' => $barbero->id, 'cliente_id' => $cliente->id,
            'fecha' => now()->toDateString(), 'hora' => '11:00', 'estado' => 'cancelada',
        ]);

        $this->llamadaFirmada('post', '/api/integracion/panel/metricas', ['schema' => 1, 'op' => 'metrics'])
            ->assertOk()
            ->assertJsonPath('schema', 1)
            ->assertJsonPath('users.total', 4)
            // El admin con rol dual cuenta como barbero: son dos, no uno.
            ->assertJsonPath('users.barberos', 2)
            ->assertJsonPath('users.suspendidos', 1)
            ->assertJsonPath('content.barberias', 1)
            ->assertJsonPath('content.barberias_activas', 1)
            // La cancelada no cuenta como actividad.
            ->assertJsonPath('content.citas_hoy', 1)
            ->assertJsonPath('content.citas', 2);
    }

    // ─── Barberías y su suspensión ───────────────────────────────────────────

    public function test_las_barberias_llegan_con_conteos_y_estado(): void
    {
        $barberia = Barberia::factory()->create(['nombre' => 'Central']);
        User::factory()->admin($barberia->id)->create(['es_barbero' => true]);
        User::factory()->cliente()->create();

        $respuesta = $this->llamadaFirmada('post', '/api/integracion/panel/barberias', ['schema' => 1, 'op' => 'barberias'])
            ->assertOk()
            ->assertJsonPath('schema', 1)
            ->assertJsonPath('barberias.0.nombre', 'Central')
            ->assertJsonPath('barberias.0.activa', true)
            ->assertJsonPath('barberias.0.usuarios_count', 1);

        // El rol dual también cuenta acá.
        $respuesta->assertJsonPath('barberias.0.barberos_count', 1);
    }

    public function test_suspender_una_barberia_la_saca_del_mundo_y_reactivarla_la_devuelve(): void
    {
        $barberia = Barberia::factory()->create();
        $admin = User::factory()->admin($barberia->id)->create(['password' => bcrypt('secreto123')]);
        $admin->createToken('sesion-viva');
        $servicio = Servicio::factory()->create(['barberia_id' => $barberia->id]);
        $barbero = User::factory()->barbero($barberia->id)->create();
        $cliente = User::factory()->cliente()->create();

        // Suspender.
        $this->llamadaFirmada('put', "/api/integracion/panel/barberias/{$barberia->id}/suspension", ['schema' => 1])
            ->assertOk()
            ->assertJsonPath('barberia.activa', false);

        // Desaparece del listado público y su slug responde 404.
        $this->getJson('/api/barberias')->assertOk()->assertJsonPath('total', 0);
        $this->getJson("/api/barberias/{$barberia->slug}")->assertStatus(404);

        // Sus sesiones vivas se revocaron.
        $this->assertSame(0, $admin->tokens()->count());

        // Su admin no puede iniciar sesión.
        $this->postJson('/api/login', ['email' => $admin->email, 'password' => 'secreto123'])
            ->assertStatus(403);

        // No acepta reservas nuevas.
        $this->actingAs($cliente)
            ->postJson('/api/citas', [
                'servicio_id' => $servicio->id,
                'barbero_id' => $barbero->id,
                'fecha' => now()->addDay()->toDateString(),
                'hora' => '10:00',
            ])
            ->assertStatus(403);

        // Reactivar: todo vuelve.
        $this->llamadaFirmada('put', "/api/integracion/panel/barberias/{$barberia->id}/suspension", ['schema' => 1])
            ->assertOk()
            ->assertJsonPath('barberia.activa', true);

        $this->getJson('/api/barberias')->assertOk()->assertJsonPath('total', 1);
        $this->postJson('/api/login', ['email' => $admin->email, 'password' => 'secreto123'])->assertOk();
    }

    // ─── Usuarios ────────────────────────────────────────────────────────────

    public function test_los_usuarios_llegan_paginados_y_filtrados_desde_el_cuerpo(): void
    {
        $barberia = Barberia::factory()->create();
        User::factory()->barbero($barberia->id)->create(['name' => 'Camila Barbera']);
        User::factory()->cliente()->create(['name' => 'Camila Cliente']);
        User::factory()->cliente()->create(['name' => 'Otro Nombre']);

        $this->llamadaFirmada('post', '/api/integracion/panel/usuarios', ['schema' => 1, 'buscar' => 'camila', 'rol' => 'cliente'])
            ->assertOk()
            ->assertJsonPath('schema', 1)
            ->assertJsonPath('usuarios.total', 1)
            ->assertJsonPath('usuarios.data.0.name', 'Camila Cliente');
    }

    public function test_cambiar_rol_funciona_y_un_rol_inventado_es_422_legible(): void
    {
        $usuario = User::factory()->cliente()->create();

        $this->llamadaFirmada('put', "/api/integracion/panel/usuarios/{$usuario->id}/rol", ['schema' => 1, 'rol' => 'admin'])
            ->assertOk()
            ->assertJsonPath('usuario.rol', 'admin');

        $this->llamadaFirmada('put', "/api/integracion/panel/usuarios/{$usuario->id}/rol", ['schema' => 1, 'rol' => 'faraon'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'El rol elegido no existe.');
    }

    public function test_suspender_un_usuario_revoca_sus_tokens_y_es_reversible(): void
    {
        $usuario = User::factory()->cliente()->create();
        $usuario->createToken('sesion-viva');

        $this->llamadaFirmada('put', "/api/integracion/panel/usuarios/{$usuario->id}/suspension", ['schema' => 1])
            ->assertOk()
            ->assertJsonPath('usuario.suspendido', true);

        $this->assertSame(0, $usuario->tokens()->count());

        $this->llamadaFirmada('put', "/api/integracion/panel/usuarios/{$usuario->id}/suspension", ['schema' => 1])
            ->assertOk()
            ->assertJsonPath('usuario.suspendido', false);
    }
}
