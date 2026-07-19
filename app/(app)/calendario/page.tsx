'use client'
import { useEffect, useMemo, useState, useRef } from 'react'
import { supabase, type Actividad } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Search, Phone, MapPin, Users, TrendingUp, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import BottomSheet from '@/components/BottomSheet'
import { cn } from '@/lib/utils'

const DAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function addDays(s: string, n: number): string {
  const d = new Date(s + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
function getMonday(s: string): string {
  const d = new Date(s + 'T00:00:00')
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d.toISOString().slice(0, 10)
}
function addMonths(s: string, n: number): string {
  const [y, m] = s.slice(0, 7).split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function daysInMonth(mesInicio: string): number {
  const [y, m] = mesInicio.slice(0, 7).split('-').map(Number)
  return new Date(y, m, 0).getDate()
}
function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

type Vista = 'semana' | 'mes'

export default function CalendarioPage() {
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [diaIdx, setDiaIdx] = useState(0)
  const [modalAct, setModalAct] = useState<Actividad | null>(null)
  const [vista, setVista] = useState<Vista>('semana')
  const [fechaRef, setFechaRef] = useState(hoyISO())
  const touchStartX = useRef(0)
  const initialized = useRef(false)

  async function cargar() {
    const { data } = await supabase
      .from('actividades')
      .select('*')
      .order('fecha', { ascending: true })
    if (data) {
      setActividades(data)
      if (!initialized.current) {
        initialized.current = true
        const fechas = [...new Set(data.map(a => a.fecha))].sort()
        if (fechas.length) {
          const hoy = hoyISO()
          let idx = fechas.findIndex(f => f >= hoy)
          if (idx < 0) idx = fechas.length - 1
          setDiaIdx(idx)
          setFechaRef(fechas[idx])
        }
      }
    }
  }

  async function refrescar() {
    setLoading(true)
    await cargar()
    setLoading(false)
  }

  useEffect(() => {
    (async () => { await cargar(); setLoading(false) })()
  }, [])

  const filtradas = useMemo(() => {
    if (!search) return actividades
    const q = search.toLowerCase()
    return actividades.filter(a => a.actividad.toLowerCase().includes(q) || a.nombre.toLowerCase().includes(q))
  }, [actividades, search])

  // Agrupar por día
  const diasConActs = useMemo(() => {
    const map: Record<string, Actividad[]> = {}
    filtradas.forEach(a => {
      if (!map[a.fecha]) map[a.fecha] = []
      map[a.fecha].push(a)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [filtradas])

  const porFecha = useMemo(() => Object.fromEntries(diasConActs), [diasConActs])

  // Rango de la semana en vista
  const lunesSemana = useMemo(() => getMonday(fechaRef), [fechaRef])
  const semanaDias = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(lunesSemana, i)), [lunesSemana])

  // Rango del mes en vista (días reales + grilla con relleno de semanas completas)
  const mesInicio = useMemo(() => fechaRef.slice(0, 7) + '-01', [fechaRef])
  const mesDiasReales = useMemo(() => {
    const dim = daysInMonth(mesInicio)
    return Array.from({ length: dim }, (_, i) => `${mesInicio.slice(0, 8)}${String(i + 1).padStart(2, '0')}`)
  }, [mesInicio])
  const mesGrid = useMemo(() => {
    const ultimoDia = mesDiasReales[mesDiasReales.length - 1]
    const inicioGrid = getMonday(mesInicio)
    const dowUltimo = new Date(ultimoDia + 'T00:00:00').getDay()
    const finGrid = addDays(ultimoDia, dowUltimo === 0 ? 0 : 7 - dowUltimo)
    const dias: string[] = []
    let cur = inicioGrid
    while (cur <= finGrid) { dias.push(cur); cur = addDays(cur, 1) }
    const semanas: string[][] = []
    for (let i = 0; i < dias.length; i += 7) semanas.push(dias.slice(i, i + 7))
    return semanas
  }, [mesInicio, mesDiasReales])

  const diasVista = vista === 'semana' ? semanaDias : mesDiasReales
  const actividadesVista = useMemo(() => diasVista.flatMap(f => porFecha[f] || []), [diasVista, porFecha])
  const totalCobrado = actividadesVista.reduce((s, a) => s + a.cobro, 0)
  const totalGanancia = actividadesVista.reduce((s, a) => s + a.ganancia, 0)

  const diaActual = diasConActs[diaIdx]
  const hoy = hoyISO()

  const labelRango = useMemo(() => {
    if (vista === 'mes') {
      return new Date(mesInicio + 'T12:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    }
    const ini = new Date(lunesSemana + 'T12:00:00')
    const fin = new Date(addDays(lunesSemana, 6) + 'T12:00:00')
    const mismoMes = ini.getMonth() === fin.getMonth()
    const iniLabel = ini.toLocaleDateString('es-AR', { day: 'numeric', month: mismoMes ? undefined : 'short' })
    const finLabel = fin.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
    return `${iniLabel} – ${finLabel}`
  }, [vista, mesInicio, lunesSemana])

  function irAnterior() {
    setFechaRef(prev => vista === 'semana' ? addDays(prev, -7) : addMonths(prev, -1))
  }
  function irSiguiente() {
    setFechaRef(prev => vista === 'semana' ? addDays(prev, 7) : addMonths(prev, 1))
  }
  function irAHoyDesktop() {
    setFechaRef(hoy)
  }
  function seleccionarDia(fecha: string) {
    setFechaRef(fecha)
    setVista('semana')
  }

  function irAHoy() {
    let idx = diasConActs.findIndex(([f]) => f >= hoy)
    if (idx < 0) idx = diasConActs.length - 1
    if (idx >= 0) setDiaIdx(idx)
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 60) {
      if (dx < 0) setDiaIdx(i => Math.min(diasConActs.length - 1, i + 1))
      else setDiaIdx(i => Math.max(0, i - 1))
    }
  }

  function abrirWA(tel: string | null) {
    if (!tel) return
    const num = tel.replace(/\D/g, '')
    window.open(`https://wa.me/${num}`, '_blank', 'noopener,noreferrer')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <RefreshCw size={24} className="animate-spin mr-2" /> Cargando...
    </div>
  )

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-[#18181A]">Calendario</h1>
        <button onClick={refrescar} className="p-2 rounded-lg bg-white border border-[#E2DFD8] text-gray-500">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-white rounded-xl p-3 border border-[#E2DFD8]">
          <div className="text-xs text-gray-400 mb-1">Actividades</div>
          <div className="text-lg font-semibold">{actividadesVista.length}</div>
        </div>
        <div className="bg-white rounded-xl p-3 border border-[#E2DFD8]">
          <div className="text-xs text-gray-400 mb-1">Cobrado</div>
          <div className="text-sm font-semibold text-amber-600">{formatCurrency(totalCobrado)}</div>
        </div>
        <div className="bg-white rounded-xl p-3 border border-[#E2DFD8]">
          <div className="text-xs text-gray-400 mb-1">Ganancia</div>
          <div className="text-sm font-semibold text-green-600">{formatCurrency(totalGanancia)}</div>
        </div>
      </div>

      {/* Buscador + toggle semana/mes (desktop) */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar actividad o cliente..."
            className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-[#E2DFD8] rounded-xl outline-none focus:border-amber-400"
          />
        </div>
        <div className="hidden sm:flex bg-white border border-[#E2DFD8] rounded-xl p-1 gap-1">
          {(['semana', 'mes'] as Vista[]).map(v => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors',
                vista === v ? 'bg-primary text-primary-foreground' : 'text-gray-500 hover:bg-[#F0EEE9]'
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* ══ Vista de escritorio ══ */}
      <div className="hidden sm:block">
        {/* Nav de rango */}
        <div className="flex items-center justify-between mb-3 bg-white rounded-xl border border-[#E2DFD8] px-4 py-2.5">
          <button onClick={irAnterior} className="p-2 rounded-lg text-gray-500 hover:bg-[#F0EEE9]">
            <ChevronLeft size={18} />
          </button>
          <div className="text-base font-semibold text-[#18181A] capitalize">{labelRango}</div>
          <div className="flex items-center gap-2">
            <button onClick={irAHoyDesktop} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold">
              Hoy
            </button>
            <button onClick={irSiguiente} className="p-2 rounded-lg text-gray-500 hover:bg-[#F0EEE9]">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {vista === 'semana' ? (
          <div className="grid grid-cols-7 gap-2">
            {semanaDias.map((fecha, i) => {
              const acts = porFecha[fecha] || []
              const esHoy = fecha === hoy
              return (
                <div
                  key={fecha}
                  className={cn(
                    'rounded-xl border p-2 flex flex-col gap-2 min-h-[420px]',
                    esHoy ? 'border-primary bg-accent/40' : 'border-[#E2DFD8] bg-white'
                  )}
                >
                  <div className="text-center pb-1 border-b border-[#E2DFD8]/60">
                    <div className="text-[10px] text-gray-400 uppercase tracking-wide">{DAYS_SHORT[i]}</div>
                    <div className={cn('text-lg font-bold', esHoy ? 'text-accent-foreground' : 'text-[#18181A]')}>
                      {Number(fecha.slice(8, 10))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 overflow-y-auto">
                    {acts.length === 0 && <div className="text-center text-gray-200 text-xs py-4">·</div>}
                    {acts.map(a => (
                      <div
                        key={a.id}
                        onClick={() => setModalAct(a)}
                        className="bg-accent border border-amber-200 rounded-lg p-2 cursor-pointer hover:bg-amber-100 hover:border-amber-300 transition-colors"
                      >
                        <div className="text-xs font-semibold text-accent-foreground truncate leading-tight">{a.actividad}</div>
                        <div className="text-[11px] text-gray-500 truncate leading-tight mt-0.5">{a.nombre.split(' ')[0]}</div>
                        <div className="text-[10px] text-gray-400 text-right leading-tight mt-0.5">{a.pax_total} pax</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#E2DFD8] overflow-hidden">
            <div className="grid grid-cols-7 bg-[#F7F9FC] border-b border-[#E2DFD8]">
              {DAYS_SHORT.map(d => (
                <div key={d} className="text-center text-[10px] text-gray-400 uppercase tracking-wide py-2">{d}</div>
              ))}
            </div>
            {mesGrid.map((semana, wi) => (
              <div key={wi} className="grid grid-cols-7 border-b border-[#E2DFD8] last:border-b-0">
                {semana.map(fecha => {
                  const acts = porFecha[fecha] || []
                  const esHoy = fecha === hoy
                  const delMes = fecha.slice(0, 7) === mesInicio.slice(0, 7)
                  return (
                    <div
                      key={fecha}
                      onClick={() => seleccionarDia(fecha)}
                      className={cn(
                        'border-l border-[#E2DFD8] first:border-l-0 p-1.5 min-h-[104px] cursor-pointer hover:bg-[#FAFCFF] transition-colors',
                        !delMes && 'bg-[#FAFAF8]',
                        acts.length > 0 && delMes && 'bg-[#FAFCFF]'
                      )}
                    >
                      <div className={cn(
                        'text-xs font-semibold mb-1 w-5 h-5 flex items-center justify-center rounded-full',
                        esHoy ? 'bg-primary text-primary-foreground' : delMes ? 'text-[#18181A]' : 'text-gray-300'
                      )}>
                        {Number(fecha.slice(8, 10))}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {acts.slice(0, 3).map(a => (
                          <div
                            key={a.id}
                            onClick={e => { e.stopPropagation(); setModalAct(a) }}
                            className="text-[10px] px-1 py-0.5 rounded bg-accent text-accent-foreground font-medium truncate hover:bg-amber-100"
                          >
                            {a.actividad}
                          </div>
                        ))}
                        {acts.length > 3 && (
                          <div className="text-[10px] text-gray-400 px-1">+{acts.length - 3} más</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ Vista mobile: navegación por día ══ */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-3 bg-white rounded-xl border border-[#E2DFD8] px-3 py-2.5">
          <button
            onClick={() => setDiaIdx(Math.max(0, diaIdx - 1))}
            disabled={diaIdx === 0}
            className="p-2 rounded-lg disabled:opacity-30 text-gray-500 bg-[#F0EEE9]"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <div className="text-sm font-semibold text-[#18181A] capitalize">
              {diaActual ? formatDate(diaActual[0]) : ''}
            </div>
            <div className="text-xs text-gray-400">{diasConActs.length ? diaIdx + 1 : 0} de {diasConActs.length} días</div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={irAHoy} className="px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold">
              Hoy
            </button>
            <button
              onClick={() => setDiaIdx(Math.min(diasConActs.length - 1, diaIdx + 1))}
              disabled={diaIdx === diasConActs.length - 1}
              className="p-2 rounded-lg disabled:opacity-30 text-gray-500 bg-[#F0EEE9]"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {diasConActs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">🏔️</div>
            <div className="text-sm">No hay actividades para este filtro</div>
          </div>
        ) : (
          <div
            className="flex flex-col gap-3"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {diaActual?.[1].map(act => (
              <div
                key={act.id}
                onClick={() => setModalAct(act)}
                className="bg-white rounded-xl border border-[#E2DFD8] p-4 text-left w-full hover:border-amber-300 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-semibold text-[#18181A] text-sm leading-tight">{act.actividad}</span>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {act.pax_total} pax
                  </Badge>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                  <Users size={12} />
                  <span>{act.nombre}</span>
                  {act.hotel && <><span className="text-gray-300">·</span><MapPin size={12} /><span>{act.hotel}</span></>}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                    <TrendingUp size={12} />
                    {formatCurrency(act.ganancia)} ganancia
                  </div>
                  {act.telefono && (
                    <div
                      role="button"
                      onClick={e => { e.stopPropagation(); abrirWA(act.telefono) }}
                      className="text-xs text-amber-600 flex items-center gap-1 cursor-pointer"
                    >
                      <Phone size={12} /> WhatsApp
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal detalle */}
      <BottomSheet open={!!modalAct} onClose={() => setModalAct(null)} desktopCenter className="max-h-[85vh]">
        {modalAct && (
          <>
            <h2 className="text-lg font-semibold mb-1">{modalAct.actividad}</h2>
            <p className="text-sm text-gray-400 mb-4 capitalize">{formatDate(modalAct.fecha)}</p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: 'Cliente', value: modalAct.nombre },
                { label: 'Hotel', value: modalAct.hotel || '—' },
                { label: 'Proveedor', value: modalAct.proveedor || '—' },
                { label: 'Referido', value: modalAct.referido || '—' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[#F0EEE9] rounded-xl p-3">
                  <div className="text-xs text-gray-400 mb-1">{label}</div>
                  <div className="text-sm font-medium">{value}</div>
                </div>
              ))}
            </div>

            <div className="bg-[#F0EEE9] rounded-xl p-3 mb-4">
              <div className="text-xs text-gray-400 mb-2">Pasajeros · {modalAct.pax_total} total</div>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { l: 'Adultos', v: modalAct.pax_mayor },
                  { l: 'Menores', v: modalAct.pax_menor },
                  { l: 'Infantes', v: modalAct.pax_infante },
                  { l: 'Jubilados', v: modalAct.pax_jubilado },
                ].map(({ l, v }) => (
                  <div key={l}>
                    <div className="text-lg font-semibold">{v}</div>
                    <div className="text-xs text-gray-400">{l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-amber-50 rounded-xl p-3">
                <div className="text-xs text-amber-500 mb-1">Cobrado</div>
                <div className="text-base font-semibold text-amber-600">{formatCurrency(modalAct.cobro)}</div>
              </div>
              <div className="bg-red-50 rounded-xl p-3">
                <div className="text-xs text-red-400 mb-1">Costo</div>
                <div className="text-base font-semibold text-red-500">{formatCurrency(modalAct.costo)}</div>
              </div>
              <div className="bg-green-50 rounded-xl p-3">
                <div className="text-xs text-green-500 mb-1">Ganancia</div>
                <div className="text-base font-semibold text-green-600">
                  {formatCurrency(modalAct.ganancia)}
                  <span className="text-xs font-normal ml-1">
                    ({modalAct.cobro ? Math.round((modalAct.ganancia / modalAct.cobro) * 100) : 0}%)
                  </span>
                </div>
              </div>
            </div>

            {modalAct.telefono && (
              <button
                onClick={() => abrirWA(modalAct.telefono)}
                className="w-full bg-green-500 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
              >
                <Phone size={16} /> WhatsApp — {modalAct.nombre}
              </button>
            )}
          </>
        )}
      </BottomSheet>
    </div>
  )
}
