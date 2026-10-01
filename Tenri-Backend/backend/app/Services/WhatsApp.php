<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * El canal por el que de verdad se leen los avisos.
 *
 * El recordatorio de una hora y el aviso de un cupo que se liberó compiten con
 * la bandeja de entrada, y la pierden. Por eso salen por WhatsApp cuando hay un
 * teléfono, y por correo cuando no.
 *
 * **Nunca lanza.** Un aviso es un extra: que el proveedor esté caído no puede
 * voltear la cancelación de una cita ni el comando nocturno de recordatorios.
 * Devuelve si salió o no, y quien llama decide si cae al correo.
 *
 * Dos modos, elegidos por configuración:
 *
 * - `log`: escribe el mensaje en el log. Es el de desarrollo, el mismo trato
 *   que `MAIL_MAILER=log`, para poder probar el flujo completo sin gastar
 *   mensajes ni exponer números reales.
 * - `cloud`: la API de WhatsApp Cloud de Meta.
 *
 * Sin configuración no hay envío y no hay error: simplemente no está disponible
 * y el correo se encarga.
 */
class WhatsApp
{
    public function __construct(
        private readonly string $driver,
        private readonly ?string $token,
        private readonly ?string $telefonoId,
        private readonly string $prefijoPais,
    ) {}

    /** Si hay por dónde mandar. Quien llama lo consulta antes de decidir el canal. */
    public function disponible(): bool
    {
        if ($this->driver === 'log') {
            return true;
        }

        return filled($this->token) && filled($this->telefonoId);
    }

    /**
     * Manda un mensaje de texto. Devuelve si salió.
     *
     * @param  string  $telefono  como lo escribió la persona; se normaliza acá.
     */
    public function enviar(?string $telefono, string $mensaje): bool
    {
        $numero = $this->normalizar($telefono);

        if ($numero === null || ! $this->disponible()) {
            return false;
        }

        if ($this->driver === 'log') {
            Log::info("WhatsApp para +{$numero}:".PHP_EOL.$mensaje);

            return true;
        }

        try {
            $respuesta = Http::withToken($this->token)
                ->timeout(8)
                ->post("https://graph.facebook.com/v21.0/{$this->telefonoId}/messages", [
                    'messaging_product' => 'whatsapp',
                    'to' => $numero,
                    'type' => 'text',
                    'text' => ['preview_url' => false, 'body' => $mensaje],
                ]);

            if ($respuesta->successful()) {
                return true;
            }

            // El cuerpo no se registra entero: puede traer el número completo.
            Log::warning('WhatsApp: el proveedor rechazó el mensaje', [
                'status' => $respuesta->status(),
                'error' => $respuesta->json('error.message'),
            ]);

            return false;
        } catch (Throwable $e) {
            Log::warning('WhatsApp: no se pudo contactar al proveedor', ['error' => $e->getMessage()]);

            return false;
        }
    }

    /**
     * Deja el número como lo espera la API: solo dígitos, con código de país.
     *
     * La gente lo escribe de seis maneras distintas -con +56, con 9 adelante,
     * con espacios, con guiones- y todas significan lo mismo. Normalizar acá
     * evita pedirle un formato exacto en el formulario, que es donde se
     * abandona.
     */
    private function normalizar(?string $telefono): ?string
    {
        $digitos = preg_replace('/\D+/', '', (string) $telefono);

        if ($digitos === '' || $digitos === null) {
            return null;
        }

        // Ya viene con código de país.
        if (str_starts_with($digitos, $this->prefijoPais)) {
            return strlen($digitos) >= 11 ? $digitos : null;
        }

        // Móvil chileno escrito como 9XXXXXXXX, o sin el 9 inicial.
        if (strlen($digitos) === 9) {
            return $this->prefijoPais.$digitos;
        }

        if (strlen($digitos) === 8) {
            return $this->prefijoPais.'9'.$digitos;
        }

        return null;
    }
}
