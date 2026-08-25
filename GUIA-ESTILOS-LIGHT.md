# Guía de Estilos — Rediseño Visual Light Mode (UI Facelift)

> **Alcance:** capa visual únicamente. No cambia funcionalidad, flujo de usuario ni lógica de botones.
> Todo es aplicable con clases Tailwind o variables CSS globales sobre la estructura existente.

---

## 1. Guía de color ligera y limpia

### Tokens base

| Rol | HEX | Uso |
|---|---|---|
| Fondo principal (canvas) | `#F7F6F3` | Fondo de toda la app (hueso cálido, no gris frío) |
| Fondo alternativo | `#FBFBFA` | Sidebar, headers de tabla, zonas secundarias |
| Tarjetas / contenedores | `#FFFFFF` | Blanco puro sobre el canvas cálido |
| Borde estructural | `#EAEAEA` | Único grosor: `1px solid`. Nunca más oscuro |
| Borde sutil (divisores internos) | `rgba(0,0,0,0.06)` | Separadores dentro de tarjetas |

### Escala de grises para texto

| Rol | HEX | Notas |
|---|---|---|
| Títulos (H1–H3) | `#111111` | Nunca negro absoluto `#000000` |
| Cuerpo | `#2F3437` | Con `line-height: 1.6` |
| Subtítulos / secundario | `#787774` | Labels, metadatos, descripciones |
| Terciario / deshabilitado | `#A8A29E` | Placeholders, hints |

### Variables CSS globales (pegar en `index.css`)

```css
:root {
  --bg:            #F7F6F3;
  --bg-alt:        #FBFBFA;
  --surface:       #FFFFFF;
  --border:        #EAEAEA;
  --border-soft:   rgba(0, 0, 0, 0.06);
  --text-title:    #111111;
  --text-body:     #2F3437;
  --text-muted:    #787774;
  --text-faint:    #A8A29E;
}
```

Equivalencias Tailwind (clases arbitrarias, sin tocar config):
`bg-[#F7F6F3]`, `bg-white`, `border-[#EAEAEA]`, `text-[#111111]`, `text-[#2F3437]`, `text-[#787774]`.

**Regla de sombras:** prácticamente inexistentes. Máximo permitido:
`shadow-[0_2px_8px_rgba(0,0,0,0.04)]` y solo en hover. Prohibido `shadow-md`/`shadow-lg`/`shadow-xl`.

---

## 2. Sistema de colores semánticos (estados de reserva)

Pasteles lavados: legibles sobre blanco, jamás chillones. El color aparece **solo** en badges,
barras de acento y highlights puntuales — nunca en superficies grandes.

| Estado | Fondo | Texto | Borde |
|---|---|---|---|
| **Pendiente** | `#FBF3DB` | `#956400` | `#F2E3B3` |
| **Confirmada** | `#E1F3FE` | `#1F6C9F` | `#C6E6FB` |
| **Finalizada** | `#EDF3EC` | `#346538` | `#D3E5D2` |
| **Cancelada** | `#FDEBEC` | `#9F2F2D` | `#F7D4D6` |

### Badge de estado (clase de referencia)

```html
<span class="px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-[0.05em]
             bg-[#FBF3DB] text-[#956400] border border-[#F2E3B3]">
  Pendiente
</span>
```

### Reglas de propósito

- **Un solo color semántico por fila/tarjeta.** Si la cita está cancelada, nada más compite en color.
- Amarillo pastel = requiere acción; azul pastel = en curso/OK; verde pastel = cerrado bien; rojo pastel = cerrado mal.
- El acento de marca (emerald actual) queda reservado a **acciones primarias** (botones, links activos), nunca a estados.
- Texto del badge siempre con el par exacto de la tabla — no mezclar texto de un estado con fondo de otro.

---

## 3. Estilización del calendario existente

Sin alterar la cuadrícula. Solo se re-visten los bloques de reserva y el lienzo:

### Lienzo de la cuadrícula
- Líneas de la grilla: `rgba(0,0,0,0.04)` — apenas visibles, la grilla se intuye, no se dibuja.
- Columna/celda de **hoy**: fondo `#FBFAF8` (un paso más cálido que el canvas). Nada de bordes gruesos.
- Etiquetas de hora del eje: `11px`, `#A8A29E`, fuente mono tabular.

### Bloques de reserva

```html
<div class="bg-white border border-[#EAEAEA] rounded-lg pl-3 pr-2.5 py-2
            border-l-[3px] border-l-[#1F6C9F]
            hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-shadow duration-200">
  <p class="font-mono text-[13px] font-semibold text-[#111111] tabular-nums">10:30</p>
  <p class="text-[13px] font-medium text-[#2F3437] truncate">Nombre Cliente</p>
  <p class="text-[12px] text-[#787774] truncate">Servicio · 45 min</p>
</div>
```

- **Radius:** `8px` (`rounded-lg`). Máximo absoluto `12px`. Nunca pills en contenedores.
- **Borde:** `1px #EAEAEA` en todo el contorno + **barra de acento izquierda de 3px** con el color de
  texto del estado (`#956400` pendiente, `#1F6C9F` confirmada, `#346538` finalizada, `#9F2F2D` cancelada).
  La barra comunica estado sin pintar el bloque entero.
- **Fondo del bloque:** blanco siempre. Variante permitida para pendientes: fondo `#FBF3DB` al 40 %
  (`bg-[#FBF3DB]/40`) si se necesita urgencia visual, nunca al 100 %.
