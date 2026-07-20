'use client'
import { useEffect, useMemo, useState, useRef } from 'react'
import { supabase, type Actividad } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Search, Phone, RefreshCw, X, Pencil, Trash2 } from 'lucide-react'
import BottomSheet from '@/components/BottomSheet'
import ErrorBanner from '@/components/ErrorBanner'
import { Input, Campo } from '@/components/FormField'
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
function formatPax(a: Actividad): string {
  const partes: string[] = []
  if (a.pax_mayor) partes.push(`${a.pax_mayor} adulto${a.pax_mayor === 1 ? '' : 's'}`)
  if (a.pax_menor) partes.push(`${a.pax_menor} menor${a.pax_menor === 1 ? '' : 'es'}`)
  if (a.pax_infante) partes.push(`${a.pax_infante} infante${a.pax_infante === 1 ? '' : 's'}`)
  if (a.pax_jubilado) partes.push(`${a.pax_jubilado} jubilado${a.pax_jubilado === 1 ? '' : 's'}`)
  return partes.length ? `${a.pax_total} (${partes.join(', ')})` : String(a.pax_total)
}

type Vista = 'semana' | 'mes'

const emptyEditForm = {
  fecha: '', actividad: '', nombre: '', hotel: '', telefono: '',
  pax_mayor: '0', pax_menor: '0', pax_infante: '0', pax_jubilado: '0',
  cobro: '0', costo: '0', proveedor: '', referido: '',
}

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

  const [editando, setEditando] = useState(false)
  const [editForm, setEditForm] = useState(emptyEditForm)
  const [guardandoEdit, setGuardandoEdit] = useState(false)
  const [errorEdit, setErrorEdit] = useState<string | null>(null)

  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)

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

  function cerrarModal() {
    setModalAct(null)
    setEditando(false)
    setConfirmandoEliminar(false)
    setErrorEdit(null)
    setErrorEliminar(null)
  }

  function abrirEdicion() {
    if (!modalAct) return
    setEditForm({
      fecha: modalAct.fecha,
      actividad: modalAct.actividad,
      nombre: modalAct.nombre,
      hotel: modalAct.hotel || '',
      telefono: modalAct.telefono || '',
      pax_mayor: String(modalAct.pax_mayor),
      pax_menor: String(modalAct.pax_menor),
      pax_infante: String(modalAct.pax_infante),
      pax_jubilado: String(modalAct.pax_jubilado),
      cobro: String(modalAct.cobro),
      costo: String(modalAct.costo),
      proveedor: modalAct.proveedor || '',
      referido: modalAct.referido || '',
    })
    setErrorEdit(null)
    setEditando(true)
  }

  async function guardarEdicion(e: React.FormEvent) {
    e.preventDefault()
    if (!modalAct || !editForm.actividad || !editForm.nombre || !editForm.fecha) return
    setGuardandoEdit(true)
    setErrorEdit(null)
    const paxMayor = Number(editForm.pax_mayor) || 0
    const paxMenor = Number(editForm.pax_menor) || 0
    const paxInfante = Number(editForm.pax_infante) || 0
    const paxJubilado = Number(editForm.pax_jubilado) || 0
    const cobro = Number(editForm.cobro) || 0
    const costo = Number(editForm.costo) || 0
    const cambios = {
      fecha: editForm.fecha,
      actividad: editForm.actividad,
      nombre: editForm.nombre,
      hotel: editForm.hotel || null,
      telefono: editForm.telefono || null,
      pax_mayor: paxMayor,
      pax_menor: paxMenor,
      pax_infante: paxInfante,
      pax_jubilado: paxJubilado,
      pax_total: paxMayor + paxMenor + paxInfante + paxJubilado,
      cobro,
      costo,
      ganancia: cobro - costo,
      proveedor: editForm.proveedor || null,
      referido: editForm.referido || null,
    }
    const { error } = await supabase.from('actividades').update(cambios).eq('id', modalAct.id)
    setGuardandoEdit(false)
    if (error) { setErrorEdit('No se pudieron guardar los cambios. Probá de nuevo.'); return }
    setModalAct({ ...modalAct, ...cambios })
    setEditando(false)
    cargar()
  }

  async function confirmarEliminar() {
    if (!modalAct) return
    setEliminando(true)
    setErrorEliminar(null)
    const { error } = await supabase.from('actividades').delete().eq('id', modalAct.id)
    setEliminando(false)
    if (error) { setErrorEliminar('No se pudo eliminar. Probá de nuevo.'); return }
    cerrarModal()
    cargar()
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
        <h1 className="text-[22px] font-bold text-[#18181A]">Calendario</h1>
        <button onClick={refrescar} className="w-[34px] h-[34px] rounded-full bg-white border border-[#E2DFD8] text-gray-500 flex items-center justify-center">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* KPIs */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 bg-white rounded-[14px] p-2.5 border border-[#E2DFD8]">
          <div className="text-[11px] text-[#8A8578] mb-1">Actividades</div>
          <div className="text-[17px] font-bold text-[#18181A]">{actividadesVista.length}</div>
        </div>
        <div className="flex-1 bg-white rounded-[14px] p-2.5 border border-[#E2DFD8]">
          <div className="text-[11px] text-[#8A8578] mb-1">Cobrado</div>
          <div className="text-[17px] font-bold" style={{ color: '#B5651D' }}>{formatCurrency(totalCobrado)}</div>
        </div>
        <div className="flex-1 bg-white rounded-[14px] p-2.5 border border-[#E2DFD8]">
          <div className="text-[11px] text-[#8A8578] mb-1">Ganancia</div>
          <div className="text-[17px] font-bold" style={{ color: '#2F6B3C' }}>{formatCurrency(totalGanancia)}</div>
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
            <button
              onClick={irAHoyDesktop}
              className="px-3 py-1 rounded-full border-[1.5px] border-[#18181A] text-[#18181A] text-xs font-bold"
            >
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
                        'border-l border-[#E2DFD8] first:border-l-0 p-2 min-h-[124px] cursor-pointer hover:bg-[#FAFCFF] transition-colors',
                        !delMes && 'bg-[#FAFAF8]',
                        acts.length > 0 && delMes && 'bg-[#FAFCFF]'
                      )}
                    >
                      <div className={cn(
                        'text-xs font-semibold mb-1.5 w-6 h-6 flex items-center justify-center rounded-full',
                        esHoy ? 'bg-primary text-primary-foreground' : delMes ? 'text-[#18181A]' : 'text-gray-300'
                      )}>
                        {Number(fecha.slice(8, 10))}
                      </div>
                      <div className="flex flex-col gap-1">
                        {acts.slice(0, 3).map(a => (
                          <div
                            key={a.id}
                            onClick={e => { e.stopPropagation(); setModalAct(a) }}
                            className="text-[10.5px] leading-snug px-1.5 py-1 rounded-md bg-accent text-accent-foreground font-medium truncate hover:bg-amber-100 transition-colors"
                          >
                            {a.actividad}
                          </div>
                        ))}
                        {acts.length > 3 && (
                          <div className="text-[10px] text-gray-400 px-1.5 font-medium">+{acts.length - 3} más</div>
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
        <div className="flex items-center justify-between mb-3.5 px-1">
          <button
            onClick={() => setDiaIdx(Math.max(0, diaIdx - 1))}
            disabled={diaIdx === 0}
            className="w-8 h-8 rounded-full disabled:opacity-30 text-gray-500 bg-white border border-[#E2DFD8] flex items-center justify-center"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex flex-col items-center">
            <div className="text-base font-bold text-[#18181A] capitalize">
              {diaActual ? formatDate(diaActual[0]) : ''}
            </div>
            <button
              onClick={irAHoy}
              className="mt-0.5 px-2 py-0.5 rounded-full border-[1.5px] border-[#18181A] text-[11px] font-bold text-[#18181A]"
            >
              Hoy
            </button>
          </div>
          <button
            onClick={() => setDiaIdx(Math.min(diasConActs.length - 1, diaIdx + 1))}
            disabled={diaIdx === diasConActs.length - 1}
            className="w-8 h-8 rounded-full disabled:opacity-30 text-gray-500 bg-white border border-[#E2DFD8] flex items-center justify-center"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {diasConActs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">🏔️</div>
            <div className="text-sm">No hay actividades para este filtro</div>
          </div>
        ) : (
          <div
            className="flex flex-col gap-2.5"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {diaActual?.[1].map(act => (
              <div
                key={act.id}
                onClick={() => setModalAct(act)}
                className="rounded-2xl p-4 cursor-pointer min-h-[76px] flex flex-col justify-center gap-1"
                style={{ background: '#FFDE7E' }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-bold text-[16px] leading-tight text-[#18181A]">{act.actividad}</span>
                  <span
                    className="text-xs font-bold text-[#18181A] rounded-full px-2 py-0.5 shrink-0"
                    style={{ background: 'rgba(255,255,255,0.55)' }}
                  >
                    {act.pax_total} pax
                  </span>
                </div>
                <div className="text-[13px]" style={{ color: '#5b5647' }}>{act.nombre}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal detalle */}
      <BottomSheet
        open={!!modalAct}
        onClose={cerrarModal}
        desktopCenter
        className="max-h-[85vh] rounded-t-[24px] sm:rounded-[24px] p-5 pb-7"
      >
        {modalAct && (
          editando ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Editar actividad</h2>
                <button onClick={() => setEditando(false)}><X size={20} className="text-gray-400" /></button>
              </div>
              <ErrorBanner message={errorEdit} />
              <form onSubmit={guardarEdicion} className="flex flex-col gap-3">
                <Campo label="Actividad">
                  <Input required value={editForm.actividad} onChange={e => setEditForm({ ...editForm, actividad: e.target.value })} />
                </Campo>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Cliente">
                    <Input required value={editForm.nombre} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} />
                  </Campo>
                  <Campo label="Fecha">
                    <Input required type="date" value={editForm.fecha} onChange={e => setEditForm({ ...editForm, fecha: e.target.value })} />
                  </Campo>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Hotel">
                    <Input value={editForm.hotel} onChange={e => setEditForm({ ...editForm, hotel: e.target.value })} />
                  </Campo>
                  <Campo label="Teléfono">
                    <Input value={editForm.telefono} onChange={e => setEditForm({ ...editForm, telefono: e.target.value })} />
                  </Campo>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <Campo label="Adultos">
                    <Input type="number" min="0" value={editForm.pax_mayor} onChange={e => setEditForm({ ...editForm, pax_mayor: e.target.value })} />
                  </Campo>
                  <Campo label="Menores">
                    <Input type="number" min="0" value={editForm.pax_menor} onChange={e => setEditForm({ ...editForm, pax_menor: e.target.value })} />
                  </Campo>
                  <Campo label="Infantes">
                    <Input type="number" min="0" value={editForm.pax_infante} onChange={e => setEditForm({ ...editForm, pax_infante: e.target.value })} />
                  </Campo>
                  <Campo label="Jubilados">
                    <Input type="number" min="0" value={editForm.pax_jubilado} onChange={e => setEditForm({ ...editForm, pax_jubilado: e.target.value })} />
                  </Campo>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Cobro">
                    <Input type="number" min="0" step="0.01" value={editForm.cobro} onChange={e => setEditForm({ ...editForm, cobro: e.target.value })} />
                  </Campo>
                  <Campo label="Costo">
                    <Input type="number" min="0" step="0.01" value={editForm.costo} onChange={e => setEditForm({ ...editForm, costo: e.target.value })} />
                  </Campo>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Proveedor">
                    <Input value={editForm.proveedor} onChange={e => setEditForm({ ...editForm, proveedor: e.target.value })} />
                  </Campo>
                  <Campo label="Referido">
                    <Input value={editForm.referido} onChange={e => setEditForm({ ...editForm, referido: e.target.value })} />
                  </Campo>
                </div>
                <div className="flex gap-2.5 mt-1">
                  <button type="button" onClick={() => setEditando(false)} className="flex-1 bg-[#F0EEE9] rounded-[14px] py-3.5 text-[15px] font-bold">
                    Cancelar
                  </button>
                  <button type="submit" disabled={guardandoEdit} className="flex-1 bg-[#18181A] text-white rounded-[14px] py-3.5 text-[15px] font-bold disabled:opacity-50">
                    {guardandoEdit ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold leading-tight">{modalAct.actividad}</h2>
                  <p className="text-[13px] mt-0.5 capitalize" style={{ color: '#8A8578' }}>{formatDate(modalAct.fecha)}</p>
                </div>
                <button
                  onClick={cerrarModal}
                  className="w-[30px] h-[30px] rounded-full bg-[#F0EEE9] flex items-center justify-center shrink-0 ml-3"
                >
                  <X size={15} />
                </button>
              </div>

              <ErrorBanner message={errorEliminar} />

              <div className="grid grid-cols-3 gap-2 mt-4">
                <div className="rounded-xl p-2.5" style={{ background: '#FDF1DC' }}>
                  <div className="text-[11px]" style={{ color: '#9c7a2f' }}>Cobrado</div>
                  <div className="text-base font-bold" style={{ color: '#B5651D' }}>{formatCurrency(modalAct.cobro)}</div>
                </div>
                <div className="rounded-xl p-2.5" style={{ background: '#FBEAE7' }}>
                  <div className="text-[11px]" style={{ color: '#a34b3f' }}>Costo</div>
                  <div className="text-base font-bold" style={{ color: '#B23A2E' }}>{formatCurrency(modalAct.costo)}</div>
                </div>
                <div className="rounded-xl p-2.5" style={{ background: '#E9F3EA' }}>
                  <div className="text-[11px]" style={{ color: '#3f7a49' }}>Ganancia</div>
                  <div className="text-base font-bold" style={{ color: '#2F6B3C' }}>{formatCurrency(modalAct.ganancia)}</div>
                </div>
              </div>

              <div className="flex flex-col mt-4">
                {[
                  { label: 'Cliente', value: modalAct.nombre },
                  { label: 'Hotel', value: modalAct.hotel || '—' },
                  { label: 'Proveedor', value: modalAct.proveedor || '—' },
                  { label: 'Referido', value: modalAct.referido || '—' },
                  { label: 'Pasajeros', value: formatPax(modalAct) },
                ].map(({ label, value }, i, arr) => (
                  <div
                    key={label}
                    className={cn('flex items-start justify-between gap-3 py-2.5', i < arr.length - 1 && 'border-b border-[#E2DFD8]')}
                  >
                    <span className="text-[13px] shrink-0" style={{ color: '#8A8578' }}>{label}</span>
                    <span className="text-sm font-semibold text-right">{value}</span>
                  </div>
                ))}
              </div>

              {modalAct.telefono && (
                <button
                  onClick={() => abrirWA(modalAct.telefono)}
                  className="w-full bg-green-500 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 mt-4"
                >
                  <Phone size={16} /> WhatsApp — {modalAct.nombre}
                </button>
              )}

              {confirmandoEliminar ? (
                <div className="mt-5">
                  <p className="text-sm text-center text-gray-500 mb-3">¿Eliminar esta actividad? No se puede deshacer.</p>
                  <div className="flex gap-2.5">
                    <button
                      onClick={() => setConfirmandoEliminar(false)}
                      className="flex-1 bg-[#F0EEE9] rounded-[14px] py-3.5 text-[15px] font-bold"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={confirmarEliminar}
                      disabled={eliminando}
                      className="flex-1 text-white rounded-[14px] py-3.5 text-[15px] font-bold disabled:opacity-50"
                      style={{ background: '#B23A2E' }}
                    >
                      {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2.5 mt-5">
                  <button
                    onClick={abrirEdicion}
                    className="flex-1 bg-[#18181A] text-white rounded-[14px] py-3.5 text-[15px] font-bold flex items-center justify-center gap-1.5"
                  >
                    <Pencil size={14} /> Editar
                  </button>
                  <button
                    onClick={() => setConfirmandoEliminar(true)}
                    className="flex-1 bg-[#F0EEE9] rounded-[14px] py-3.5 text-[15px] font-bold flex items-center justify-center gap-1.5"
                    style={{ color: '#B23A2E' }}
                  >
                    <Trash2 size={14} /> Eliminar
                  </button>
                </div>
              )}
            </>
          )
        )}
      </BottomSheet>
    </div>
  )
}
