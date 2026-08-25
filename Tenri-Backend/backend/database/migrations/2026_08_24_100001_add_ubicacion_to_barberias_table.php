<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('barberias', function (Blueprint $table) {
            // Dirección física visible al cliente y coordenadas para "cerca de mí".
            // Nullable: las barberías existentes no tienen ubicación cargada aún.
            $table->string('direccion')->nullable()->after('color_principal');
            $table->decimal('latitud', 10, 7)->nullable()->after('direccion');
            $table->decimal('longitud', 10, 7)->nullable()->after('latitud');
        });
    }

    public function down(): void
    {
        Schema::table('barberias', function (Blueprint $table) {
            $table->dropColumn(['direccion', 'latitud', 'longitud']);
        });
    }
};
