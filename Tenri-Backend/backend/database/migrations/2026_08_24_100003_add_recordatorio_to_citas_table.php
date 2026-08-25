<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('citas', function (Blueprint $table) {
            // Marca de idempotencia del comando citas:enviar-recordatorios:
            // evita mandar dos veces el recordatorio si el cron corre de nuevo.
            $table->timestamp('recordatorio_enviado_at')->nullable()->after('comentario');
        });
    }

    public function down(): void
    {
        Schema::table('citas', function (Blueprint $table) {
            $table->dropColumn('recordatorio_enviado_at');
        });
    }
};
