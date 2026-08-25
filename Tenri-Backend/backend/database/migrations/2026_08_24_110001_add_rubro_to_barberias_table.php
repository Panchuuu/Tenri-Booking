<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('barberias', function (Blueprint $table) {
            // Rubro/categoría de la tienda (barberia, salon_belleza, perfumeria…).
            // Las claves válidas viven en Barberia::RUBROS. Default 'barberia'
            // porque todas las tiendas existentes lo son.
            $table->string('rubro', 40)->default('barberia')->after('color_principal');
        });
    }

    public function down(): void
    {
        Schema::table('barberias', function (Blueprint $table) {
            $table->dropColumn('rubro');
        });
    }
};
