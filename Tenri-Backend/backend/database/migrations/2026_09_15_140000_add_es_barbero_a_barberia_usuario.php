<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Quién atiende, pero en cada local por separado.
     *
     * `users.es_barbero` era una sola casilla para toda la persona, y con
     * varios locales eso dejó de tener sentido: un dueño que corta el pelo en
     * su local A aparecía también como parte del equipo de su local B, donde
     * quizás solo administra. La casilla pasa acá, junto al resto de lo que
     * depende del local: el rol y el acceso.
     *
     * La columna en `users` **no se borra**: queda como reflejo de lo que dice
     * esta tabla para el local que la persona tiene seleccionado, que es lo que
     * el panel ya lee para mostrar el rol dual. Quien la escribe es el modelo,
     * en un solo lugar, para que no se vuelva una segunda verdad.
     */
    public function up(): void
    {
        Schema::table('barberia_usuario', function (Blueprint $table) {
            $table->boolean('es_barbero')->default(false)->after('rol');
        });

        // Lo que ya estaba marcado se conserva, pero solo para el local al que
        // esa persona pertenecía: es el único del que podemos afirmarlo.
        DB::table('barberia_usuario')
            ->join('users', 'users.id', '=', 'barberia_usuario.user_id')
            ->where('users.es_barbero', true)
            ->whereColumn('users.barberia_id', 'barberia_usuario.barberia_id')
            ->update(['barberia_usuario.es_barbero' => true]);

        // Y el barbero puro atiende en el local donde lo contrataron.
        DB::table('barberia_usuario')
            ->where('rol', 'barbero')
            ->update(['es_barbero' => true]);
    }

    public function down(): void
    {
        Schema::table('barberia_usuario', function (Blueprint $table) {
            $table->dropColumn('es_barbero');
        });
    }
};
