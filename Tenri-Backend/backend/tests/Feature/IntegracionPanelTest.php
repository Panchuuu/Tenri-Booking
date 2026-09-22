<?php

namespace Tests\Feature;

use App\Models\Barberia;
use App\Models\Cita;
use App\Models\Servicio;
use App\Models\User;
use App\Support\HmacFirma;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
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

    public function test_crea_una_barberia_con_su_admin(): void
    {
        $respuesta = $this->llamadaFirmada('post', '/api/integracion/panel/crear-barberia', [
            'nombre_barberia' => 'Barbería Compra Tenri',
            'color_principal' => '#0EA5E9',
            'admin_nombre' => 'Dueño Nuevo',
            'admin_email' => 'dueno@test.cl',
            'admin_password' => 'ContraseñaGenerada123',
            'plan' => 'booking-mensual',
        ]);

        $respuesta->assertStatus(201)
            ->assertJsonPath('schema', 1)
            ->assertJsonPath('barberia.nombre', 'Barbería Compra Tenri')
            ->assertJsonPath('barberia.slug', 'barberia-compra-tenri')
            ->assertJsonPath('barberia.activa', true);

        $this->assertDatabaseHas('barberias', ['nombre' => 'Barbería Compra Tenri', 'plan' => 'booking-mensual']);
        $this->assertDatabaseHas('users', ['email' => 'dueno@test.cl', 'rol' => 'admin']);

        // El admin recién creado puede entrar de una: es la cuenta que va a
        // usar para operar el local que acaba de comprar.
        $this->postJson('/api/login', ['email' => 'dueno@test.cl', 'password' => 'ContraseñaGenerada123'])
            ->assertOk();
    }

    public function test_crear_barberia_falla_si_el_nombre_ya_existe(): void
    {
        Barberia::factory()->create(['nombre' => 'Ya Existo']);

        $respuesta = $this->llamadaFirmada('post', '/api/integracion/panel/crear-barberia', [
            'nombre_barberia' => 'Ya Existo',
            'color_principal' => '#0EA5E9',
            'admin_nombre' => 'Alguien',
            'admin_email' => 'alguien@test.cl',
            'admin_password' => 'ContraseñaGenerada123',
        ]);

        $respuesta->assertStatus(422);

        // El mensaje viaja al panel de tenri.cl y lo lee una persona que tiene
        // que resolver una compra cobrada sin tienda: en español y diciendo qué
        // hacer, no el texto por defecto de Laravel.
        $this->assertStringContainsString('ya está tomado', (string) $respuesta->json('message'));
    }

    /**
     * El comprador que ya era cliente de la plataforma.
     *
     * Reservó una hora alguna vez, así que su correo ya tiene cuenta acá. Se le
     * suma el local nuevo y **conserva su contraseña**: es la que ya usa, y
     * pisarla le cambiaría el acceso sin avisarle.
     */
    public function test_un_cliente_existente_recibe_el_local_y_conserva_su_clave(): void
    {
        $cliente = User::factory()->create([
            'email' => 'ya@existe.cl',
            'password' => Hash::make('LaSuyaDeSiempre'),
            'rol' => 'cliente',
            'barberia_id' => null,
        ]);

        $this->llamadaFirmada('post', '/api/integracion/panel/crear-barberia', [
            'nombre_barberia' => 'Barbería Distinta',
            'color_principal' => '#0EA5E9',
            'admin_nombre' => 'Alguien',
            'admin_email' => 'ya@existe.cl',
            'admin_password' => 'ContraseñaGenerada123',
        ])->assertStatus(201)
            // El panel necesita saberlo para no mandarle una clave que no aplica.
            ->assertJsonPath('admin_creado', false);

        $cliente->refresh();
        $barberia = Barberia::where('nombre', 'Barbería Distinta')->first();

        $this->assertSame('admin', $cliente->rol);
        $this->assertSame($barberia->id, $cliente->barberia_id);
        $this->assertTrue($cliente->puedeAdministrar($barberia->id));
        $this->assertSame(1, User::where('email', 'ya@existe.cl')->count());

        // Entra con la de siempre, no con la generada.
        $this->postJson('/api/login', ['email' => 'ya@existe.cl', 'password' => 'LaSuyaDeSiempre'])->assertOk();
        $this->postJson('/api/login', ['email' => 'ya@existe.cl', 'password' => 'ContraseñaGenerada123'])->assertStatus(401);
    }

    /**
     * Quien ya tiene un local puede abrir otro: los acumula y elige cuál
     * administrar al entrar.
     */
    public function test_quien_ya_tiene_un_local_puede_sumar_otro(): void
    {
        $primera = Barberia::factory()->create(['nombre' => 'Su Primer Local']);
        $duenio = User::factory()->create([
            'email' => 'duenio@test.cl',
            'password' => Hash::make('SuClave123'),
            'rol' => 'admin',
            'barberia_id' => $primera->id,
        ]);
        $duenio->darAccesoA($primera, 'admin');

        $this->llamadaFirmada('post', '/api/integracion/panel/crear-barberia', [
            'nombre_barberia' => 'Su Segundo Local',
            'color_principal' => '#0EA5E9',
            'admin_nombre' => 'Dueño',
            'admin_email' => 'duenio@test.cl',
            'admin_password' => 'ContraseñaGenerada123',
        ])->assertStatus(201)->assertJsonPath('admin_creado', false);

        $segunda = Barberia::where('nombre', 'Su Segundo Local')->first();

        $this->assertSame(2, $duenio->barberiasAdministradas()->count());
        $this->assertTrue($duenio->puedeAdministrar($segunda->id));

        // Y al entrar le llegan los dos, con cuál está usando.
        $respuesta = $this->postJson('/api/login', ['email' => 'duenio@test.cl', 'password' => 'SuClave123']);
        $respuesta->assertOk()->assertJsonCount(2, 'locales');
        $this->assertSame($primera->id, $respuesta->json('locales.0.activo') ? $respuesta->json('locales.0.id') : $respuesta->json('locales.1.id'));
    }

    /**
     * El superadmin de la plataforma no se convierte en dueño de un local: su
     * cuenta no es de nadie en particular. Y la barbería no puede quedar creada
     * y huérfana cuando eso se rechaza.
     */
    public function test_crear_barberia_falla_si_el_correo_es_del_superadmin(): void
    {
        User::factory()->create(['email' => 'super@tenri.cl', 'rol' => 'superadmin', 'barberia_id' => null]);

        $this->llamadaFirmada('post', '/api/integracion/panel/crear-barberia', [
            'nombre_barberia' => 'Barbería Distinta',
            'color_principal' => '#0EA5E9',
            'admin_nombre' => 'Alguien',
            'admin_email' => 'super@tenri.cl',
            'admin_password' => 'ContraseñaGenerada123',
        ])->assertStatus(422);

        $this->assertDatabaseMissing('barberias', ['nombre' => 'Barbería Distinta']);
    }

    /**
     * La compra en tenri.cl manda el hash de la cuenta del comprador, no una
     * clave nueva: entra acá con las credenciales que ya conoce.
     */
    public function test_el_alta_acepta_el_hash_de_la_cuenta_de_tenri(): void
    {
        $respuesta = $this->llamadaFirmada('post', '/api/integracion/panel/crear-barberia', [
            'nombre_barberia' => 'Barbería Comprada',
            'color_principal' => '#0EA5E9',
            'admin_nombre' => 'Compradora',
            'admin_email' => 'compradora@gmail.com',
            'admin_password_hash' => Hash::make('LaDeTenri123'),
        ]);

        $respuesta->assertStatus(201);

        // El hash se guarda tal cual: no se vuelve a cifrar por encima.
        $this->postJson('/api/login', ['email' => 'compradora@gmail.com', 'password' => 'LaDeTenri123'])
            ->assertOk();
    }

    public function test_el_alta_exige_una_forma_de_contrasena_y_no_las_dos(): void
    {
        $base = [
            'nombre_barberia' => 'Barbería Sin Clave',
            'color_principal' => '#0EA5E9',
            'admin_nombre' => 'Alguien',
            'admin_email' => 'alguien@gmail.com',
        ];

        $this->llamadaFirmada('post', '/api/integracion/panel/crear-barberia', $base)
            ->assertStatus(422);

        $this->llamadaFirmada('post', '/api/integracion/panel/crear-barberia', [
            ...$base,
            'admin_password' => 'ContraseñaGenerada123',
            'admin_password_hash' => Hash::make('otra'),
        ])->assertStatus(422);
    }

    public function test_nombre_disponible_avisa_si_esta_tomado_y_con_que_direccion_queda(): void
    {
        Barberia::factory()->create(['nombre' => 'Barbería Central', 'slug' => 'barberia-central']);

        $this->llamadaFirmada('post', '/api/integracion/panel/nombre-disponible', ['nombre' => 'Barbería Central'])
            ->assertOk()
            ->assertJsonPath('disponible', false)
            // El slug ofrecido esquiva el que ya existe: el nombre choca, la
            // dirección pública no tendría por qué.
            ->assertJsonPath('slug', 'barberia-central-2');

        $this->llamadaFirmada('post', '/api/integracion/panel/nombre-disponible', ['nombre' => 'Barbería Nueva'])
            ->assertOk()
            ->assertJsonPath('disponible', true)
            ->assertJsonPath('slug', 'barberia-nueva');
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
