<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * En qué locales trabaja cada persona.
     *
     * Hasta acá `users.barberia_id` decía las dos cosas a la vez: a qué local
     * pertenece alguien y cuál está administrando. Eso alcanzaba mientras una
     * persona tuviera un solo local, y dejó de alcanzar: un dueño puede abrir
     * varios y tiene que poder entrar una vez y elegir cuál administrar.
     *
     * El reparto queda así:
     *
     * - **Esta tabla** dice a qué locales tiene acceso, y con qué rol en cada uno.
     * - **`users.barberia_id`** pasa a ser cuál tiene seleccionado ahora mismo.
     *
     * Separarlo de esta forma, y no reemplazar la columna, es lo que permite
     * que las consultas que ya existen -las citas del local, sus servicios, su
     * personal- sigan funcionando sin tocarlas: todas preguntan por el local
     * activo, que es justo lo que la columna sigue significando.
     */
    public function up(): void
    {
        Schema::create('barberia_usuario', function (Blueprint $table) {
            $table->id();
            $table->foreignId('barberia_id')->constrained('barberias')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();

            // El rol en **este** local. Alguien puede ser dueño de uno y
            // atender como barbero en otro.
            $table->string('rol', 20)->default('admin');

            $table->timestamps();

            $table->unique(['barberia_id', 'user_id']);
        });

        // Lo que ya existe: cada persona con local queda ligada al suyo, con el
        // rol que tiene hoy. Sin esto, al desplegar, todos los dueños quedarían
        // sin ningún local que administrar.
        DB::table('users')
            ->whereNotNull('barberia_id')
            ->orderBy('id')
            ->chunkById(200, function ($usuarios) {
                $filas = [];

                foreach ($usuarios as $usuario) {
                    $filas[] = [
                        'barberia_id' => $usuario->barberia_id,
                        'user_id' => $usuario->id,
                        'rol' => $usuario->rol ?? 'admin',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                }

                if ($filas !== []) {
                    DB::table('barberia_usuario')->insertOrIgnore($filas);
                }
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('barberia_usuario');
    }
};
