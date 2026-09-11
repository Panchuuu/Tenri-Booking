<?php

namespace App\Http\Controllers;

use App\Models\Barberia;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * El sitemap del directorio público, para los buscadores.
 *
 * Vive en la API y no como archivo estático porque las tiendas entran y
 * salen solas: un XML subido a mano quedaría desactualizado al día
 * siguiente. robots.txt apunta acá (un sitemap declarado en robots.txt
 * puede vivir en cualquier ruta del mismo host).
 *
 * Solo entran las barberías activas: una suspendida responde 404 en su
 * página pública, y ofrecerla al buscador sería prometer una URL rota.
 */
class SitemapController extends Controller
{
    /** Cuánto se cachea el XML. El sondeo de los buscadores no es frecuente. */
    private const CACHE_SEGUNDOS = 3600;

    public function __invoke(Request $peticion): Response
    {
        // El host de la propia petición y no FRONTEND_URL: en producción
        // la SPA y la API comparten origen, y si la variable no estuviera
        // configurada el sitemap saldría apuntando a localhost. Con
        // SITIO_PUBLICO_URL se puede forzar otro dominio si algún día
        // dejan de compartir origen.
        $base = rtrim(config('app.sitio_publico_url') ?: $peticion->getSchemeAndHttpHost(), '/');

        $urls = [[
            'loc' => $base.'/',
            'changefreq' => 'daily',
            'priority' => '1.0',
            'lastmod' => null,
        ]];

        Barberia::query()
            ->activas()
            ->select('slug', 'updated_at')
            ->orderBy('nombre')
            ->get()
            ->each(function (Barberia $barberia) use (&$urls, $base) {
                $urls[] = [
                    'loc' => $base.'/barberia/'.$barberia->slug,
                    'changefreq' => 'weekly',
                    'priority' => '0.8',
                    'lastmod' => $barberia->updated_at?->toAtomString(),
                ];
            });

        $xml = '<?xml version="1.0" encoding="UTF-8"?>'."\n"
            .'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'."\n";

        foreach ($urls as $url) {
            $xml .= '  <url>'."\n";
            $xml .= '    <loc>'.htmlspecialchars($url['loc'], ENT_XML1).'</loc>'."\n";
            if ($url['lastmod']) {
                $xml .= '    <lastmod>'.$url['lastmod'].'</lastmod>'."\n";
            }
            $xml .= '    <changefreq>'.$url['changefreq'].'</changefreq>'."\n";
            $xml .= '    <priority>'.$url['priority'].'</priority>'."\n";
            $xml .= '  </url>'."\n";
        }

        $xml .= '</urlset>'."\n";

        return response($xml, 200, [
            'Content-Type' => 'application/xml; charset=UTF-8',
            'Cache-Control' => 'public, max-age='.self::CACHE_SEGUNDOS,
        ]);
    }
}