- **Canceladas:** opacidad 60 % + nombre con `line-through`. Se ven, no gritan.
- **Densidad interna:** padding `8–10px`; hora arriba en mono semibold, cliente debajo, servicio en muted.
- **Hover:** solo la sombra difusa de la regla global + `cursor-pointer`. Sin escalados ni bordes que aparecen.

---

## 4. Tratamiento de tablas y densidad de datos

Objetivo: más blanco percibido con la misma información. La receta:

| Propiedad | Valor |
|---|---|
| Bordes verticales | **Ninguno.** Solo separadores horizontales |
| Separador de filas | `1px solid rgba(0,0,0,0.05)` |
| Header | fondo `#FBFBFA`, `border-bottom: 1px solid #EAEAEA` |
| Tipografía header | `11px`, uppercase, `tracking-[0.05em]`, `#787774`, weight 600 |
| Padding de celda | `px-4 py-3.5` (16 px / 14 px) — el aire vive en el padding, no en menos filas |
| Hover de fila | fondo `#F7F6F3`, `transition-colors duration-150` |
| Zebra striping | **No.** El hover reemplaza a la zebra; zebra + hover ensucia |
| Columnas numéricas (precios, horas) | alineadas a la derecha + `tabular-nums` |
| Primera columna (identidad: cliente/fecha) | weight 600, `#111111`; el resto weight 400–500 |

```html
<table class="w-full text-sm text-left">
  <thead class="bg-[#FBFBFA] border-b border-[#EAEAEA]">
    <tr class="text-[11px] uppercase tracking-[0.05em] text-[#787774] font-semibold">
      <th class="px-4 py-3.5">Cliente</th>
      <th class="px-4 py-3.5 text-right">Total</th>
    </tr>
  </thead>
  <tbody class="divide-y divide-black/5">
    <tr class="hover:bg-[#F7F6F3] transition-colors duration-150">
      <td class="px-4 py-3.5 font-semibold text-[#111111]">…</td>
      <td class="px-4 py-3.5 text-right tabular-nums text-[#2F3437]">…</td>
    </tr>
  </tbody>
</table>
```

- Contenedor de la tabla: tarjeta blanca, `border 1px #EAEAEA`, `rounded-xl` (12 px), `overflow-hidden`.
- Acciones por fila (editar/cancelar): iconos o links visibles solo con weight/color, sin botones sólidos dentro de tablas.
- Reportes largos: header sticky (`sticky top-0`) con el mismo fondo `#FBFBFA` — gratis con Tailwind, sin JS.

---

## 5. Recomendación tipográfica (Google Fonts)

### Familias

| Rol | Fuente | Fallback |
|---|---|---|
| UI + cuerpo | **Plus Jakarta Sans** | `system-ui, sans-serif` |
| Números, horas, precios | **JetBrains Mono** | `ui-monospace, monospace` |

```html
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
```

```css
body      { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; color: var(--text-body); }
.num      { font-family: 'JetBrains Mono', ui-monospace, monospace;
            font-variant-numeric: tabular-nums; }
```

Por qué: Plus Jakarta Sans tiene formas geométricas limpias con dígitos anchos y abiertos (mejor que
Inter/Roboto para escaneo rápido); JetBrains Mono con `tabular-nums` hace que columnas de horas y
precios queden **perfectamente alineadas en vertical** — clave para quien pasa horas leyendo agenda.

### Pesos y jerarquía (sin cambiar textos)

| Nivel | Tamaño | Weight | Extra |
|---|---|---|---|
| H1 (título de página) | 24–30 px | 700 | `letter-spacing: -0.02em` |
| H2 (sección/tarjeta) | 18–20 px | 600 | `letter-spacing: -0.01em` |
| Subtítulo / label | 11–12 px | 600 | uppercase + `tracking 0.05em`, color `#787774` |
| Cuerpo | 14 px | 400 | `line-height 1.6` |
| Dato destacado (hora, precio) | 14–16 px | 600 | mono + `tabular-nums` |
| Cifra grande (KPI finanzas) | 30–36 px | 700 | mono + `tabular-nums`, `letter-spacing -0.02em` |

Reglas: máximo **4 weights** en toda la app (400/500/600/700). La jerarquía nace del peso y el
espaciado, no del tamaño: dos niveles contiguos pueden compartir tamaño si difieren en weight y color.

---

## Mapa de migración rápida (clases actuales → nuevas)

| Hoy (dark/mixto) | Facelift light |
|---|---|
| `bg-[#0B1221]`, `dark:bg-*` en superficie | `bg-white border border-[#EAEAEA]` |
| `bg-slate-50` como canvas | `bg-[#F7F6F3]` |
| `text-slate-900` títulos | `text-[#111111]` |
| `text-slate-500` secundario | `text-[#787774]` |
| `shadow-sm hover:shadow-md` | sin sombra base, `hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]` |
| Badges con colores saturados (`bg-amber-100 text-amber-700`) | pares pastel de la sección 2 |
| `rounded-2xl`/`rounded-3xl` en tarjetas | `rounded-xl` (12 px) máximo |
| `font-black` / `font-extrabold` | tope en `font-bold` (700) |

**Criterio de cierre:** si al quitar un borde, una sombra o un color la pantalla sigue leyéndose igual
de bien, quitarlo. El descanso visual del operador es la métrica.
