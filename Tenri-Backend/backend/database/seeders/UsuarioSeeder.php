<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash; // Para encriptar la contraseña

class UsuarioSeeder extends Seeder
{
    public function run(): void
    {
        // 🔒 Credenciales de prueba: jamás en producción. Un `db:seed` en el
        // servidor crearía un superadmin con contraseña conocida (admin123).
        if (app()->environment('production')) {
            $this->command?->warn('UsuarioSeeder omitido: no se crean usuarios de prueba en producción.');
            return;
        }

        // Creamos al Administrador
        User::create([
            'name' => 'Admin Tenri',
            'email' => 'admin@tenri.cl',
            'password' => Hash::make('admin123'), // Siempre encriptada
            'rol' => 'superadmin'
        ]);

        // Creamos a un Barbero de prueba
        User::create([
            'name' => 'Juan el Barbero',
            'email' => 'juan@tenri.cl',
            'password' => Hash::make('barbero123'),
            'rol' => 'barbero'
        ]);
    }
}