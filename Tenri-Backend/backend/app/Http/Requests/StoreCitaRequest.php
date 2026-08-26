<?php

namespace App\Http\Requests;

use App\Models\Servicio;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Validation\Rule;

class StoreCitaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        // ============================================================
        // 🔒 FIX #13: límite de fechas futuras
        // ============================================================
        // - after_or_equal:today  → no se puede agendar en el pasado
        // - before_or_equal:+90d  → máximo 90 días en el futuro (3 meses)
        // ============================================================
        $fechaMaxima = now()->addDays(90)->toDateString();

        return [
            'servicio_id' => 'required|exists:servicios,id',
            // 🔒 FASE 1: el barbero debe existir Y tener rol "barbero".
            'barbero_id'  => [
                'required',
                Rule::exists('users', 'id')->where(fn ($q) => $q->where('rol', 'barbero')),
            ],
            'fecha'       => "required|date|after_or_equal:today|before_or_equal:{$fechaMaxima}",
            'hora'        => 'required|date_format:H:i',
        ];
    }

    /**
     * 🔒 FASE 1:
     * Validación extra: el barbero seleccionado DEBE pertenecer
     * a la misma barbería que el servicio reservado.
     * Esto evita reservas inconsistentes entre tenants.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            // 🔒 La cita debe empezar en el futuro. after_or_equal:today solo
            // valida la FECHA: sin este check, un POST directo podía reservar
            // hoy a una hora ya pasada (la agenda es hora de Chile).
            if ($this->fecha && $this->hora && !$validator->errors()->hasAny(['fecha', 'hora'])) {
                try {
                    // parse (no createFromFormat): la regla `date` acepta
                    // formatos flexibles y el check debe cubrirlos todos.
                    $inicio = Carbon::parse("{$this->fecha} {$this->hora}", 'America/Santiago');
                    if ($inicio->lt(Carbon::now('America/Santiago'))) {
                        $validator->errors()->add('hora', 'Ese horario ya pasó. Elige una hora futura.');
                    }
                } catch (\Throwable $e) {
                    // fecha/hora con formato raro: ya lo reportan las reglas base.
                }
            }

            if (!$this->servicio_id || !$this->barbero_id) {
                return;
            }

            $servicio = Servicio::find($this->servicio_id);
            $barbero  = User::find($this->barbero_id);

            if (!$servicio || !$barbero) {
                return;
            }

            if ($servicio->barberia_id !== $barbero->barberia_id) {
                $validator->errors()->add(
                    'barbero_id',
                    'El barbero seleccionado no pertenece a la misma barbería que el servicio.'
                );
            }
        });
    }

    public function messages(): array
    {
        return [
            'servicio_id.required'  => 'Debes seleccionar un servicio.',
            'servicio_id.exists'    => 'El servicio seleccionado no existe.',
            'barbero_id.required'   => 'Debes seleccionar un barbero.',
            'barbero_id.exists'     => 'El barbero seleccionado no es válido.',
            'fecha.required'        => 'La fecha de la reserva es obligatoria.',
            'fecha.date'            => 'La fecha no tiene un formato válido.',
            'fecha.after_or_equal'  => 'No puedes agendar en fechas pasadas.',
            'fecha.before_or_equal' => 'Solo puedes agendar hasta 90 días en el futuro.',
            'hora.required'         => 'La hora de la reserva es obligatoria.',
            'hora.date_format'      => 'La hora debe tener formato HH:MM (ej: 14:30).',
        ];
    }
}
