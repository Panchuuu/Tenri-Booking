<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePerfilRequest extends FormRequest
{
    /**
     * Todos los usuarios autenticados pueden actualizar su perfil.
     */
    public function authorize(): bool { return true; }

    /**
     * Reglas de validación comentadas.
     */
    public function rules(): array
    {
        $userId = $this->user()->id;
        $esBarbero = $this->user()->rol === 'barbero';

        // 📋 Reglas base — aplican a TODOS los roles (cliente, barbero, admin, superadmin)
        $reglas = [
            // Alineado con Pack 1 y Pack 2/B: max:80 (era max:255 irreal).
            'name' => 'required|string|min:2|max:80',

            // Para el recordatorio de la hora y el aviso de cupo por WhatsApp.
            // Opcional: sin él todo sigue saliendo por correo. Se acepta como
            // la persona lo escriba; el envío lo normaliza.
            'telefono' => 'nullable|string|max:25',

            // Alineado con Pack 1 y Pack 2/B: email validation completa.
            // unique ignora al propio usuario para que pueda guardar sin cambiar email.
            'email' => [
                'required',
                'string',
                'email:rfc,dns,filter',
                'max:120',
                Rule::unique('users', 'email')->ignore($userId),
            ],

            // Password OPCIONAL en update de perfil.
            // Si viene presente, debe cumplir misma política que registro (Pack 1).
            'password' => [
                'nullable',
                'string',
                'min:8',
                'confirmed',
                'regex:/[A-Za-z]/',
                'regex:/[0-9]/',
            ],

            // Avatar alineado con B.1/B.2/B.3 (5MB + mimes consistentes).
            'avatar' => 'nullable|image|mimes:jpeg,jpg,png,webp|max:5120',
        ];

        // 🔧 FIX #15 (PDF): el barbero puede editar SU propio perfil profesional
        // (bio, especialidad). Los otros roles no necesitan estos campos —
        // si los envían igual, se ignoran silenciosamente (no entran en validated()).
        if ($esBarbero) {
            $reglas['bio']          = 'nullable|string|max:500';
            $reglas['especialidad'] = 'nullable|string|max:100';
        }

        return $reglas;
    }

    public function messages(): array
    {
        return [
            // Nombre
            'name.required' => 'El nombre es obligatorio.',
            'name.min'      => 'El nombre debe tener al menos 2 caracteres.',
            'name.max'      => 'El nombre no puede superar los 80 caracteres.',

            // Email
            'email.required' => 'El correo es obligatorio.',
            'email.email'    => 'El correo no es válido. Verifica el dominio (ej: usuario@gmail.com).',
            'email.max'      => 'El correo no puede superar los 120 caracteres.',
            'email.unique'   => 'Ya existe otro usuario con este correo.',

            // Password (opcional)
            'password.min'       => 'La contraseña debe tener al menos 8 caracteres.',
            'password.confirmed' => 'Las contraseñas no coinciden.',
            'password.regex'     => 'La contraseña debe contener letras y números.',

            // Avatar
            'avatar.image' => 'El archivo debe ser una imagen válida.',
            'avatar.mimes' => 'La imagen debe ser JPG, PNG o WebP.',
            'avatar.max'   => 'La imagen no puede pesar más de 5 MB.',

            // Bio y especialidad (solo barbero, pero los mensajes los dejamos
            // siempre por si Laravel los necesita)
            'bio.max'          => 'La biografía no puede superar los 500 caracteres.',
            'especialidad.max' => 'La especialidad no puede superar los 100 caracteres.',
        ];
    }
}