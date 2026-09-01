<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * El contrato de /api/health que sondea el panel de estado de tenri.cl.
 *
 * Lo que importa proteger: la forma ({"status":"ok"|"degraded"}) y que el
 * detalle de checks no se filtre fuera del entorno local — es un endpoint
 * abierto y los subsistemas que fallan son un mapa para quien mire.
 */
class SaludTest extends TestCase
{
    use RefreshDatabase;

    public function test_responde_ok_sin_autenticacion(): void
    {
        $this->getJson('/api/health')
            ->assertOk()
            ->assertJsonPath('status', 'ok');
    }

    public function test_fuera_de_local_no_se_filtra_el_detalle(): void
    {
        // APP_ENV=testing en la suite: igual que producción para este if.
        $this->getJson('/api/health')
            ->assertOk()
            ->assertJsonMissingPath('checks')
            ->assertJsonMissingPath('time');
    }
}
