<?php

namespace App\Http\Requests;

use App\Models\Barberia;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * FormRequest para PUT /mi-barberia (BarberiaController@updateConfig).
 *
 * 🔧 FIX #4 (PDF): "En ajustes de negocio de la empresa/barberia no se limita
 * el tiempo máximo que se puede cancelar con anticipacion y además da error."
 *
 * El controller ya validaba inline con max:43200, pero:
 *   - Faltaba migrarlo a FormRequest (convención del proyecto, finding Tarea 2).
 *   - Faltaban mensajes claros en español (antes salían en inglés genérico).
 *
 * Contexto de seguridad:
 *   La ruta es PUT /mi-barberia (sin {id}). El controller resuelve la
 *   barbería del usuario autenticado vía $request->user()->barberia_id,
 *   así que NO necesitamos validar ID aquí — el middleware role:admin
 *   ya garantiza que el caller pertenece a una barbería.
 *
 * Único campo validado:
 *   - tiempo_cancelacion: minutos enteros, entre 0 y 43200 (30 días).
 *     El frontend (ConfiguracionPage.jsx) calcula este número con
 *     dias*1440 + horas*60 + minutos y manda el total.
 */
class UpdateConfigBarberiaRequest extends FormRequest
{
    public function authorize(): bool
    {
        // La autorización fina la maneja el middleware role:admin en la ruta.
        return true;
    }

    public function rules(): array
    {
        return [
            // 'sometimes': el panel del dueño tiene dos formularios (Mi Tienda
            // y Política de Cancelación) y cada uno envía solo sus campos.

            // 0 = cancelación instantánea permitida (válido para algunas barberías).
            // 43200 minutos = 30 días = límite superior razonable.
            'tiempo_cancelacion' => 'sometimes|required|integer|min:0|max:43200',

            // ── Perfil de la tienda (Mi Tienda) ──
            'nombre' => [
                'sometimes', 'required', 'string', 'min:3', 'max:60',
                Rule::unique('barberias', 'nombre')->ignore($this->user()?->barberia_id),
            ],
            'rubro'           => ['sometimes', 'required', Rule::in(array_keys(Barberia::RUBROS))],
            'color_principal' => 'sometimes|required|string|max:20',
            'logo'            => 'nullable|image|mimes:jpeg,jpg,png,webp|max:2048',

            // Ubicación física (opcional). Las coordenadas van en pareja:
            // una latitud sin longitud (o viceversa) no sirve para "cerca de mí".
            'direccion' => 'nullable|string|max:255',
            'latitud'   => 'nullable|numeric|between:-90,90|required_with:longitud',
            'longitud'  => 'nullable|numeric|between:-180,180|required_with:latitud',
        ];
    }

    public function messages(): array
    {
        return [
            'tiempo_cancelacion.required' => 'El tiempo de cancelación es obligatorio.',
            'tiempo_cancelacion.integer'  => 'El tiempo de cancelación debe ser un número entero de minutos.',
            'tiempo_cancelacion.min'      => 'El tiempo de cancelación no puede ser negativo.',
            'tiempo_cancelacion.max'      => 'El tiempo máximo de cancelación es de 30 días (43.200 minutos).',
            'nombre.required'             => 'El nombre de la tienda es obligatorio.',
            'nombre.min'                  => 'El nombre debe tener al menos 3 caracteres.',
            'nombre.max'                  => 'El nombre no puede superar los 60 caracteres.',
            'nombre.unique'               => 'Ya existe una tienda con ese nombre. Elige otro.',
            'rubro.in'                    => 'El rubro seleccionado no es válido.',
            'logo.image'                  => 'El logo debe ser una imagen válida.',
            'logo.mimes'                  => 'El logo debe ser JPG, PNG o WebP.',
            'logo.max'                    => 'El logo no puede pesar más de 2 MB.',
            'direccion.max'               => 'La dirección no puede superar los 255 caracteres.',
            'latitud.between'             => 'La latitud debe estar entre -90 y 90.',
            'longitud.between'            => 'La longitud debe estar entre -180 y 180.',
            'latitud.required_with'       => 'Si indicas longitud, la latitud es obligatoria.',
            'longitud.required_with'      => 'Si indicas latitud, la longitud es obligatoria.',
        ];
    }
}
