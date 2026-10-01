<?php

namespace App\Providers;

use App\Services\WhatsApp;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(WhatsApp::class, function ($app) {
            $config = $app['config']->get('services.whatsapp');

            return new WhatsApp(
                driver: $config['driver'] ?? 'log',
                token: $config['token'] ?? null,
                telefonoId: $config['phone_number_id'] ?? null,
                prefijoPais: (string) ($config['prefijo_pais'] ?? '56'),
            );
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
