# Adonde y Que — Sistema de gestión

App web mobile-first para gestionar actividades turísticas, viajes grupales, pasajeros y cobros.

**Stack:** Next.js 15 · TypeScript · Tailwind CSS · shadcn/ui · Supabase · Vercel

---

## Setup inicial

### 1. Clonar e instalar
```bash
git clone https://github.com/TU_USUARIO/TU_REPO.git
cd adonde-y-que
npm install
```

### 2. Variables de entorno
Copiá `.env.example` a `.env.local` y completá con tus datos de Supabase:
```bash
cp .env.example .env.local
```
```
NEXT_PUBLIC_SUPABASE_URL=https://XXXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```
Encontrás estos valores en: **Supabase → Settings → API**

### 3. Crear las tablas en Supabase
Entrá a **Supabase → SQL Editor → New query**, pegá el contenido de `supabase_schema.sql` y ejecutá.

### 4. Correr en local
```bash
npm run dev
```
Abre http://localhost:3000

---

## Deploy en Vercel

1. Push al repo de GitHub
2. Entrá a vercel.com → New Project → importá el repo
3. Agregá las mismas variables de entorno en Vercel → Settings → Environment Variables
4. Deploy automático en cada push a `main`

---

## Módulos actuales

| Módulo | Estado |
|--------|--------|
| Calendario de actividades | ✅ Fase 1 |
| Dashboard financiero | ✅ Fase 1 |
| Viajes grupales | ✅ Fase 2 |
| Cobros y cashflow | ✅ Fase 2 |
| Fichas de pasajero | 🔜 Fase 3 |
| Exportación PDF | 🔜 Fase 3 |
| Facturación | 🔜 Fase 4 |

---

## Estructura del proyecto

```
app/
  (app)/
    calendario/    → Vista de actividades día por día
    dashboard/     → KPIs y gráficos financieros
    grupos/        → Viajes grupales (Fase 2)
    cobros/        → Pagos y deudas (Fase 2)
lib/
  supabase.ts     → Cliente y tipos
  utils.ts        → Helpers (formatCurrency, formatDate, etc.)
components/
  ui/             → Componentes shadcn/ui
supabase_schema.sql → Schema completo de la base de datos
```
