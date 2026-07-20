'use client'
import { useEffect, useMemo, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase, type Pasajero, type Viaje, type Actividad } from '@/lib/supabase'
import { formatCurrency, formatDateShort, cn } from '@/lib/utils'
import BottomSheet from '@/components/BottomSheet'
import ErrorBanner from '@/components/ErrorBanner'
import EmptyState from '@/components/EmptyState'
import { Input, Campo } from '@/components/FormField'
import {
  Plus, X, Phone, Search, RefreshCw, MapPin, CreditCard, TrendingUp,
} from 'lucide-react'

type EstadoAsignacion = 'confirmado' | 'en_espera' | 'cancelado'

const ESTADO_LABELS: Record<EstadoAsignacion, string> = {
  confirmado: 'Confirmado', en_espera: 'En espera', cancelado: 'Cancelado',
}
const ESTADO_COLORS: Record<EstadoAsignacion, string> = {
  confirmado: 'bg-green-50 text-green-700 border-green-200',
  en_espera: 'bg-amber-50 text-amber-700 border-amber-200',
  cancelado: 'bg-red-50 text-red-600 border-red-200',
}
const ESTADO_STRIPE: Record<EstadoAsignacion, string> = {
  confirmado: 'border-l-green-400',
  en_espera: 'border-l-amber-400',
  cancelado: 'border-l-red-400',
}

type ViajeHistorial = {
  viaje_pasajero_id: string
  viaje: Viaje
  estado: EstadoAsignacion
  pagado: number
  debe: number
}

const emptyForm = { nombre: '', apellido: '', dni: '', telefono: '', email: '', fecha_nacimiento: '', hotel_salida: '', notas: '' }

