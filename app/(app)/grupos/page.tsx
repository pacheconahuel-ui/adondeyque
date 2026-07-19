'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase, type Viaje, type Pasajero } from '@/lib/supabase'
import { formatCurrency, formatDateShort } from '@/lib/utils'
import { cn } from '@/lib/utils'
import BottomSheet from '@/components/BottomSheet'
import ErrorBanner from '@/components/ErrorBanner'
import { Input, Select, Campo } from '@/components/FormField'
import {
  Plus, Users, MapPin, ChevronRight, X, Phone, Search, UserPlus, RefreshCw,
} from 'lucide-react'

type EstadoViaje = Viaje['estado']
type EstadoAsignacion = 'confirmado' | 'en_espera' | 'cancelado'

const ESTADO_VIAJE_LABELS: Record<EstadoViaje, string> = {
  borrador: 'Borrador', confirmado: 'Confirmado', en_espera: 'En espera', cancelado: 'Cancelado',
}
const ESTADO_VIAJE_COLORS: Record<EstadoViaje, string> = {
  borrador: 'bg-gray-50 text-gray-500 border-gray-200',
  confirmado: 'bg-green-50 text-green-700 border-green-200',
  en_espera: 'bg-amber-50 text-amber-700 border-amber-200',
  cancelado: 'bg-red-50 text-red-600 border-red-200',
}
const ESTADO_ASIG_LABELS: Record<EstadoAsignacion, string> = {
  confirmado: 'Confirmado', en_espera: 'En espera', cancelado: 'Cancelado',
}

type ViajePasajeroConDetalle = {
  id: string
  viaje_id: string
  pasajero_id: string
  estado: EstadoAsignacion
  pasajero: Pasajero
}

type Conteo = { confirmado: number; en_espera: number }

const emptyViajeForm = {
  nombre: '', destino: '', fecha_salida: '', fecha_regreso: '',
  cupo_max: '20', precio_base: '', proveedor: '', estado: 'borrador' as EstadoViaje,
  temporada: '2026',
}
const emptyPasajeroForm = { nombre: '', apellido: '', dni: '', telefono: '', hotel_salida: '' }

const MENSAJE_ERROR_GENERICO = 'No se pudo guardar. Probá de nuevo.'

