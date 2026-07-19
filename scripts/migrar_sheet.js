// =====================================================
// Script de migración: Google Sheet → Supabase
// Uso: node migrar_sheet.js
// =====================================================

const SHEET_ID   = '1HtAEYJryJ34gfh9GpTYu_ux0gGmaajDy-x3R_lzoXV0'
const GID        = '0' // pestaña principal (gid=0)

// ⚠️ Completar con tus datos de Supabase
const SUPABASE_URL      = 'https://nggihdbsdaducfhrmakj.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nZ2loZGJzZGFkdWNmaHJtYWtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzODQwOTAsImV4cCI6MjA5OTk2MDA5MH0.4HaCloX7QUIxkXPu9SlqUSR8H6IaIGdk-vGuINurjfY'

// ─── Helpers ─────────────────────────────────────────

function normalizeDate(raw) {
  if (!raw) return null
  const s = raw.trim()
  const parts = s.split('/')
  if (parts.length === 3) {
    const [d, m, y] = parts
    const year = y.length === 2 ? `20${y}` : y
    return `${year}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return null
}

function parseNum(raw) {
  if (!raw) return 0
  const n = parseFloat(String(raw).replace(/[$,\s]/g, ''))
  return isNaN(n) ? 0 : n
}

function parseIdx(headers, ...candidates) {
  for (const c of candidates) {
    const idx = headers.findIndex(h => h.trim().toLowerCase() === c.toLowerCase())
    if (idx !== -1) return idx
  }
  return -1
}

// Parser CSV simple (maneja comillas y comas dentro de campos)
function parseCSV(text) {
  const rows = []
  const lines = text.split('\n')
  for (const line of lines) {
    if (!line.trim()) continue
    const cols = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { cols.push(cur); cur = '' }
      else cur += ch
    }
    cols.push(cur)
    rows.push(cols)
  }
  return rows
}

// ─── Main ────────────────────────────────────────────

async function main() {
  console.log('📥 Leyendo Google Sheet via CSV...')

  const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`
  const res = await fetch(csvUrl)

  if (!res.ok) {
    console.error('❌ No se pudo leer el Sheet. ¿Está compartido como público?')
    process.exit(1)
  }

  const text = await res.text()
  const rows = parseCSV(text)

  if (rows.length < 2) {
    console.error('❌ El Sheet está vacío o no tiene datos.')
    process.exit(1)
  }

  const [headerRow, ...dataRows] = rows
  const h = headerRow.map(x => x.trim())
  console.log('📋 Headers detectados:', h.join(' | '))

  const idx = {
    fecha:     parseIdx(h, 'FECHA ACT', 'FECHA'),
    actividad: parseIdx(h, 'ACTIVIDAD'),
    nombre:    parseIdx(h, 'NOMBRE'),
    hotel:     parseIdx(h, 'HOTEL', 'HOTEL '),
    telefono:  parseIdx(h, 'TELÉFONO', 'TELEFONO', 'TEL'),
    paxMayor:  parseIdx(h, 'MAYOR'),
    paxMen:    parseIdx(h, 'men', 'MEN', 'MENORES'),
    paxInf:    parseIdx(h, 'inf', 'INF', 'INFANTES'),
    paxJub:    parseIdx(h, 'jub', 'JUB', 'JUBILADOS'),
    paxTotal:  parseIdx(h, 'TOTAL'),
    cobro:     parseIdx(h, 'COBRO CL', 'COBRO'),
    costo:     parseIdx(h, 'COSTO'),
    ganancia:  parseIdx(h, 'GANANCIA B', 'GANANCIA'),
    proveedor: parseIdx(h, 'PROVEEDOR'),
    referido:  parseIdx(h, 'REFERIDO'),
  }

  console.log('🗂️  Columnas mapeadas:', Object.entries(idx)
    .filter(([,v]) => v !== -1)
    .map(([k,v]) => `${k}→${v}`)
    .join(', '))

  const g = (row, i) => (i !== -1 && i < row.length) ? row[i].trim() : ''

  const actividades = []
  for (const row of dataRows) {
    const fecha     = normalizeDate(g(row, idx.fecha))
    const actividad = g(row, idx.actividad)
    const nombre    = g(row, idx.nombre)
    if (!fecha || !actividad || !nombre) continue

    const paxMayor = parseInt(g(row, idx.paxMayor)) || 0
    const paxMen   = parseInt(g(row, idx.paxMen))   || 0
    const paxInf   = parseInt(g(row, idx.paxInf))   || 0
    const paxJub   = parseInt(g(row, idx.paxJub))   || 0
    const paxTotal = parseInt(g(row, idx.paxTotal))  || (paxMayor + paxMen + paxInf + paxJub)
    const cobro    = parseNum(g(row, idx.cobro))
    const costo    = parseNum(g(row, idx.costo))
    const ganancia = parseNum(g(row, idx.ganancia)) || (cobro - costo)

    actividades.push({
      fecha, actividad, nombre,
      hotel:        g(row, idx.hotel)     || null,
      telefono:     g(row, idx.telefono)  || null,
      pax_mayor:    paxMayor,
      pax_menor:    paxMen,
      pax_infante:  paxInf,
      pax_jubilado: paxJub,
      pax_total:    paxTotal,
      cobro, costo, ganancia,
      proveedor:    g(row, idx.proveedor) || null,
      referido:     g(row, idx.referido)  || null,
      temporada:    '2026',
    })
  }

  console.log(`✅ ${actividades.length} actividades parseadas`)

  if (actividades.length === 0) {
    console.log('⚠️  No hay filas válidas para importar. Revisá que el Sheet tenga datos.')
    process.exit(0)
  }

  // Insertar en Supabase en batches de 50
  console.log('📤 Insertando en Supabase...')
  const BATCH = 50
  let inserted = 0

  for (let i = 0; i < actividades.length; i += BATCH) {
    const batch = actividades.slice(i, i + BATCH)
    const r = await fetch(`${SUPABASE_URL}/rest/v1/actividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(batch),
    })

    if (!r.ok) {
      const err = await r.text()
      console.error(`❌ Error insertando batch:`, err)
      process.exit(1)
    }

    inserted += batch.length
    console.log(`   ${inserted}/${actividades.length} insertadas...`)
  }

  console.log(`\n🎉 Migración completa. ${inserted} actividades importadas a Supabase.`)
}

main().catch(err => { console.error('❌ Error inesperado:', err.message); process.exit(1) })
