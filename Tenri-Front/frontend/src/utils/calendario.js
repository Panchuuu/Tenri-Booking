// ============================================================
// 📅 Utilidades "Agregar al calendario"
// ============================================================
// Construyen el evento a partir de una cita (fecha "YYYY-MM-DD",
// hora "HH:MM[:SS]", servicio con duración y barbería opcional).
// Sin dependencias: la URL de Google es un simple querystring y
// el .ics se genera como Blob descargable.
// ============================================================

function partesCita(cita) {
  const duracion =
    Number(cita.servicio?.duracion ?? cita.servicio?.duracion_minutos) || 30;

  const inicio = new Date(`${cita.fecha}T${(cita.hora || "00:00").substring(0, 5)}:00`);
  const fin = new Date(inicio.getTime() + duracion * 60000);

  const barberia = cita.servicio?.barberia || cita.barberia || null;

  return {
    inicio,
    fin,
    titulo: `${cita.servicio?.nombre || "Cita"} — ${barberia?.nombre || "TENRI Barber"}`,
    descripcion: [
      cita.servicio?.nombre && `Servicio: ${cita.servicio.nombre}`,
      cita.barbero?.name && `Barbero: ${cita.barbero.name}`,
      "Reservado vía TENRI Barber",
    ].filter(Boolean).join("\\n"),
    ubicacion: barberia?.direccion || barberia?.nombre || "",
  };
}

// Formato compacto UTC que piden Google y el estándar iCalendar: 20260824T153000Z
function aFormatoCalendario(fecha) {
  return fecha.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function urlGoogleCalendar(cita) {
  const { inicio, fin, titulo, descripcion, ubicacion } = partesCita(cita);
  if (Number.isNaN(inicio.getTime())) return null;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: titulo,
    dates: `${aFormatoCalendario(inicio)}/${aFormatoCalendario(fin)}`,
    details: descripcion.replace(/\\n/g, "\n"),
    location: ubicacion,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function descargarIcs(cita) {
  const { inicio, fin, titulo, descripcion, ubicacion } = partesCita(cita);
  if (Number.isNaN(inicio.getTime())) return;

  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TENRI Barber//Reservas//ES",
    "BEGIN:VEVENT",
    `UID:cita-${cita.id}@tenri.cl`,
    `DTSTAMP:${aFormatoCalendario(new Date())}`,
    `DTSTART:${aFormatoCalendario(inicio)}`,
    `DTEND:${aFormatoCalendario(fin)}`,
    `SUMMARY:${titulo}`,
    `DESCRIPTION:${descripcion}`,
    ubicacion && `LOCATION:${ubicacion}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  const blob = new Blob([lineas.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `cita-tenri-${cita.fecha}.ics`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}
