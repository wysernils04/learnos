# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/learnos/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** LearnOS
**Style:** Glassmorphism
**Category:** University SaaS — spaced-repetition learning

---

## Global Rules

### Color Palette

| Role | Hex | Tailwind token |
|------|-----|----------------|
| Primary | `#0D9488` | `primary-600` |
| Secondary | `#14B8A6` | `primary-500` |
| CTA/Accent | `#F97316` | `cta` |
| Background | `#F0FDFA` | `background` / `primary-50` |
| Text | `#134E4A` | `foreground` / `primary-900` |
| Muted text | `#64748B` | `muted-foreground` |
| Border | `#E2E8F0` | `border` |

### Typography

- **Font:** Plus Jakarta Sans (weights 300–800)
- **Mood:** SaaS productivity, professional, friendly
- **Google Fonts:**

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
```

### Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | `4px` / `0.25rem` | Tight gaps |
| `sm` | `8px` / `0.5rem` | Icon gaps, inline |
| `md` | `16px` / `1rem` | Standard padding |
| `lg` | `24px` / `1.5rem` | Section padding |
| `xl` | `32px` / `2rem` | Large gaps |
| `2xl` | `48px` / `3rem` | Section margins |

### Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-glass` | `0 8px 32px rgba(13,148,136,0.12)` | Cards |
| `shadow-glass-lg` | `0 20px 60px rgba(13,148,136,0.15)` | Modals, hover |

---

## Component Specs

### Cards (Glassmorphism)

```css
.glass {
  background: rgba(255,255,255,0.80);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.50);
  box-shadow: 0 8px 32px rgba(13,148,136,0.12);
  border-radius: 1rem; /* rounded-2xl */
}
```

Tailwind shorthand: `bg-white/80 backdrop-blur-md border border-white/50 shadow-glass rounded-2xl`

### Buttons

```
Primary:     bg-primary-600 text-white hover:bg-primary-700  rounded-xl
CTA:         bg-cta text-white hover:bg-cta-hover            rounded-xl
Outline:     border border-primary-200 bg-white text-primary-700 hover:bg-primary-50
Ghost:       text-primary-700 hover:bg-primary-50
Destructive: bg-destructive text-white hover:bg-red-600
```

- Border radius: `rounded-xl` (0.75rem)
- Height: `h-10` default · `h-8` sm · `h-12` lg
- Font: `font-semibold text-sm`
- Transition: `transition-colors duration-200`

### Inputs

```
bg-white/80 backdrop-blur-sm border border-white/50 rounded-xl
focus:ring-2 focus:ring-ring focus:border-transparent
```

### Modals / Overlays

```
overlay: bg-black/50 backdrop-blur-sm
modal:   glass-lg rounded-2xl p-8 max-w-lg w-[90%]
```

---

## Style Guidelines

**Style:** Glassmorphism

**Keywords:** frosted glass, translucent, backdrop-blur, soft shadows, layered depth, teal palette, clean whitespace

**Key Effects:**
- `bg-white/80 backdrop-blur-md` on all cards
- Teal-tinted shadows (`rgba(13,148,136,...)`)
- Orange CTA for primary actions
- `150–300ms ease-out` transitions
- `animate-fade-in` on page entry (`opacity + translateY(8px)`)

**Border radii:**
- Cards, modals: `rounded-2xl` (1rem)
- Buttons, inputs, icon containers: `rounded-xl` (0.75rem)
- Small badges / tags: `rounded-lg` (0.5rem)

---

## Anti-Patterns (Do NOT Use)

- No Redux (Zustand only)
- No CSS-in-JS (Tailwind only)
- No emojis as icons — use Lucide SVG icons
- No layout-shifting hover transforms (scale/translate that shift neighbors)
- No low-contrast text — 4.5:1 minimum
- No instant state changes — always `transition-colors duration-150` or longer
- No invisible focus states

---

## Pre-Delivery Checklist

- [ ] No emojis as icons (Lucide SVG only)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150–300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible (`focus-visible:ring-2 ring-ring`)
- [ ] `prefers-reduced-motion` respected (set in `globals.css`)
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No horizontal scroll on mobile
- [ ] Glass cards use `bg-white/80` (not `bg-white/10` — too transparent)
