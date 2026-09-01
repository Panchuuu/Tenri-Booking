<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Barberia extends Model
{
    use HasFactory;

    /**
     * Catálogo de rubros válidos: clave almacenada => etiqueta visible.
     * Única fuente de verdad — la validación y el endpoint público /rubros
     * salen de aquí.
     */
    public const RUBROS = [
        'barberia'        => 'Barbería',
        'salon_belleza'   => 'Salón de belleza',
        'peluqueria'      => 'Peluquería',
        'centro_estetica' => 'Centro de estética',
        'perfumeria'      => 'Perfumería',
        'spa'             => 'Spa',
    ];

    // 1. Agregamos 'logo' a los campos permitidos
    protected $fillable = [
        'nombre', 'slug', 'color_principal', 'logo', 'tiempo_cancelacion',
        'direccion', 'latitud', 'longitud', 'rubro',
    ];

    protected $casts = [
        'latitud'  => 'float',
        'longitud' => 'float',
    ];

    // 2. Le decimos a Laravel que SIEMPRE envíe este campo inventado llamado 'logo_url'
    protected $appends = ['logo_url', 'rubro_nombre', 'activa'];

    /**
     * La suspensión, derivada de `estado_suscripcion` (columna que existía
     * desde la migración de suscripciones pero que nada leía). Una barbería
     * suspendida sale del listado público, no acepta reservas nuevas y sus
     * usuarios no pueden iniciar sesión. Se cambia solo desde el canal del
     * panel (IntegracionPanelController), por eso la columna no está en
     * $fillable.
     */
    public function getActivaAttribute(): bool
    {
        return $this->estado_suscripcion !== 'suspendida';
    }

    /** Solo las barberías que el público debe ver y reservar. */
    public function scopeActivas($query)
    {
        return $query->where(function ($q) {
            $q->whereNull('estado_suscripcion')
              ->orWhere('estado_suscripcion', '!=', 'suspendida');
        });
    }

    /**
     * Suspende o reactiva la barbería (toggle). La única forma de cambiar el
     * estado: la comparten el canal del panel y el superadmin de esta app,
     * para que "suspender" signifique siempre lo mismo.
     *
     * Al suspender se revocan los tokens de sus usuarios: sin eso, un admin
     * con sesión viva seguiría operando una barbería suspendida.
     *
     * @return bool el estado resultante de `activa`
     */
    public function alternarSuspension(): bool
    {
        $suspender = $this->activa;

        $this->forceFill([
            'estado_suscripcion' => $suspender ? 'suspendida' : 'activa',
        ])->save();

        if ($suspender) {
            foreach ($this->usuarios()->get() as $usuario) {
                $usuario->tokens()->delete();
            }
        }

        return ! $suspender;
    }

    // Etiqueta legible del rubro, siempre presente en el JSON.
    public function getRubroNombreAttribute(): string
    {
        return self::RUBROS[$this->rubro] ?? 'Barbería';
    }

    // 3. Calculamos la URL mágica
    public function getLogoUrlAttribute()
    {
        if ($this->logo) {
            return asset('storage/' . $this->logo);
        }
        return null;
    }

    public function usuarios() {
        return $this->hasMany(User::class);
    }

    public function citas()
    {
        return $this->hasMany(Cita::class);
    }

    public function servicios()
    {
        return $this->hasMany(Servicio::class);
    }
}