<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 🔒 Todos los seeders crean datos de demo: el guard vive aquí (el
        // punto de entrada de db:seed) y no solo en seeders individuales,
        // para que ningún seeder futuro se olvide de protegerse.
        if (app()->environment('production')) {
            $this->command?->warn('Seeders omitidos: no se crean datos de prueba en producción.');
            return;
        }

        // Llamamos a nuestros seeders creados
        $this->call([
            ServicioSeeder::class,
            UsuarioSeeder::class,
        ]);
    }
}
