<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Quién quiere una hora que hoy no hay.
     *
     * El día lleno es plata que el local no gana dos veces: pierde a quien
     * quería venir, y cuando alguien cancela a última hora ese hueco se queda
     * vacío porque nadie se entera. La lista junta las dos puntas: quien quería
     * ese día queda anotado, y en cuanto se libera un cupo se le avisa.
     *
     * Se anota por **día**, no por hora exacta. Quien quiere venir el sábado
     * acepta casi cualquier hora del sábado, y pedir la hora exacta reduciría
     * la lista a casi nadie, que es como estas listas terminan sin servir.
     *
     * `barbero_id` es opcional: quien viene por una persona en particular lo
     * dice, y solo se le avisa cuando el hueco es de esa persona.
     */
    public function up(): void
    {
        Schema::create('lista_espera', function (Blueprint $table) {
            $table->id();

            $table->foreignId('barberia_id')->constrained('barberias')->cascadeOnDelete();
            $table->foreignId('cliente_id')->constrained('users')->cascadeOnDelete();

            // Con qué quiere venir. Los dos opcionales: la lista sirve igual
            // sin ellos, y exigirlos la vacía.
            $table->foreignId('servicio_id')->nullable()->constrained('servicios')->nullOnDelete();
            $table->foreignId('barbero_id')->nullable()->constrained('users')->nullOnDelete();

            $table->date('fecha');

            // esperando | avisado | cerrada
            $table->string('estado', 20)->default('esperando');

            $table->timestamp('avisado_en')->nullable();
            $table->timestamps();

            // La consulta que se hace en cada cancelación: quién espera este
            // día en este local.
            $table->index(['barberia_id', 'fecha', 'estado']);

            // Una persona no se anota dos veces para el mismo día y local: el
            // aviso sería doble y la lista, mentirosa.
            $table->unique(['barberia_id', 'cliente_id', 'fecha']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lista_espera');
    }
};
