<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Si el tutorial de puesta en marcha ya se resolvió para este local.
     *
     * Se llena tanto si lo siguieron hasta el final como si lo saltaron: lo que
     * marca es que a esta persona ya se le ofreció, y ofrecerlo de nuevo en cada
     * ingreso sería molesto. La lista de pendientes sigue estando visible en el
     * panel de todos modos, así que saltarlo no es perderse nada.
     *
     * Vive en la barbería y no en el usuario porque lo que se configura es el
     * local: si mañana entra un socio, el tutorial ya no tiene nada que pedirle.
     */
    public function up(): void
    {
        Schema::table('barberias', function (Blueprint $table) {
            $table->timestamp('onboarding_resuelto_en')->nullable()->after('rubro');
        });

        // Los locales que ya existen y están andando no tienen por qué recibir
        // un tutorial de primeros pasos: se da por resuelto para ellos.
        DB::table('barberias')->update(['onboarding_resuelto_en' => now()]);
    }

    public function down(): void
    {
        Schema::table('barberias', function (Blueprint $table) {
            $table->dropColumn('onboarding_resuelto_en');
        });
    }
};