function PasajerosContent() {
  const searchParams = useSearchParams()
  const [pasajeros, setPasajeros] = useState<Pasajero[]>([])
  const [conteoViajes, setConteoViajes] = useState<Record<string, number>>({})
  const [conteoActividades, setConteoActividades] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [modalNuevo, setModalNuevo] = useState(false)
  const [nuevoForm, setNuevoForm] = useState(emptyForm)
  const [guardando, setGuardando] = useState(false)
  const [errorNuevo, setErrorNuevo] = useState<string | null>(null)

  const [detalle, setDetalle] = useState<Pasajero | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [guardandoEdit, setGuardandoEdit] = useState(false)
  const [errorEdit, setErrorEdit] = useState<string | null>(null)
  const [historial, setHistorial] = useState<ViajeHistorial[]>([])
  const [actividadesHist, setActividadesHist] = useState<Actividad[]>([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [errorHistorial, setErrorHistorial] = useState<string | null>(null)

  const autoAbierto = useRef(false)

  async function cargar() {
    const [{ data: pax }, { data: vp }, { data: acts }] = await Promise.all([
      supabase.from('pasajeros').select('*').order('apellido'),
      supabase.from('viaje_pasajeros').select('pasajero_id'),
      supabase.from('actividades').select('pasajero_id').not('pasajero_id', 'is', null),
    ])
    if (pax) setPasajeros(pax)
    if (vp) {
      const c: Record<string, number> = {}
      vp.forEach((row: { pasajero_id: string }) => { c[row.pasajero_id] = (c[row.pasajero_id] || 0) + 1 })
      setConteoViajes(c)
    }
    if (acts) {
      const c: Record<string, number> = {}
      acts.forEach((row: { pasajero_id: string }) => { c[row.pasajero_id] = (c[row.pasajero_id] || 0) + 1 })
      setConteoActividades(c)
    }
    return pax || []
  }

  async function refrescar() {
    setLoading(true)
    await cargar()
    setLoading(false)
  }

  useEffect(() => {
    (async () => {
      const pax = await cargar()
      setLoading(false)
      const id = searchParams.get('id')
      if (id && !autoAbierto.current) {
        autoAbierto.current = true
        const p = pax.find(x => x.id === id)
        if (p) abrirDetalle(p)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtrados = useMemo(() => {
    if (!search.trim()) return pasajeros
    const q = search.toLowerCase()
    return pasajeros.filter(p =>
      `${p.nombre} ${p.apellido}`.toLowerCase().includes(q) || (p.dni || '').includes(q)
    )
  }, [search, pasajeros])

  async function crearPasajero(e: React.FormEvent) {
    e.preventDefault()
    if (!nuevoForm.nombre || !nuevoForm.apellido) return
    setGuardando(true)
    setErrorNuevo(null)
    const { error } = await supabase.from('pasajeros').insert({
      nombre: nuevoForm.nombre,
      apellido: nuevoForm.apellido,
      dni: nuevoForm.dni || null,
      telefono: nuevoForm.telefono || null,
      email: nuevoForm.email || null,
      fecha_nacimiento: nuevoForm.fecha_nacimiento || null,
      hotel_salida: nuevoForm.hotel_salida || null,
      notas: nuevoForm.notas || null,
    })
    setGuardando(false)
    if (error) { setErrorNuevo('No se pudo crear el pasajero. Probá de nuevo.'); return }
    setModalNuevo(false)
    setNuevoForm(emptyForm)
    cargar()
  }

  async function abrirDetalle(p: Pasajero) {
    setDetalle(p)
    setErrorHistorial(null)
    setEditForm({
      nombre: p.nombre, apellido: p.apellido, dni: p.dni || '', telefono: p.telefono || '',
      email: p.email || '', fecha_nacimiento: p.fecha_nacimiento || '', hotel_salida: p.hotel_salida || '',
      notas: p.notas || '',
    })
    setCargandoHistorial(true)
    const [{ data: vp, error: errVp }, { data: acts, error: errActs }] = await Promise.all([
      supabase
        .from('viaje_pasajeros')
        .select('id, estado, viaje:viajes(*)')
        .eq('pasajero_id', p.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('actividades')
        .select('*')
        .eq('pasajero_id', p.id)
        .order('fecha', { ascending: false }),
    ])
    if (errVp || errActs) setErrorHistorial('No se pudo cargar el historial completo.')
    setActividadesHist(acts || [])
    if (vp && vp.length) {
      const vpIds = vp.map((row: { id: string }) => row.id)
      const { data: pagos } = await supabase.from('pagos').select('viaje_pasajero_id, monto').in('viaje_pasajero_id', vpIds)
      const pagadoPorVp: Record<string, number> = {}
      pagos?.forEach((pg: { viaje_pasajero_id: string; monto: number }) => {
        pagadoPorVp[pg.viaje_pasajero_id] = (pagadoPorVp[pg.viaje_pasajero_id] || 0) + pg.monto
      })
      const hist: ViajeHistorial[] = (vp as unknown as { id: string; estado: EstadoAsignacion; viaje: Viaje }[]).map(row => {
        const pagado = pagadoPorVp[row.id] || 0
        return {
          viaje_pasajero_id: row.id,
          viaje: row.viaje,
          estado: row.estado,
          pagado,
          debe: Math.max(0, row.viaje.precio_base - pagado),
        }
      })
      setHistorial(hist)
    } else {
      setHistorial([])
    }
    setCargandoHistorial(false)
  }

  function cerrarDetalle() {
    setDetalle(null)
    setHistorial([])
    setActividadesHist([])
  }

  async function guardarEdicion(e: React.FormEvent) {
    e.preventDefault()
    if (!detalle || !editForm.nombre || !editForm.apellido) return
    setGuardandoEdit(true)
    setErrorEdit(null)
    const { error } = await supabase.from('pasajeros').update({
      nombre: editForm.nombre,
      apellido: editForm.apellido,
      dni: editForm.dni || null,
      telefono: editForm.telefono || null,
      email: editForm.email || null,
      fecha_nacimiento: editForm.fecha_nacimiento || null,
      hotel_salida: editForm.hotel_salida || null,
      notas: editForm.notas || null,
    }).eq('id', detalle.id)
    setGuardandoEdit(false)
    if (error) { setErrorEdit('No se pudieron guardar los cambios. Probá de nuevo.'); return }
    cargar()
    setDetalle(prev => prev ? { ...prev, ...editForm } as Pasajero : prev)
  }

  function abrirWA(tel: string | null) {
    if (!tel) return
    window.open(`https://wa.me/${tel.replace(/\D/g, '')}`, '_blank', 'noopener,noreferrer')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <RefreshCw size={24} className="animate-spin mr-2" /> Cargando...
    </div>
  )

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Pasajeros</h1>
        <div className="flex items-center gap-2">
          <button onClick={refrescar} className="p-2 rounded-lg bg-white border border-[#E2DFD8] text-gray-500">
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => { setErrorNuevo(null); setModalNuevo(true) }}
            className="flex items-center gap-1.5 bg-[#18181A] text-white text-sm font-medium px-3 py-2 rounded-xl"
          >
            <Plus size={16} /> Nuevo pasajero
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o DNI..."
          className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-[#E2DFD8] rounded-xl outline-none focus:border-amber-400"
        />
      </div>

      {filtrados.length === 0 ? (
        pasajeros.length === 0 ? (
          <EmptyState title="Todavía no hay pasajeros" description="Creá el primero con el botón de arriba." />
        ) : (
          <div className="text-center py-16 text-gray-400">
            <div className="text-sm">Sin resultados para &quot;{search}&quot;</div>
          </div>
        )
      ) : (
        <div className="flex flex-col gap-2">
          {filtrados.map(p => (
            <div
              key={p.id}
              onClick={() => abrirDetalle(p)}
              className="bg-white rounded-xl border border-[#E2DFD8] p-3.5 cursor-pointer hover:border-amber-300 transition-colors flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#18181A] truncate">{p.nombre} {p.apellido}</div>
                <div className="text-xs text-gray-400 flex items-center gap-2">
                  {p.dni && <span>DNI {p.dni}</span>}
                  <span>{conteoViajes[p.id] || 0} viaje{(conteoViajes[p.id] || 0) === 1 ? '' : 's'}</span>
                  {(conteoActividades[p.id] || 0) > 0 && (
                    <span>{conteoActividades[p.id]} actividad{conteoActividades[p.id] === 1 ? '' : 'es'}</span>
                  )}
                </div>
              </div>
              {p.telefono && (
                <button
                  onClick={e => { e.stopPropagation(); abrirWA(p.telefono) }}
                  className="p-2 rounded-lg bg-green-50 text-green-600 border border-green-200 shrink-0"
                >
                  <Phone size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal: nuevo pasajero */}
      <BottomSheet open={modalNuevo} onClose={() => setModalNuevo(false)}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Nuevo pasajero</h2>
          <button onClick={() => setModalNuevo(false)}><X size={20} className="text-gray-400" /></button>
        </div>
        <ErrorBanner message={errorNuevo} />
        <form onSubmit={crearPasajero} className="flex flex-col gap-3">
          <PasajeroCampos form={nuevoForm} setForm={setNuevoForm} />
          <button
            type="submit"
            disabled={guardando}
            className="w-full bg-[#18181A] text-white rounded-xl py-3 font-semibold mt-2 disabled:opacity-50"
          >
            {guardando ? 'Creando...' : 'Crear pasajero'}
          </button>
        </form>
      </BottomSheet>

      {/* Modal: ficha de pasajero */}
      <BottomSheet open={!!detalle} onClose={cerrarDetalle}>
        {detalle && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{detalle.nombre} {detalle.apellido}</h2>
              <button onClick={cerrarDetalle}><X size={20} className="text-gray-400" /></button>
            </div>

            <ErrorBanner message={errorEdit} />
            <form onSubmit={guardarEdicion} className="flex flex-col gap-3 mb-5">
              <PasajeroCampos form={editForm} setForm={setEditForm} />
              <button
                type="submit"
                disabled={guardandoEdit}
                className="w-full border border-[#E2DFD8] text-[#18181A] rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                {guardandoEdit ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </form>

            <ErrorBanner message={errorHistorial} />

            <div className="border-t border-[#E2DFD8] pt-4">
              <div className="text-sm font-semibold mb-2">Historial de viajes</div>
              {cargandoHistorial ? (
                <div className="text-center py-6 text-gray-400 text-sm">Cargando...</div>
              ) : historial.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm">Todavía no participó de ningún viaje</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {historial.map(h => (
                    <div key={h.viaje_pasajero_id} className={cn('bg-[#F0EEE9] rounded-xl p-3 border-l-4', ESTADO_STRIPE[h.estado])}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-sm font-medium">{h.viaje.nombre}</span>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full border shrink-0', ESTADO_COLORS[h.estado])}>
                          {ESTADO_LABELS[h.estado]}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                        <MapPin size={11} /> {h.viaje.destino}
                        <span className="text-gray-300">·</span>
                        {formatDateShort(h.viaje.fecha_salida)}
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        <CreditCard size={11} className="text-gray-400" />
                        <span className="text-gray-500">Pagado {formatCurrency(h.pagado)}</span>
                        {h.debe > 0 && <span className="text-red-500 font-medium">· Debe {formatCurrency(h.debe)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-[#E2DFD8] pt-4 mt-4">
              <div className="text-sm font-semibold mb-2">Actividades individuales</div>
              {cargandoHistorial ? (
                <div className="text-center py-6 text-gray-400 text-sm">Cargando...</div>
              ) : actividadesHist.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm">Sin actividades individuales registradas</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {actividadesHist.map(a => (
                    <div key={a.id} className="bg-[#F0EEE9] rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-sm font-medium">{a.actividad}</span>
                        <span className="text-xs text-gray-400 shrink-0">{formatDateShort(a.fecha)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                        {a.hotel && <><MapPin size={11} /> {a.hotel}<span className="text-gray-300">·</span></>}
                        {a.pax_total} pax
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-gray-500">Cobrado {formatCurrency(a.cobro)}</span>
                        <span className="text-green-600 font-medium flex items-center gap-0.5">
                          <TrendingUp size={11} /> {formatCurrency(a.ganancia)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </BottomSheet>
    </div>
  )
}

function PasajeroCampos({ form, setForm }: { form: typeof emptyForm; setForm: (f: typeof emptyForm) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Nombre">
          <Input required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
        </Campo>
        <Campo label="Apellido">
          <Input required value={form.apellido} onChange={e => setForm({ ...form, apellido: e.target.value })} />
        </Campo>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="DNI">
          <Input value={form.dni} onChange={e => setForm({ ...form, dni: e.target.value })} />
        </Campo>
        <Campo label="Teléfono">
          <Input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
        </Campo>
      </div>
      <Campo label="Email">
        <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Fecha de nacimiento">
          <Input type="date" value={form.fecha_nacimiento} onChange={e => setForm({ ...form, fecha_nacimiento: e.target.value })} />
        </Campo>
        <Campo label="Hotel de salida">
          <Input value={form.hotel_salida} onChange={e => setForm({ ...form, hotel_salida: e.target.value })} />
        </Campo>
      </div>
      <Campo label="Notas">
        <Input value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Opcional" />
      </Campo>
    </>
  )
}

export default function PasajerosPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64 text-gray-400">
        <RefreshCw size={24} className="animate-spin mr-2" /> Cargando...
      </div>
    }>
      <PasajerosContent />
    </Suspense>
  )
}
