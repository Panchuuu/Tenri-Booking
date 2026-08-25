<?php

namespace Tests\Feature;

use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeders_no_crean_datos_en_produccion(): void
    {
        // Simulamos producción DESPUÉS de migrar (RefreshDatabase corre en
        // setUp) y ejecutamos el seeder directamente: db:seed vía artisan
        // pediría confirmación en producción y no ejercitaría el guard.
        $this->app['env'] = 'production';

        $seeder = new DatabaseSeeder();
        $seeder->setContainer($this->app);
        $seeder->run();

        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('servicios', 0);
    }

    public function test_seeders_crean_datos_demo_fuera_de_produccion(): void
    {
        $this->seed();

        // Prueba de control: fuera de producción los seeders SÍ corren
        // (si esto falla, el test anterior podría pasar en vacío).
        $this->assertDatabaseHas('users', ['email' => 'admin@tenri.cl']);
    }
}
