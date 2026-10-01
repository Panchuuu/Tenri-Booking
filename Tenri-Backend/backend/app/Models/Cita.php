<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Cita extends Model
{
    use HasFactory;

    protected $fillable = ['cliente_id', 'barbero_id', 'servicio_id', 'fecha', 'hora', 'estado', 'barberia_id', 'calificacion',
    'comentario'];

    /**
     * Una cita cancelada libera un cupo, y ese cupo tiene quien lo espere.
     *
     * El aviso se engancha al modelo y no a cada controlador porque cancelar
     * pasa por tres caminos -el cliente desde sus reservas, el barbero desde su
     * agenda, el admin desde el panel- y mañana puede pasar por un cuarto. Acá
     * quedan cubiertos todos de una vez.
     */
    protected static function booted(): void
    {
        static::updated(function (self $cita) {
            if (! $cita->wasChanged('estado') || $cita->estado !== 'cancelada') {
                return;
            }

            try {
                \App\Jobs\AvisarCupoLiberado::dispatch($cita->id);
            } catch (\Throwable $e) {
                // Con la cola en `sync` el job corre acá mismo y puede fallar.
                // Avisar de un cupo nunca puede voltear una cancelación.
                \Illuminate\Support\Facades\Log::warning(
                    'No se pudo encolar el aviso de cupo liberado: '.$e->getMessage()
                );
            }
        });
    }

    public function barberia()
    {
        return $this->belongsTo(Barberia::class);
    }

    // Relación: Una cita pertenece a un Cliente (User)
    public function cliente() {
        return $this->belongsTo(User::class, 'cliente_id');
    }

    // Relación: Una cita pertenece a un Barbero (User)
    public function barbero() {
        return $this->belongsTo(User::class, 'barbero_id');
    }

    // Relación: Una cita pertenece a un Servicio
    public function servicio() {
        return $this->belongsTo(Servicio::class, 'servicio_id');
    }
}