<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 20px;">

    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">

        <!-- Cabecera -->
        <div style="background-color: #03070e; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 2px;">
                TENRI <span style="color: #10b981;">BARBER</span>
            </h1>
        </div>

        <!-- Contenido -->
        <div style="padding: 40px 30px;">
            <p style="font-size: 16px; line-height: 1.6; color: #475569; margin-top: 0;">
                Hola, <strong style="color: #0f172a;">{{ $cita->cliente->name }}</strong>.
            </p>
            <p style="font-size: 16px; line-height: 1.6; color: #475569;">
                Gracias por tu visita a <strong style="color: #0f172a;">{{ $cita->barberia->nombre ?? 'nuestra tienda' }}</strong>.
                Tu opinión ayuda a otros clientes a elegir con confianza — ¿nos cuentas cómo te fue?
            </p>

            <div style="background-color: #f1f5f9; border-left: 4px solid #10b981; padding: 20px; border-radius: 4px; margin: 25px 0;">
                <p style="margin: 8px 0; color: #0f172a; font-weight: bold; font-size: 15px;">
                    ✂️ Servicio: <span style="font-weight: normal; color: #475569;">{{ $cita->servicio->nombre ?? '—' }}</span>
                </p>
                <p style="margin: 8px 0; color: #0f172a; font-weight: bold; font-size: 15px;">
                    💈 Barbero: <span style="font-weight: normal; color: #475569;">{{ $cita->barbero->name ?? '—' }}</span>
                </p>
                <p style="margin: 8px 0; color: #0f172a; font-weight: bold; font-size: 15px;">
                    🗓️ Fecha: <span style="font-weight: normal; color: #475569;">{{ $cita->fecha }} a las {{ substr($cita->hora, 0, 5) }}</span>
                </p>
            </div>

            <div style="text-align: center; margin-top: 35px; padding-top: 25px; border-top: 1px dashed #cbd5e1;">
                <p style="font-size: 14px; color: #64748b; margin-bottom: 15px;">Toma menos de un minuto:</p>
                <a href="{{ config('app.frontend_url', 'http://localhost:5173') }}/mis-reservas" style="background-color: #10b981; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 14px;">
                    Calificar mi visita
                </a>
            </div>
        </div>

        <!-- Pie de página -->
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                © {{ date('Y') }} TENRI Barber. Todos los derechos reservados.
            </p>
        </div>

    </div>
</body>
</html>
