<?php

namespace Tests\Feature;

use App\Models\Barberia;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * El sitemap que consumen los buscadores.
 *
 * Lo que importa acá no es el XML en sí, sino que no prometa URLs rotas:
 * una barbería suspendida responde 404 en su página pública.
 */
class SitemapTest extends TestCase
{
    use RefreshDatabase;

    private function barberia(string $nombre, string $slug): Barberia
    {
        return Barberia::create([
            'nombre' => $nombre,
            'slug' => $slug,
            'color_principal' => '#1F6F5C',
            'rubro' => 'barberia',
        ]);
    }

    public function test_lista_la_portada_y_las_tiendas_activas(): void
    {
        $this->barberia('Barbería Los Leones', 'barberia-los-leones');

        $respuesta = $this->get('/api/sitemap.xml');

        $respuesta->assertOk();
        $respuesta->assertHeader('Content-Type', 'application/xml; charset=UTF-8');
        $respuesta->assertSee('<urlset', false);
        $respuesta->assertSee('/barberia/barberia-los-leones', false);
    }

    public function test_no_ofrece_las_barberias_suspendidas(): void
    {
        $this->barberia('Visible', 'visible');
        // Por el camino real: estado_suscripcion no es fillable a propósito.
        $this->barberia('Suspendida', 'suspendida')->alternarSuspension();

        $respuesta = $this->get('/api/sitemap.xml');

        $respuesta->assertSee('/barberia/visible', false);
        $respuesta->assertDontSee('/barberia/suspendida', false);
    }

    public function test_es_publico(): void
    {
        // Sin sesión ni firma: el buscador no se autentica.
        $this->get('/api/sitemap.xml')->assertOk();
    }
}
