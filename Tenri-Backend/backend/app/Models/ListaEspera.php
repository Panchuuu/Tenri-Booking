<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Alguien esperando que se libere un cupo.
 *
 * Nace cuando una persona quiso reservar un día que no tenía horas y pidió que
 * le avisaran. Muere cuando se le avisa, cuando reserva, o cuando pasa el día.
 *
 * `estado` distingue tres momentos:
 *
 * - `esperando`: sigue en la fila.
 * - `avisado`: se le avisó de un cupo. No se le vuelve a avisar por el mismo
 *   día, porque el segundo mensaje ya es molestia y el cupo probablemente lo
 *   tomó otra persona.
 * - `cerrada`: se dio de baja, o ya reservó.
 */
class ListaEspera extends Model
{
    use HasFactory;

    public const ESPERANDO = 'esperando';

    public const AVISADO = 'avisado';

    public const CERRADA = 'cerrada';

    protected $table = 'lista_espera';

    protected $fillable = [
        'barberia_id',
        'cliente_id',
        'servicio_id',
        'barbero_id',
        'fecha',
        'estado',
        'avisado_en',
    ];

    protected $casts = [
        'fecha' => 'date',
        'avisado_en' => 'datetime',
    ];

    public function barberia()
    {
        return $this->belongsTo(Barberia::class);
    }

    public function cliente()
    {
        return $this->belongsTo(User::class, 'cliente_id');
    }

    public function barbero()
    {
        return $this->belongsTo(User::class, 'barbero_id');
    }

    public function servicio()
    {
        return $this->belongsTo(Servicio::class);
    }

    /** Las que siguen en la fila para un día que todavía no pasó. */
    public function scopeVigentes($query)
    {
        return $query->where('estado', self::ESPERANDO)
            ->whereDate('fecha', '>=', now()->toDateString());
    }
}
