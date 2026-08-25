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
    protected $appends = ['logo_url', 'rubro_nombre'];

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