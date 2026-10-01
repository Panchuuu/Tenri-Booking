<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        // Para el recordatorio y el aviso de cupo por WhatsApp. Opcional: sin
        // él todo sale por correo, como antes.
        'telefono',
        'password',
        'rol',
        // 🧢 Rol dual: admin que además atiende como barbero
        'es_barbero',
        // 🎯 Pack 3: campo de suspensión de cuenta
        'suspendido',
        'avatar',
        'barberia_id',
        'hora_inicio',
        'hora_fin',
        // 🎨 FASE 4A
        'bio',
        'especialidad',
        'promedio_calificacion',
        'total_resenas',
    ];

    protected $hidden = ['password', 'remember_token'];

    /**
     * El acceso al local se crea solo cuando alguien queda asignado a uno.
     *
     * `barberia_id` se escribe desde varios lados -contratar, asignar rol, el
     * alta de una tienda, seeders, factories- y el acceso vive en otra tabla.
     * En vez de recordar agregarlo en cada uno de esos lugares, se agrega acá:
     * quien tiene local, tiene acceso a ese local.
     *
     * Solo crea la fila si falta. Nunca pisa una que ya exista, porque esa fila
     * sabe cosas que la columna no -si atiende ahí, con qué rol- y perderlas
     * sería volver al problema que la tabla vino a resolver.
     */
    protected static function booted(): void
    {
        static::created(function (self $usuario) {
            $usuario->asegurarAccesoAlLocalActivo();
        });

        static::updated(function (self $usuario) {
            if ($usuario->wasChanged('barberia_id')) {
                $usuario->asegurarAccesoAlLocalActivo();
            }
        });
    }

    protected $casts = [
        'email_verified_at'      => 'datetime',
        'password'               => 'hashed',
        'promedio_calificacion'  => 'decimal:2',
        'total_resenas'          => 'integer',
        // 🎯 Pack 3: para devolver true/false al frontend (no 0/1)
        'suspendido'             => 'boolean',
        'es_barbero'             => 'boolean',
    ];

    // Siempre exponer avatar_url en la respuesta JSON
    protected $appends = ['avatar_url'];

    /**
     * Accessor: URL completa del avatar.
     */
    public function getAvatarUrlAttribute(): ?string
    {
        return $this->avatar ? asset('storage/' . $this->avatar) : null;
    }

    // ===== Rol dual =====

    /**
     * ¿Este usuario atiende como barbero? Cubre el rol puro y el
     * dueño (admin) que además corta. Única fuente de verdad para
     * "puede recibir reservas / usar el panel de barbero".
     */
    public function esBarberoActivo(): bool
    {
        if ($this->barberia_id === null) {
            return false;
        }

        return $this->atiendeEn((int) $this->barberia_id);
    }

    /**
     * Scope: usuarios que atienden como barberos (rol puro o admin
     * con es_barbero). Reemplaza a los where('rol', 'barbero').
     */
    public function scopeBarberos($query)
    {
        return $query->where(function ($q) {
            $q->where('rol', 'barbero')
              ->orWhere(function ($q2) {
                  $q2->where('rol', 'admin')->where('es_barbero', true);
              });
        });
    }

    // ===== Relaciones =====

    /**
     * El local que esta persona tiene seleccionado ahora.
     *
     * Sigue siendo la fuente de todo lo que el panel muestra -su agenda, su
     * personal, sus servicios-. Lo que cambio es que ya no es el unico local al
     * que puede entrar: ver {@see barberiasAdministradas()}.
     */
    public function barberia()
    {
        return $this->belongsTo(Barberia::class);
    }

    /**
     * Todos los locales a los que tiene acceso, con su rol en cada uno.
     *
     * Un duenio puede abrir varios; alguien puede ser duenio de uno y atender
     * como barbero en otro. Al entrar elige con cual trabajar.
     */
    public function barberiasAdministradas()
    {
        return $this->belongsToMany(Barberia::class, 'barberia_usuario')
            ->withPivot('rol', 'es_barbero')
            ->withTimestamps();
    }

    /**
     * Le da acceso a un local, o le actualiza el rol si ya lo tenia.
     *
     * Si no tenia ninguno seleccionado, este pasa a serlo: quien acaba de
     * recibir su primer local no deberia tener que elegirlo.
     */
    public function darAccesoA(Barberia $barberia, string $rol = 'admin', ?bool $atiende = null): void
    {
        $this->barberiasAdministradas()->syncWithoutDetaching([
            $barberia->id => [
                'rol' => $rol,
                // Un barbero atiende por definicion; a un admin hay que decirlo.
                'es_barbero' => $atiende ?? ($rol === 'barbero'),
            ],
        ]);

        if ($this->barberia_id === null) {
            $this->forceFill(['barberia_id' => $barberia->id, 'rol' => $rol])->save();
        }

        $this->refrescarEsBarbero();
    }

    /**
     * Marca -o desmarca- que esta persona atiende en un local.
     *
     * Es por local a proposito: un duenio puede cortar el pelo en uno y solo
     * administrar en otro, y antes de que esto viviera en la tabla de accesos
     * marcarse en uno lo sumaba al equipo de todos.
     */
    public function atenderEn(int $barberiaId, bool $atiende): void
    {
        if (! $this->barberiasAdministradas()->whereKey($barberiaId)->exists()) {
            return;
        }

        $this->barberiasAdministradas()->updateExistingPivot($barberiaId, ['es_barbero' => $atiende]);

        $this->refrescarEsBarbero();
    }

    /** Si atiende en ese local. */
    public function atiendeEn(int $barberiaId): bool
    {
        $acceso = $this->barberiasAdministradas()->whereKey($barberiaId)->first();

        if (! $acceso) {
            return false;
        }

        return $acceso->pivot->rol === 'barbero' || (bool) $acceso->pivot->es_barbero;
    }

    /**
     * Deja `users.es_barbero` igual a lo que dice el local activo.
     *
     * La columna sigue existiendo porque el panel la lee para mostrar el rol
     * dual, pero ya no es la verdad: es el reflejo del local seleccionado. Un
     * solo escritor -este metodo- para que no se convierta en una segunda
     * version de los hechos.
     */
    public function refrescarEsBarbero(): void
    {
        $deberia = $this->barberia_id !== null && $this->atiendeEn((int) $this->barberia_id);

        if ((bool) $this->es_barbero !== $deberia) {
            $this->forceFill(['es_barbero' => $deberia])->save();
        }
    }

    /**
     * Garantiza que el local activo también figure entre sus accesos.
     *
     * Antes de que existiera `barberia_usuario`, pertenecer a un local era solo
     * la columna `barberia_id`, y varios caminos la escriben directo. Si una de
     * esas filas no tiene su acceso, esta persona no podría entrar a su propio
     * local. Se arregla sola la primera vez que lo intenta, en vez de dejar el
     * problema esperando a que alguien lo note.
     */
    public function asegurarAccesoAlLocalActivo(): void
    {
        if ($this->barberia_id === null) {
            return;
        }

        if ($this->barberiasAdministradas()->whereKey($this->barberia_id)->exists()) {
            return;
        }

        $this->barberiasAdministradas()->syncWithoutDetaching([
            $this->barberia_id => [
                'rol' => $this->rol ?: 'admin',
                'es_barbero' => $this->rol === 'barbero' || (bool) $this->es_barbero,
            ],
        ]);
    }

    /** Si puede trabajar en ese local. El superadmin entra a todos. */
    public function puedeAdministrar(int $barberiaId): bool
    {
        if ($this->rol === 'superadmin') {
            return true;
        }

        return $this->barberiasAdministradas()->whereKey($barberiaId)->exists();
    }

    /**
     * Deja ese local como el activo, y adopta el rol que tiene ahi.
     *
     * El rol viaja con el local a proposito: la misma persona puede ser
     * administradora de su local y barbera en el de un socio, y lo que puede
     * hacer depende de donde esta parada.
     */
    public function seleccionarLocal(int $barberiaId): bool
    {
        $acceso = $this->barberiasAdministradas()->whereKey($barberiaId)->first();

        if (! $acceso) {
            return false;
        }

        $this->forceFill([
            'barberia_id' => $barberiaId,
            'rol' => $acceso->pivot->rol ?: $this->rol,

            // Atender es del local, no de la persona: al cambiar de local
            // cambia también si forma parte de ese equipo.
            'es_barbero' => $acceso->pivot->rol === 'barbero' || (bool) $acceso->pivot->es_barbero,
        ])->save();

        return true;
    }

    public function citasComoBarbero()
    {
        return $this->hasMany(Cita::class, 'barbero_id');
    }

    public function citasComoCliente()
    {
        return $this->hasMany(Cita::class, 'cliente_id');
    }

    public function bloqueos()
    {
        return $this->hasMany(BloqueoHorario::class, 'barbero_id');
    }

    public function barberiasFavoritas()
    {
        return $this->belongsToMany(Barberia::class, 'favoritos')->withTimestamps();
    }
}
