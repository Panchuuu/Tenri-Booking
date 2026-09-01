<?php

namespace Tests\Unit;

use App\Support\HmacFirma;
use PHPUnit\Framework\TestCase;

/**
 * El vector compartido que mantiene alineadas las dos copias del HMAC.
 *
 * El panel de tenri.cl (Tenri-Web-Page) firma con su copia de `HmacFirma` las
 * llamadas del canal de integración; este lado verifica con esta copia. Son dos
 * repositorios desplegados por separado, sin paquete compartido, así que nada
 * impide que uno cambie y el otro no.
 *
 * Esta tupla fija —secreto, timestamp, nonce, cuerpo y la firma esperada— es lo
 * que hace que esa desviación sea ruidosa: **el mismo test tiene que existir en
 * los dos repositorios** (allá vive en tests/Unit/HmacFirmaTest.php). Si
 * alguien toca el algoritmo de un lado, truena la suite en vez de que
 * producción empiece a responder 401 en silencio y nadie entienda por qué.
 *
 * Si este test falla, no lo "arregles" actualizando el valor esperado sin mirar
 * el otro lado: significa que las dos implementaciones ya no coinciden.
 */
class HmacFirmaTest extends TestCase
{
    private const SECRETO = 'vector-de-prueba-compartido';

    private const TIMESTAMP = '1750000000';

    private const NONCE = '0123456789abcdef0123456789abcdef';

    private const CUERPO = '{"schema":1,"op":"metrics"}';

    /** El valor fijado a mano de la firma sin ruta. Tiene que coincidir con el del otro repositorio. */
    private const FIRMA = '659e167a3521f46123bfe63970b1adffb134b71932fbadcab65bc604c2de2fde';

    /** La variante que ata método y ruta, que es la que este canal usa de verdad. */
    private const FIRMA_CON_RUTA = 'c11ae3f67a014e92072948c1c8c876bc2e746b0c140875b36b7c7e12e27881b1';

    public function test_el_algoritmo_no_cambio(): void
    {
        $this->assertSame(
            self::FIRMA,
            HmacFirma::calcular(self::SECRETO, self::TIMESTAMP, self::NONCE, self::CUERPO),
            'La forma del mensaje firmado cambió. El panel sigue firmando con la otra copia, '
            .'así que sus llamadas van a empezar a responder 401.',
        );
    }

    public function test_el_algoritmo_con_ruta_no_cambio(): void
    {
        $this->assertSame(
            self::FIRMA_CON_RUTA,
            HmacFirma::calcularConRuta(
                self::SECRETO,
                self::TIMESTAMP,
                self::NONCE,
                self::CUERPO,
                'POST',
                '/api/integracion/panel/metricas',
            ),
            'La forma del mensaje firmado con ruta cambió. Es la variante que usa el canal '
            .'del panel: sus llamadas van a empezar a responder 401.',
        );
    }

    public function test_la_firma_depende_del_cuerpo(): void
    {
        // Es lo que impide que alguien reenvíe una firma válida con otro
        // contenido: el hash del cuerpo va dentro del mensaje firmado.
        $original = HmacFirma::calcular(self::SECRETO, self::TIMESTAMP, self::NONCE, self::CUERPO);
        $alterado = HmacFirma::calcular(self::SECRETO, self::TIMESTAMP, self::NONCE, '{"schema":1,"op":"otra"}');

        $this->assertNotSame($original, $alterado);
    }

    public function test_la_firma_con_ruta_depende_del_metodo_y_de_la_ruta(): void
    {
        $base = HmacFirma::calcularConRuta(self::SECRETO, self::TIMESTAMP, self::NONCE, self::CUERPO, 'POST', '/api/integracion/panel/metricas');

        $this->assertNotSame($base, HmacFirma::calcularConRuta(self::SECRETO, self::TIMESTAMP, self::NONCE, self::CUERPO, 'PUT', '/api/integracion/panel/metricas'));
        $this->assertNotSame($base, HmacFirma::calcularConRuta(self::SECRETO, self::TIMESTAMP, self::NONCE, self::CUERPO, 'POST', '/api/integracion/panel/usuarios'));
    }

    public function test_la_firma_depende_del_secreto_del_timestamp_y_del_nonce(): void
    {
        $base = HmacFirma::calcular(self::SECRETO, self::TIMESTAMP, self::NONCE, self::CUERPO);

        $this->assertNotSame($base, HmacFirma::calcular('otro-secreto', self::TIMESTAMP, self::NONCE, self::CUERPO));
        $this->assertNotSame($base, HmacFirma::calcular(self::SECRETO, '1750000001', self::NONCE, self::CUERPO));
        $this->assertNotSame($base, HmacFirma::calcular(self::SECRETO, self::TIMESTAMP, 'otro-nonce', self::CUERPO));
    }

    public function test_la_ventana_es_la_misma_que_del_otro_lado(): void
    {
        // Si un lado tolera cinco minutos y el otro uno, las llamadas empiezan
        // a fallar solo cuando los relojes se separan un poco — que es la clase
        // de falla que aparece de noche y no se reproduce.
        $this->assertSame(300, HmacFirma::VENTANA_SEGUNDOS);
    }
}
