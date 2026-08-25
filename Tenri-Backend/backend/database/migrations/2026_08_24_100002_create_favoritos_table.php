<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('favoritos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('barberia_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            // Un usuario no puede marcar dos veces la misma barbería.
            $table->unique(['user_id', 'barberia_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('favoritos');
    }
};
