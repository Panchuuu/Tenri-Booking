<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 20px;">

    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">

        <div style="background-color: #03070e; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 2px;">
                TENRI <span style="color: #10b981;">BOOKING</span>
            </h1>
        </div>

        <div style="padding: 40px 30px;">
            <p style="font-size: 16px; line-height: 1.6; color: #475569; margin-top: 0;">
                Hola, <strong style="color: #0f172a;">{{ $nombreCliente }}</strong>.
            </p>
            <p style="font-size: 16px; line-height: 1.6; color: #475569;">
                Se liberó una hora en <strong style="color: #0f172a;">{{ $cita->barberia->nombre }}</strong> el día que estabas esperando.
            </p>

            <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; border-radius: 4px; margin: 25px 0;">
                <p style="margin: 8px 0; color: #065f46; font-weight: bold; font-size: 15px;">
                    🗓️ Fecha: <span style="font-weight: normal;">{{ $cita->fecha }}</span>
                </p>
                <p style="margin: 8px 0; color: #065f46; font-weight: bold; font-size: 15px;">
                    ⏰ Hora: <span style="font-weight: normal;">{{ $cita->hora }}</span>
                </p>
                <p style="margin: 8px 0; color: #065f46; font-weight: bold; font-size: 15px;">
                    ✂️ Servicio: <span style="font-weight: normal;">{{ $cita->servicio->nombre ?? 'Servicio' }}</span>
                </p>
                @if($cita->barbero)
                <p style="margin: 8px 0; color: #065f46; font-weight: bold; font-size: 15px;">
                    👤 Con: <span style="font-weight: normal;">{{ $cita->barbero->name }}</span>
                </p>
                @endif
            </div>

            <p style="font-size: 15px; line-height: 1.6; color: #475569;">
                <strong>Es para quien la tome primero.</strong> Avisamos a las primeras personas de la lista, así que si te sirve, reserva ahora.
            </p>

            <p style="margin: 30px 0 0;">
                <a href="{{ rtrim(config('app.frontend_url'), '/') }}/barberia/{{ $cita->barberia->slug }}"
                   style="display: inline-block; background-color: #10b981; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 15px;">
                    Ver horas disponibles
                </a>
            </p>
        </div>

        <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                Te llega este correo porque pediste que te avisáramos si se liberaba una hora.
            </p>
        </div>
    </div>
</body>
</html>
