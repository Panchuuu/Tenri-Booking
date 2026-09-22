<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

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

    /**
     * El slug libre para un nombre dado.
     *
     * El `unique` de `nombre` no basta: "Barbería VIP" y "Barberia-VIP" son
     * nombres distintos que colapsan al mismo slug, y el slug es la URL
     * pública (`showPorSlug` devolvería la equivocada).
     */
    public static function slugDisponible(string $nombre): string
    {
        $base = Str::slug($nombre) ?: 'tienda';
        $slug = $base;

        for ($i = 2; static::where('slug', $slug)->exists(); $i++) {
            $slug = "{$base}-{$i}";
        }

        return $slug;
    }

    /**
     * Crea la barbería junto a su usuario administrador, en una sola
     * operación: una barbería sin nadie que pueda entrar a administrarla no
     * sirve de nada. Compartido por el alta manual del superadmin
     * (BarberiaController::store) y el alta que dispara una compra en
     * tenri.cl (IntegracionPanelController::crearBarberia), para que "crear
     * una barbería" sea una sola cosa y no dos copias que se desalinean.
     *
     * Todo en una transacción: si el usuario no se puede crear, la barbería no
     * puede quedar creada y sin dueño.
     *
     * **Si el correo ya tiene cuenta, se le suma este local.** Una persona
     * puede tener varios: los acumula en `barberia_usuario` y elige cuál
     * administrar al entrar. En ese caso **no se le toca la contraseña** —es la
     * que ya usa para sus otros locales— y por eso el resultado dice si el
     * usuario se creó o se reutilizó: quien avisa por correo necesita saber si
     * mandar una clave nueva o recordarle la suya.
     *
     * La contraseña puede llegar en claro (`admin_password`, alta manual) o ya
     * cifrada (`admin_password_hash`, compra en tenri.cl: es el mismo hash de
     * la cuenta del comprador). El cast `hashed` del modelo User distingue una
     * de otra sola. Ojo: eso exige el mismo algoritmo y costo de bcrypt en los
     * dos lados, igual que el puente ERP.
     *
     * `plan` no está en `$fillable` a propósito -mismo motivo que
     * `estado_suscripcion`- así que se asigna aparte con `forceFill`.
     *
     * @param  array<string,mixed>  $datos  nombre_barberia, color_principal, admin_nombre,
     *                                       admin_email, admin_password o admin_password_hash,
     *                                       y opcionalmente logo y plan.
     * @return array{barberia:self,admin_creado:bool}
     */
    public static function crearConAdmin(array $datos): array
    {
        return DB::transaction(function () use ($datos) {
            $existente = User::where('email', $datos['admin_email'])->first();

            // El superadmin de la plataforma no se convierte en dueño de un
            // local: su cuenta no es de nadie en particular.
            if ($existente && $existente->rol === 'superadmin') {
                throw ValidationException::withMessages([
                    'admin_email' => 'Ese correo es de una cuenta de plataforma y no puede administrar un local.',
                ]);
            }

            $barberia = static::create([
                'nombre' => $datos['nombre_barberia'],
                'slug' => static::slugDisponible($datos['nombre_barberia']),
                'color_principal' => $datos['color_principal'],
                'logo' => $datos['logo'] ?? null,
            ]);

            if (! empty($datos['plan'])) {
                $barberia->forceFill(['plan' => $datos['plan']])->save();
            }

            if ($existente) {
                $existente->darAccesoA($barberia, 'admin');

                return ['barberia' => $barberia, 'admin_creado' => false];
            }

            $admin = User::create([
                'name' => $datos['admin_nombre'],
                'email' => $datos['admin_email'],
                'password' => $datos['admin_password_hash'] ?? $datos['admin_password'],
                'rol' => 'admin',
                'barberia_id' => $barberia->id,
            ]);

            $admin->darAccesoA($barberia, 'admin');

            return ['barberia' => $barberia, 'admin_creado' => true];
        });
    }

    /**
     * Todas las personas con acceso a este local, con su rol acá.
     */
    public function equipo()
    {
        return $this->belongsToMany(User::class, 'barberia_usuario')
            ->withPivot('rol', 'es_barbero')
            ->withTimestamps();
    }

    /**
     * Quiénes atienden **en este local**.
     *
     * El barbero contratado acá, y el dueño que además corta el pelo acá. Que
     * sea por local y no por persona es justamente la corrección: antes un
     * dueño que atendía en un local aparecía en el equipo de todos los suyos.
     */
    public function quienesAtienden()
    {
        return $this->equipo()->where(function ($q) {
            $q->where('barberia_usuario.rol', 'barbero')
                ->orWhere('barberia_usuario.es_barbero', true);
        });
    }

    /**
     * Qué le falta a este local para estar listo para recibir reservas.
     *
     * Una tienda recién creada tiene nombre y poco más: sin dirección nadie la
     * encuentra, sin alguien que atienda no hay agenda y sin servicios no hay
     * qué reservar. Esta lista es lo que el panel muestra arriba como avance, y
     * lo que el tutorial de primeros pasos recorre.
     *
     * El orden es el orden en que conviene hacerlo, no el alfabético: primero
     * que exista en el mapa, después quién atiende, después qué se ofrece.
     *
     * `destino` le dice al panel a qué pantalla llevar al tocar el paso. Es una
     * clave, no una ruta: quién la traduce a URL es el front, que es el que
     * sabe cómo se llaman sus pantallas.
     *
     * @return array<int,array<string,mixed>>
     */
    public function pasosDeConfiguracion(): array
    {
        $atiendeAlguien = $this->quienesAtienden()->exists();

        return [
            [
                'clave' => 'direccion',
                'titulo' => 'Dice dónde estás',
                'detalle' => 'Tu dirección es lo que te hace aparecer en las búsquedas cercanas.',
                'completo' => filled($this->direccion) && $this->latitud !== null && $this->longitud !== null,
                'destino' => 'tienda',
            ],
            [
                'clave' => 'logo',
                'titulo' => 'Sube tu logo',
                'detalle' => 'Es lo primero que ve alguien cuando te encuentra.',
                'completo' => filled($this->logo),
                'destino' => 'tienda',
            ],
            [
                'clave' => 'personal',
                'titulo' => 'Suma a quien atiende',
                'detalle' => 'Puedes ser tú: sin nadie que atienda no hay agenda que reservar.',
                'completo' => $atiendeAlguien,
                'destino' => 'equipo',
            ],
            [
                'clave' => 'servicios',
                'titulo' => 'Crea tus servicios',
                'detalle' => 'Con su precio y cuánto dura cada uno. Es lo que se reserva.',
                'completo' => $this->servicios()->exists(),
                'destino' => 'servicios',
            ],
        ];
    }

    /** Cuánto de la puesta en marcha está hecho, de 0 a 100. */
    public function avanceDeConfiguracion(): int
    {
        $pasos = $this->pasosDeConfiguracion();
        $listos = count(array_filter($pasos, fn (array $paso) => $paso['completo']));

        return (int) round($listos / max(count($pasos), 1) * 100);
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