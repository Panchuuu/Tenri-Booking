<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * El teléfono de quien reserva.
     *
     * Hasta acá el único contacto era el correo, y el aviso que de verdad se
     * lee -el recordatorio de la hora, el hueco que se liberó- es el de
     * WhatsApp. Sin este dato no hay a dónde mandarlo.
     *
     * Es opcional: quien no lo deje sigue recibiendo todo por correo, como
     * hasta ahora. Se guarda tal como lo escribió la persona y se normaliza al
     * enviar, para no pelear con el formato en el formulario.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('telefono', 25)->nullable()->after('email');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('telefono');
        });
    }
};
