<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Rol dual: un admin (dueño del local) puede además atender como
 * barbero. `rol` sigue siendo el rol principal (permisos); este flag
 * agrega la capacidad de barbero sin perder el panel de administración.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('es_barbero')->default(false)->after('rol');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('es_barbero');
        });
    }
};
