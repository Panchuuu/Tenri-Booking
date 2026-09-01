<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Recordatorio de citas del día siguiente. Requiere el cron del hosting:
//   * * * * * php artisan schedule:run
// (ya documentado en el runbook de deploy). Idempotente: si el cron corre
// más de una vez, recordatorio_enviado_at evita duplicados.
Schedule::command('citas:enviar-recordatorios')->dailyAt('09:00');

// Cierre automático de citas confirmadas cuya hora pasó hace más de 24h.
// Idempotente (solo toma estado "confirmada"), así que correr cada hora
// es seguro y mantiene la agenda y las finanzas al día.
Schedule::command('citas:finalizar-vencidas')->hourly();
