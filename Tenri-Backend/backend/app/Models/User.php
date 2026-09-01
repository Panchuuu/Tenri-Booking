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
        return $this->rol === 'barbero'
            || ($this->rol === 'admin' && $this->es_barbero);
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

    public function barberia()
    {
        return $this->belongsTo(Barberia::class);
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
