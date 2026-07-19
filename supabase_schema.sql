-- =====================================================
-- SERE TURISMO — Schema Supabase
-- Ejecutar en: Supabase → SQL Editor → New query
-- =====================================================

-- Actividades (temporada de invierno / excursiones individuales)
CREATE TABLE actividades (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT now(),
  fecha       DATE NOT NULL,
  actividad   TEXT NOT NULL,
  nombre      TEXT NOT NULL,          -- nombre del cliente
  hotel       TEXT,
  telefono    TEXT,
  pax_mayor   INT DEFAULT 0,
  pax_menor   INT DEFAULT 0,
  pax_infante INT DEFAULT 0,
  pax_jubilado INT DEFAULT 0,
  pax_total   INT DEFAULT 0,
  cobro       NUMERIC(12,2) DEFAULT 0,
  costo       NUMERIC(12,2) DEFAULT 0,
  ganancia    NUMERIC(12,2) DEFAULT 0,
  proveedor   TEXT,
  referido    TEXT,
  temporada   TEXT DEFAULT '2026'
);

-- Viajes grupales
CREATE TABLE viajes (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    TIMESTAMPTZ DEFAULT now(),
  nombre        TEXT NOT NULL,
  destino       TEXT NOT NULL,
  fecha_salida  DATE NOT NULL,
  fecha_regreso DATE,
  cupo_max      INT NOT NULL DEFAULT 20 CHECK (cupo_max >= 1),
  precio_base   NUMERIC(12,2) DEFAULT 0 CHECK (precio_base >= 0),
  proveedor     TEXT,
  estado        TEXT DEFAULT 'borrador'
                CHECK (estado IN ('borrador','confirmado','en_espera','cancelado')),
  temporada     TEXT DEFAULT '2026',
  notas         TEXT
);

-- Pasajeros
CREATE TABLE pasajeros (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at       TIMESTAMPTZ DEFAULT now(),
  nombre           TEXT NOT NULL,
  apellido         TEXT NOT NULL,
  dni              TEXT,
  telefono         TEXT,
  email            TEXT,
  fecha_nacimiento DATE,
  hotel_salida     TEXT,
  notas            TEXT
);

-- Relación viaje ↔ pasajero
CREATE TABLE viaje_pasajeros (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT now(),
  viaje_id    UUID REFERENCES viajes(id) ON DELETE CASCADE,
  pasajero_id UUID REFERENCES pasajeros(id) ON DELETE CASCADE,
  estado      TEXT DEFAULT 'confirmado'
              CHECK (estado IN ('confirmado','en_espera','cancelado')),
  UNIQUE(viaje_id, pasajero_id)
);

-- Pagos (ligados a viaje_pasajeros)
CREATE TABLE pagos (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at          TIMESTAMPTZ DEFAULT now(),
  viaje_pasajero_id   UUID REFERENCES viaje_pasajeros(id) ON DELETE CASCADE,
  monto               NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  tipo                TEXT CHECK (tipo IN ('seña','saldo','total')),
  metodo              TEXT CHECK (metodo IN ('efectivo','transferencia','mercado_pago','tarjeta','dolares')),
  fecha               DATE NOT NULL DEFAULT CURRENT_DATE,
  notas               TEXT,
  comprobante_path    TEXT
);

-- Vincula cada actividad individual con el pasajero que la hizo (ver migrar_pasajeros
-- en el historial del proyecto: se completa una vez con los datos ya migrados).
ALTER TABLE actividades ADD COLUMN pasajero_id UUID REFERENCES pasajeros(id);

-- ─── Índices ────────────────────────────────────────
CREATE INDEX idx_actividades_fecha      ON actividades(fecha);
CREATE INDEX idx_actividades_temporada  ON actividades(temporada);
CREATE INDEX idx_actividades_pasajero   ON actividades(pasajero_id);
CREATE INDEX idx_viajes_fecha_salida    ON viajes(fecha_salida);
CREATE INDEX idx_viaje_pasajeros_viaje  ON viaje_pasajeros(viaje_id);
CREATE INDEX idx_pagos_viaje_pasajero   ON pagos(viaje_pasajero_id);

-- ─── RLS (Row Level Security) ────────────────────────
-- Por ahora OFF para desarrollo. Activar antes de producción.
ALTER TABLE actividades     DISABLE ROW LEVEL SECURITY;
ALTER TABLE viajes          DISABLE ROW LEVEL SECURITY;
ALTER TABLE pasajeros       DISABLE ROW LEVEL SECURITY;
ALTER TABLE viaje_pasajeros DISABLE ROW LEVEL SECURITY;
ALTER TABLE pagos           DISABLE ROW LEVEL SECURITY;

-- ─── Vista útil: deuda por pasajero ─────────────────
-- security_invoker = true: la vista corre con los permisos de quien consulta,
-- no de quien la creó (si no, el linter de seguridad de Supabase la marca como
-- security_definer_view).
CREATE OR REPLACE VIEW deuda_pasajeros WITH (security_invoker = true) AS
SELECT
  vp.id AS viaje_pasajero_id,
  v.nombre AS viaje,
  v.fecha_salida,
  p.nombre || ' ' || p.apellido AS pasajero,
  p.telefono,
  v.precio_base,
  COALESCE(SUM(pa.monto), 0) AS pagado,
  v.precio_base - COALESCE(SUM(pa.monto), 0) AS debe
FROM viaje_pasajeros vp
JOIN viajes v ON v.id = vp.viaje_id
JOIN pasajeros p ON p.id = vp.pasajero_id
LEFT JOIN pagos pa ON pa.viaje_pasajero_id = vp.id
WHERE vp.estado = 'confirmado'
GROUP BY vp.id, v.nombre, v.fecha_salida, p.nombre, p.apellido, p.telefono, v.precio_base;

-- Las views no heredan los grants automáticos que sí tienen las tablas.
GRANT SELECT ON deuda_pasajeros TO anon, authenticated;

-- ─── Storage: comprobantes de pago ───────────────────
-- Crear a mano en el Dashboard (Storage → New bucket):
--   nombre: comprobantes · privado · límite 10MB · MIME: image/jpeg,image/png,image/webp,image/heic,application/pdf
-- Después correr:
-- create policy "comprobantes_insert" on storage.objects for insert to anon
--   with check (bucket_id = 'comprobantes');
-- create policy "comprobantes_select" on storage.objects for select to anon
--   using (bucket_id = 'comprobantes');
