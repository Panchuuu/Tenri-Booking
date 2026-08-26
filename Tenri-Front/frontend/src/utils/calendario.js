// ============================================================
// 📅 Utilidades "Agregar al calendario"
// ============================================================
// Construyen el evento a partir de una cita (fecha "YYYY-MM-DD",
// hora "HH:MM[:SS]", servicio con duración y barbería opcional).
// Sin dependencias: la URL de Google es un simple querystring y
// el .ics se genera como Blob descargable.
//
// Las citas son hora de Chile: se exportan como hora "de pared"
// con TZID/ctz explícito, así el evento queda correcto aunque el
// navegador del usuario esté en otro timezone.
// ============================================================

const TZID = "America/Santiago";

function partesCita(cita) {
  const duracion =
    Number(cita.servicio?.duracion ?? cita.servicio?.duracion_minutos) || 30;

  const [anio, mes, dia] = (cita.fecha || "").split("-").map(Number);
  const [hh, mm] = (cita.hora || "").substring(0, 5).split(":").map(Number);
  if (![anio, mes, dia, hh, mm].every(Number.isFinite)) return null;

  // Aritmética de reloj de pared (Date local solo para sumar minutos;
  // se vuelve a leer con getters locales, así el TZ del navegador no
  // altera el resultado).
  const inicio = new Date(anio, mes - 1, dia, hh, mm);
  const fin = new Date(inicio.getTime() + duracion * 60000);
  if (Number.isNaN(inicio.getTime())) return null;

  const barberia = cita.servicio?.barberia || cita.barberia || null;

  return {
    inicio,
    fin,
    titulo: `${cita.servicio?.nombre || "Cita"} — ${barberia?.nombre || "TENRI Barber"}`,
    descripcion: [
      cita.servicio?.nombre && `Servicio: ${cita.servicio.nombre}`,
      cita.barbero?.name && `Barbero: ${cita.barbero.name}`,
      "Reservado vía TENRI Barber",
    ].filter(Boolean).join("\n"),
    ubicacion: barberia?.direccion || barberia?.nombre || "",
  };
}

// Hora de pared en formato compacto iCalendar/Google: 20260824T153000
function aWallClock(fecha) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${fecha.getFullYear()}${p(fecha.getMonth() + 1)}${p(fecha.getDate())}` +
    `T${p(fecha.getHours())}${p(fecha.getMinutes())}00`
  );
}

// RFC 5545 §3.3.11: en valores de texto, "\" "," ";" y los saltos de
// línea deben escaparse (una dirección con comas rompía LOCATION en
// parsers estrictos).
function escaparIcs(texto) {
  return String(texto)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function urlGoogleCalendar(cita) {
  const partes = partesCita(cita);
  if (!partes) return null;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: partes.titulo,
    // Fechas "flotantes" + ctz: Google las interpreta en el TZ de la cita,
    // no en el del navegador.
    dates: `${aWallClock(partes.inicio)}/${aWallClock(partes.fin)}`,
    ctz: TZID,
    details: partes.descripcion,
    location: partes.ubicacion,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function descargarIcs(cita) {
  const partes = partesCita(cita);
  if (!partes) return;

  // DTSTAMP sí va en UTC (lo exige el estándar); DTSTART/DTEND van como
  // hora de pared con TZID.
  const dtstamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TENRI Barber//Reservas//ES",
    "BEGIN:VEVENT",
    `UID:cita-${cita.id}@tenri.cl`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=${TZID}:${aWallClock(partes.inicio)}`,
    `DTEND;TZID=${TZID}:${aWallClock(partes.fin)}`,
    `SUMMARY:${escaparIcs(partes.titulo)}`,
    `DESCRIPTION:${escaparIcs(partes.descripcion)}`,
    partes.ubicacion && `LOCATION:${escaparIcs(partes.ubicacion)}`,
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
