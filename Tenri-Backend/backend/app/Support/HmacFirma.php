<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Psr\Http\Message\RequestInterface;

/**
 * Firma HMAC-SHA256 para autenticación inter-servicio (panel de tenri.cl <-> Booking).
 *
 * Espejo del helper homónimo de Tenri-Web-Page: el panel firma con su copia y
 * este lado verifica con esta. Mensaje firmado con ruta:
 * "MÉTODO /ruta.{timestamp}.{nonce}.{sha256(body)}". Protege contra replay por
 * ventana de tiempo + nonce de un solo uso, y compara en tiempo constante
 * (hash_equals). El vector de prueba compartido vive en tests/Unit/HmacFirmaTest.php,
 * el mismo archivo en los dos repositorios.
 */
final class HmacFirma
{
    /** Ventana de validez del timestamp (segundos); tolera desfase de reloj. */
    public const VENTANA_SEGUNDOS = 300;

    /** Headers que adjunta el emisor; el verificador los recomputa. */
    public static function headers(string $secreto, string $cuerpo): array
    {
        $timestamp = (string) time();
        $nonce = bin2hex(random_bytes(16));

        return [
            'X-Timestamp' => $timestamp,
            'X-Nonce' => $nonce,
            'X-Signature' => self::calcular($secreto, $timestamp, $nonce, $cuerpo),
        ];
    }

    /** Firma una request saliente PSR-7 (para usar en withRequestMiddleware). */
    public static function firmarPsr(RequestInterface $request, string $secreto): RequestInterface
    {
        foreach (self::headers($secreto, (string) $request->getBody()) as $nombre => $valor) {
            $request = $request->withHeader($nombre, $valor);
        }

        return $request;
    }

    /**
     * Headers que además atan la firma al método y la ruta de destino.
     *
     * El mensaje de `headers()` es `timestamp.nonce.sha256(cuerpo)`: nada lo liga al endpoint,
     * así que una firma capturada sirve para otra ruta del mismo grupo mientras el cuerpo
     * valide. Booking nace después de ese parche y usa siempre la variante con ruta.
     */
    public static function headersConRuta(string $secreto, string $cuerpo, string $metodo, string $ruta): array
    {
        $timestamp = (string) time();
        $nonce = bin2hex(random_bytes(16));

        return [
            'X-Timestamp' => $timestamp,
            'X-Nonce' => $nonce,
            'X-Signature' => self::calcularConRuta($secreto, $timestamp, $nonce, $cuerpo, $metodo, $ruta),
        ];
    }

    /** Firma una request saliente PSR-7 atando método y ruta. */
    public static function firmarPsrConRuta(RequestInterface $request, string $secreto): RequestInterface
    {
        $headers = self::headersConRuta(
            $secreto,
            (string) $request->getBody(),
            $request->getMethod(),
            $request->getUri()->getPath(),
        );

        foreach ($headers as $nombre => $valor) {
            $request = $request->withHeader($nombre, $valor);
        }

        return $request;
    }

    /**
     * Verifica una request entrante exigiendo que la firma cubra método y ruta.
     *
     * Mientras `$aceptarSinRuta` sea true también admite la firma vieja, para que emisor y
     * verificador puedan desplegarse por separado sin cortar el canal. Booking la verifica
     * con `$aceptarSinRuta = false` desde el día uno: los dos lados nacen firmando con ruta.
     */
    public static function verificaConRuta(string $secreto, Request $request, bool $aceptarSinRuta = true): bool
    {
        $firma = (string) $request->header('X-Signature', '');
        $timestamp = (string) $request->header('X-Timestamp', '');
        $nonce = (string) $request->header('X-Nonce', '');

        if ($firma === '' || $timestamp === '' || $nonce === '' || ! ctype_digit($timestamp)) {
            return false;
        }

        if (abs(time() - (int) $timestamp) > self::VENTANA_SEGUNDOS) {
            return false;
        }

        $cuerpo = (string) $request->getContent();

        $esperadaConRuta = self::calcularConRuta(
            $secreto,
            $timestamp,
            $nonce,
            $cuerpo,
            $request->getMethod(),
            '/'.ltrim($request->path(), '/'),
        );

        $calza = hash_equals($esperadaConRuta, $firma);

        if (! $calza && $aceptarSinRuta) {
            $calza = hash_equals(self::calcular($secreto, $timestamp, $nonce, $cuerpo), $firma);
        }

        if (! $calza) {
            return false;
        }

        return Cache::add('hmac_nonce_'.hash('sha256', $secreto.':'.$nonce), true, self::VENTANA_SEGUNDOS);
    }

    /** Verifica una request entrante. Devuelve true solo si la firma es válida y fresca. */
    public static function verifica(string $secreto, Request $request): bool
    {
        $firma = (string) $request->header('X-Signature', '');
        $timestamp = (string) $request->header('X-Timestamp', '');
        $nonce = (string) $request->header('X-Nonce', '');

        if ($firma === '' || $timestamp === '' || $nonce === '' || ! ctype_digit($timestamp)) {
            return false;
        }

        if (abs(time() - (int) $timestamp) > self::VENTANA_SEGUNDOS) {
            return false;
        }

        $esperada = self::calcular($secreto, $timestamp, $nonce, (string) $request->getContent());
        if (! hash_equals($esperada, $firma)) {
            return false;
        }

        // Anti-replay: un nonce válido se acepta una sola vez dentro de la ventana.
        return Cache::add('hmac_nonce_'.hash('sha256', $secreto.':'.$nonce), true, self::VENTANA_SEGUNDOS);
    }

    /**
     * El mensaje firmado sin ruta, expuesto por compatibilidad con el vector de
     * prueba compartido entre repositorios.
     */
    public static function calcular(string $secreto, string $timestamp, string $nonce, string $cuerpo): string
    {
        return hash_hmac('sha256', $timestamp.'.'.$nonce.'.'.hash('sha256', $cuerpo), $secreto);
    }

    /**
     * Mensaje que además ata la firma al método y la ruta: `MÉTODO ruta.timestamp.nonce.sha256(cuerpo)`.
     *
     * Pública por lo mismo que `calcular()`: el vector compartido de
     * HmacFirmaTest (la copia gemela vive en Tenri-Web-Page) fija una firma
     * escrita a mano y necesita poder recalcularla.
     */
    public static function calcularConRuta(
        string $secreto,
        string $timestamp,
        string $nonce,
        string $cuerpo,
        string $metodo,
        string $ruta,
    ): string {
        $mensaje = strtoupper($metodo).' '.$ruta.'.'.$timestamp.'.'.$nonce.'.'.hash('sha256', $cuerpo);

        return hash_hmac('sha256', $mensaje, $secreto);
    }
}