export default function GruposPage() {
  const [viajes, setViajes] = useState<Viaje[]>([])
  const [conteos, setConteos] = useState<Record<string, Conteo>>({})
  const [loading, setLoading] = useState(true)

  const [modalNuevo, setModalNuevo] = useState(false)
  const [nuevoForm, setNuevoForm] = useState(emptyViajeForm)
  const [guardando, setGuardando] = useState(false)
  const [errorNuevo, setErrorNuevo] = useState<string | null>(null)

  const [viajeDetalle, setViajeDetalle] = useState<Viaje | null>(null)
  const [asignados, setAsignados] = useState<ViajePasajeroConDetalle[]>([])
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null)

  const [todosPasajeros, setTodosPasajeros] = useState<Pasajero[]>([])
  const [buscarPasajero, setBuscarPasajero] = useState('')
  const [creandoPasajero, setCreandoPasajero] = useState(false)
  const [pasajeroForm, setPasajeroForm] = useState(emptyPasajeroForm)
  const [guardandoPasajero, setGuardandoPasajero] = useState(false)
  const [errorPasajero, setErrorPasajero] = useState<string | null>(null)

  async function cargar() {
    const [{ data: v }, { data: vp }] = await Promise.all([
      supabase.from('viajes').select('*').order('fecha_salida'),
      supabase.from('viaje_pasajeros').select('viaje_id, estado'),
    ])
    if (v) setViajes(v)
    if (vp) {
      const c: Record<string, Conteo> = {}
      vp.forEach((row: { viaje_id: string; estado: EstadoAsignacion }) => {
        if (!c[row.viaje_id]) c[row.viaje_id] = { confirmado: 0, en_espera: 0 }
        if (row.estado === 'confirmado' || row.estado === 'en_espera') c[row.viaje_id][row.estado]++
      })
      setConteos(c)
    }
  }
  useEffect(() => {
    (async () => { await cargar(); setLoading(false) })()
  }, [])

  async function crearViaje(e: React.FormEvent) {
    e.preventDefault()
    if (!nuevoForm.nombre || !nuevoForm.destino || !nuevoForm.fecha_salida) return
    setGuardando(true)
    setErrorNuevo(null)
    const { error } = await supabase.from('viajes').insert({
      nombre: nuevoForm.nombre,
      destino: nuevoForm.destino,
      fecha_salida: nuevoForm.fecha_salida,
      fecha_regreso: nuevoForm.fecha_regreso || null,
      cupo_max: Number(nuevoForm.cupo_max) || 20,
      precio_base: Number(nuevoForm.precio_base) || 0,
      proveedor: nuevoForm.proveedor || null,
      estado: nuevoForm.estado,
      temporada: nuevoForm.temporada,
      notas: null,
    })
    setGuardando(false)
    if (error) { setErrorNuevo(MENSAJE_ERROR_GENERICO); return }
    setModalNuevo(false)
    setNuevoForm(emptyViajeForm)
    cargar()
  }

  async function abrirDetalle(viaje: Viaje) {
    setViajeDetalle(viaje)
    setCargandoDetalle(true)
    setErrorDetalle(null)
    setBuscarPasajero('')
    setCreandoPasajero(false)
    setPasajeroForm(emptyPasajeroForm)
    const [{ data: vp, error }, { data: pax }] = await Promise.all([
      supabase.from('viaje_pasajeros').select('*, pasajero:pasajeros(*)').eq('viaje_id', viaje.id),
      supabase.from('pasajeros').select('*').order('apellido'),
    ])
    if (error) setErrorDetalle('No se pudo cargar la lista de pasajeros.')
    if (vp) setAsignados(vp as ViajePasajeroConDetalle[])
    if (pax) setTodosPasajeros(pax)
    setCargandoDetalle(false)
  }

  function cerrarDetalle() {
    setViajeDetalle(null)
    setAsignados([])
  }

  const confirmadosEnDetalle = useMemo(
    () => asignados.filter(a => a.estado === 'confirmado').length,
    [asignados]
  )

  function estadoDefaultParaNuevaAsignacion(): EstadoAsignacion {
    if (!viajeDetalle) return 'confirmado'
    return confirmadosEnDetalle >= viajeDetalle.cupo_max ? 'en_espera' : 'confirmado'
  }

  async function asignarPasajeroExistente(pasajero: Pasajero) {
    if (!viajeDetalle) return
    setErrorDetalle(null)
    const estado = estadoDefaultParaNuevaAsignacion()
    const { data, error } = await supabase.from('viaje_pasajeros')
      .insert({ viaje_id: viajeDetalle.id, pasajero_id: pasajero.id, estado })
      .select('*, pasajero:pasajeros(*)')
      .single()
    if (error || !data) { setErrorDetalle('No se pudo asignar el pasajero. Probá de nuevo.'); return }
    setAsignados(prev => [...prev, data as ViajePasajeroConDetalle])
    setBuscarPasajero('')
    cargar()
  }

  async function crearYAsignarPasajero(e: React.FormEvent) {
    e.preventDefault()
    if (!viajeDetalle || !pasajeroForm.nombre || !pasajeroForm.apellido) return
    setGuardandoPasajero(true)
    setErrorPasajero(null)
    const { data: nuevoPax, error: errPax } = await supabase.from('pasajeros').insert({
      nombre: pasajeroForm.nombre,
      apellido: pasajeroForm.apellido,
      dni: pasajeroForm.dni || null,
      telefono: pasajeroForm.telefono || null,
      email: null,
      fecha_nacimiento: null,
      hotel_salida: pasajeroForm.hotel_salida || null,
      notas: null,
    }).select().single()
    if (errPax || !nuevoPax) {
      setGuardandoPasajero(false)
      setErrorPasajero('No se pudo crear el pasajero. Probá de nuevo.')
      return
    }
    await asignarPasajeroExistente(nuevoPax)
    setGuardandoPasajero(false)
    setCreandoPasajero(false)
    setPasajeroForm(emptyPasajeroForm)
  }

  async function cambiarEstadoAsignacion(id: string, estado: EstadoAsignacion) {
    const anterior = asignados
    setAsignados(prev => prev.map(a => a.id === id ? { ...a, estado } : a))
    const { error } = await supabase.from('viaje_pasajeros').update({ estado }).eq('id', id)
    if (error) { setAsignados(anterior); setErrorDetalle('No se pudo cambiar el estado. Probá de nuevo.'); return }
    cargar()
  }

  async function cambiarEstadoViaje(estado: EstadoViaje) {
    if (!viajeDetalle) return
    const anterior = viajeDetalle
    setViajeDetalle({ ...viajeDetalle, estado })
    const { error } = await supabase.from('viajes').update({ estado }).eq('id', viajeDetalle.id)
    if (error) { setViajeDetalle(anterior); setErrorDetalle('No se pudo cambiar el estado del viaje.'); return }
    setViajes(prev => prev.map(v => v.id === viajeDetalle.id ? { ...v, estado } : v))
  }

  function abrirWA(tel: string | null) {
    if (!tel) return
    window.open(`https://wa.me/${tel.replace(/\D/g, '')}`, '_blank', 'noopener,noreferrer')
  }

  const idsAsignados = useMemo(() => new Set(asignados.map(a => a.pasajero_id)), [asignados])
  const candidatos = useMemo(() => {
    if (!buscarPasajero.trim()) return []
    const q = buscarPasajero.toLowerCase()
    return todosPasajeros.filter(p =>
      !idsAsignados.has(p.id) &&
      (`${p.nombre} ${p.apellido}`.toLowerCase().includes(q) || (p.dni || '').includes(q))
    ).slice(0, 6)
  }, [buscarPasajero, todosPasajeros, idsAsignados])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <RefreshCw size={24} className="animate-spin mr-2" /> Cargando...
    </div>
  )

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Grupos</h1>
        <button
          onClick={() => { setErrorNuevo(null); setModalNuevo(true) }}
          className="flex items-center gap-1.5 bg-[#18181A] text-white text-sm font-medium px-3 py-2 rounded-xl"
        >
          <Plus size={16} /> Nuevo viaje
        </button>
      </div>

      {viajes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E2DFD8] p-10 text-center">
          <div className="text-5xl mb-4">🚌</div>
          <h2 className="text-base font-semibold text-[#18181A] mb-2">Todavía no hay viajes</h2>
          <p className="text-sm text-gray-400">Creá tu primer viaje grupal con el botón de arriba.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {viajes.map(viaje => {
            const c = conteos[viaje.id] || { confirmado: 0, en_espera: 0 }
            const pct = Math.min(100, Math.round((c.confirmado / viaje.cupo_max) * 100))
            return (
              <div
                key={viaje.id}
                onClick={() => abrirDetalle(viaje)}
                className="bg-white rounded-2xl border border-[#E2DFD8] p-4 cursor-pointer hover:border-amber-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-semibold text-[#18181A] text-sm">{viaje.nombre}</span>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full border shrink-0', ESTADO_VIAJE_COLORS[viaje.estado])}>
                    {ESTADO_VIAJE_LABELS[viaje.estado]}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                  <MapPin size={12} /> {viaje.destino}
                  <span className="text-gray-300">·</span>
                  {formatDateShort(viaje.fecha_salida)}
                </div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="flex items-center gap-1 text-gray-500">
                    <Users size={12} /> {c.confirmado} / {viaje.cupo_max} confirmados
                    {c.en_espera > 0 && <span className="text-amber-600 ml-1">· {c.en_espera} en espera</span>}
                  </span>
                  <ChevronRight size={14} className="text-gray-300" />
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: nuevo viaje */}
      <BottomSheet open={modalNuevo} onClose={() => setModalNuevo(false)}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Nuevo viaje</h2>
          <button onClick={() => setModalNuevo(false)}><X size={20} className="text-gray-400" /></button>
        </div>
        <ErrorBanner message={errorNuevo} />
        <form onSubmit={crearViaje} className="flex flex-col gap-3">
          <Campo label="Nombre del viaje">
            <Input required value={nuevoForm.nombre} onChange={e => setNuevoForm({ ...nuevoForm, nombre: e.target.value })}
              placeholder="Ej: Circuito Chico VIP" />
          </Campo>
          <Campo label="Destino">
            <Input required value={nuevoForm.destino} onChange={e => setNuevoForm({ ...nuevoForm, destino: e.target.value })}
              placeholder="Ej: Bariloche - Villa La Angostura" />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Fecha salida">
              <Input required type="date" value={nuevoForm.fecha_salida} onChange={e => setNuevoForm({ ...nuevoForm, fecha_salida: e.target.value })} />
            </Campo>
            <Campo label="Fecha regreso">
              <Input type="date" value={nuevoForm.fecha_regreso} onChange={e => setNuevoForm({ ...nuevoForm, fecha_regreso: e.target.value })} />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Cupo máximo">
              <Input type="number" min="1" value={nuevoForm.cupo_max} onChange={e => setNuevoForm({ ...nuevoForm, cupo_max: e.target.value })} />
            </Campo>
            <Campo label="Precio base">
              <Input type="number" min="0" value={nuevoForm.precio_base} onChange={e => setNuevoForm({ ...nuevoForm, precio_base: e.target.value })} placeholder="0" />
            </Campo>
          </div>
          <Campo label="Proveedor">
            <Input value={nuevoForm.proveedor} onChange={e => setNuevoForm({ ...nuevoForm, proveedor: e.target.value })} placeholder="Opcional" />
          </Campo>
          <Campo label="Estado">
            <Select value={nuevoForm.estado} onChange={e => setNuevoForm({ ...nuevoForm, estado: e.target.value as EstadoViaje })}>
              {(Object.keys(ESTADO_VIAJE_LABELS) as EstadoViaje[]).map(k => (
                <option key={k} value={k}>{ESTADO_VIAJE_LABELS[k]}</option>
              ))}
            </Select>
          </Campo>
          <button
            type="submit"
            disabled={guardando}
            className="w-full bg-[#18181A] text-white rounded-xl py-3 font-semibold mt-2 disabled:opacity-50"
          >
            {guardando ? 'Creando...' : 'Crear viaje'}
          </button>
        </form>
      </BottomSheet>

      {/* Modal: detalle de viaje */}
      <BottomSheet open={!!viajeDetalle} onClose={cerrarDetalle}>
        {viajeDetalle && (
          <>
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-lg font-semibold">{viajeDetalle.nombre}</h2>
              <button onClick={cerrarDetalle}><X size={20} className="text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              {viajeDetalle.destino} · {formatDateShort(viajeDetalle.fecha_salida)}
              {viajeDetalle.fecha_regreso && ` — ${formatDateShort(viajeDetalle.fecha_regreso)}`}
            </p>

            <ErrorBanner message={errorDetalle} />

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-[#F0EEE9] rounded-xl p-3">
                <div className="text-xs text-gray-400 mb-1">Estado</div>
                <select
                  value={viajeDetalle.estado}
                  onChange={e => cambiarEstadoViaje(e.target.value as EstadoViaje)}
                  className="text-sm font-medium bg-transparent outline-none w-full"
                >
                  {(Object.keys(ESTADO_VIAJE_LABELS) as EstadoViaje[]).map(k => (
                    <option key={k} value={k}>{ESTADO_VIAJE_LABELS[k]}</option>
                  ))}
                </select>
              </div>
              <div className="bg-[#F0EEE9] rounded-xl p-3">
                <div className="text-xs text-gray-400 mb-1">Precio base</div>
                <div className="text-sm font-medium">{formatCurrency(viajeDetalle.precio_base)}</div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="flex items-center gap-1 text-gray-500 font-medium">
                <Users size={12} /> {confirmadosEnDetalle} / {viajeDetalle.cupo_max} confirmados
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-amber-500 rounded-full"
                style={{ width: `${Math.min(100, Math.round((confirmadosEnDetalle / viajeDetalle.cupo_max) * 100))}%` }}
              />
            </div>

            {cargandoDetalle ? (
              <div className="text-center py-8 text-gray-400 text-sm">Cargando pasajeros...</div>
            ) : (
              <div className="flex flex-col gap-2 mb-4">
                {asignados.length === 0 && (
                  <div className="text-center py-6 text-gray-400 text-sm">Sin pasajeros asignados todavía</div>
                )}
                {asignados.map(a => (
                  <div key={a.id} className="bg-[#F0EEE9] rounded-xl p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/pasajeros?id=${a.pasajero_id}`}
                        onClick={e => e.stopPropagation()}
                        className="text-sm font-medium truncate text-[#18181A] hover:text-amber-600 hover:underline block"
                      >
                        {a.pasajero.nombre} {a.pasajero.apellido}
                      </Link>
                      <div className="text-xs text-gray-400 flex items-center gap-1.5">
                        {a.pasajero.dni && <span>DNI {a.pasajero.dni}</span>}
                        {a.pasajero.telefono && (
                          <span
                            role="button"
                            onClick={() => abrirWA(a.pasajero.telefono)}
                            className="text-amber-600 flex items-center gap-0.5 cursor-pointer"
                          >
                            <Phone size={10} /> WhatsApp
                          </span>
                        )}
                      </div>
                    </div>
                    <select
                      value={a.estado}
                      onChange={e => cambiarEstadoAsignacion(a.id, e.target.value as EstadoAsignacion)}
                      className={cn('text-xs px-2 py-1 rounded-lg border shrink-0 outline-none',
                        a.estado === 'confirmado' ? 'bg-green-50 text-green-700 border-green-200' :
                        a.estado === 'en_espera' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-red-50 text-red-600 border-red-200')}
                    >
                      {(Object.keys(ESTADO_ASIG_LABELS) as EstadoAsignacion[]).map(k => (
                        <option key={k} value={k}>{ESTADO_ASIG_LABELS[k]}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            {/* Agregar pasajero */}
            <div className="border-t border-[#E2DFD8] pt-4">
              <div className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <UserPlus size={14} /> Agregar pasajero
              </div>
              {!creandoPasajero ? (
                <>
                  <div className="relative mb-2">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={buscarPasajero}
                      onChange={e => setBuscarPasajero(e.target.value)}
                      placeholder="Buscar por nombre o DNI..."
                      className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-[#E2DFD8] rounded-xl outline-none focus:border-amber-400"
                    />
                  </div>
                  {candidatos.length > 0 && (
                    <div className="flex flex-col gap-1 mb-2">
                      {candidatos.map(p => (
                        <div
                          key={p.id}
                          onClick={() => asignarPasajeroExistente(p)}
                          className="text-sm bg-white border border-[#E2DFD8] rounded-xl px-3 py-2 cursor-pointer hover:border-amber-300 flex items-center justify-between"
                        >
                          <span>{p.nombre} {p.apellido}</span>
                          {p.dni && <span className="text-xs text-gray-400">DNI {p.dni}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => { setErrorPasajero(null); setCreandoPasajero(true) }}
                    className="text-sm text-amber-600 font-medium"
                  >
                    + Crear pasajero nuevo
                  </button>
                </>
              ) : (
                <form onSubmit={crearYAsignarPasajero} className="flex flex-col gap-3">
                  <ErrorBanner message={errorPasajero} />
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Nombre">
                      <Input required value={pasajeroForm.nombre} onChange={e => setPasajeroForm({ ...pasajeroForm, nombre: e.target.value })} />
                    </Campo>
                    <Campo label="Apellido">
                      <Input required value={pasajeroForm.apellido} onChange={e => setPasajeroForm({ ...pasajeroForm, apellido: e.target.value })} />
                    </Campo>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="DNI">
                      <Input value={pasajeroForm.dni} onChange={e => setPasajeroForm({ ...pasajeroForm, dni: e.target.value })} />
                    </Campo>
                    <Campo label="Teléfono">
                      <Input value={pasajeroForm.telefono} onChange={e => setPasajeroForm({ ...pasajeroForm, telefono: e.target.value })} />
                    </Campo>
                  </div>
                  <Campo label="Hotel de salida">
                    <Input value={pasajeroForm.hotel_salida} onChange={e => setPasajeroForm({ ...pasajeroForm, hotel_salida: e.target.value })} />
                  </Campo>
                  <div className="flex gap-2 mt-1">
                    <button type="button" onClick={() => setCreandoPasajero(false)} className="flex-1 border border-[#E2DFD8] rounded-xl py-2.5 text-sm font-medium">
                      Cancelar
                    </button>
                    <button type="submit" disabled={guardandoPasajero} className="flex-1 bg-[#18181A] text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">
                      {guardandoPasajero ? 'Agregando...' : 'Agregar'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </>
        )}
      </BottomSheet>
    </div>
  )
}
