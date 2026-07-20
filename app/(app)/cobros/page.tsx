'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase, type DeudaPasajero, type Pago } from '@/lib/supabase'
import { formatCurrency, formatDateShort, cn } from '@/lib/utils'
import BottomSheet from '@/components/BottomSheet'
import ErrorBanner from '@/components/ErrorBanner'
import EmptyState from '@/components/EmptyState'
import { Input, Select, Campo } from '@/components/FormField'
import {
  Plus, X, Phone, RefreshCw, ChevronDown, ChevronUp,
  Paperclip, ExternalLink, Search, CheckCircle2,
} from 'lucide-react'

type Metodo = Pago['metodo']
type Tipo = Pago['tipo']

const METODO_LABELS: Record<Metodo, string> = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', mercado_pago: 'Mercado Pago',
  tarjeta: 'Tarjeta', dolares: 'Dólares',
}
const TIPO_LABELS: Record<Tipo, string> = { 'seña': 'Seña', saldo: 'Saldo', total: 'Total' }

const emptyForm = { monto: '', tipo: 'seña' as Tipo, metodo: 'efectivo' as Metodo, fecha: new Date().toISOString().slice(0, 10), notas: '' }

export default function CobrosPage() {
  const [deudas, setDeudas] = useState<DeudaPasajero[]>([])
  const [pasajeroIdPorVp, setPasajeroIdPorVp] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [verTodos, setVerTodos] = useState(false)

  const [modalPago, setModalPago] = useState<DeudaPasajero | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [file, setFile] = useState<File | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [errorPago, setErrorPago] = useState<string | null>(null)

  const [modalBuscar, setModalBuscar] = useState(false)
  const [buscar, setBuscar] = useState('')

  const [expandido, setExpandido] = useState<string | null>(null)
  const [historial, setHistorial] = useState<Record<string, Pago[]>>({})
  const [cargandoHist, setCargandoHist] = useState<string | null>(null)

  async function cargar() {
    const [{ data }, { data: vp }] = await Promise.all([
      supabase.from('deuda_pasajeros').select('*').order('fecha_salida'),
      supabase.from('viaje_pasajeros').select('id, pasajero_id'),
    ])
    if (data) setDeudas(data)
    if (vp) {
      const map: Record<string, string> = {}
      vp.forEach((row: { id: string; pasajero_id: string }) => { map[row.id] = row.pasajero_id })
      setPasajeroIdPorVp(map)
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

  const visibles = useMemo(
    () => verTodos ? deudas : deudas.filter(d => d.debe > 0),
    [deudas, verTodos]
  )
  const totalAdeudado = useMemo(() => deudas.filter(d => d.debe > 0).reduce((s, d) => s + d.debe, 0), [deudas])
  const cantDeudores = useMemo(() => deudas.filter(d => d.debe > 0).length, [deudas])

  const resultadosBusqueda = useMemo(() => {
    if (!buscar.trim()) return []
    const q = buscar.toLowerCase()
    return deudas.filter(d => d.pasajero.toLowerCase().includes(q) || d.viaje.toLowerCase().includes(q)).slice(0, 8)
  }, [buscar, deudas])

  function abrirModalPago(d: DeudaPasajero) {
    setModalBuscar(false)
    setModalPago(d)
    setErrorPago(null)
    setForm({
      ...emptyForm,
      monto: d.debe > 0 ? String(d.debe) : '',
      tipo: d.pagado > 0 ? 'saldo' : 'seña',
    })
    setFile(null)
  }

  function cerrarModalPago() {
    setModalPago(null)
    setForm(emptyForm)
    setFile(null)
  }

  async function registrarPago(e: React.FormEvent) {
    e.preventDefault()
    if (!modalPago || !form.monto) return
    if (Number(form.monto) <= 0) { setErrorPago('El monto tiene que ser mayor a $0.'); return }
    setGuardando(true)
    setErrorPago(null)

    let comprobante_path: string | null = null
    if (file) {
      const nombre = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
      const path = `${modalPago.viaje_pasajero_id}/${Date.now()}-${nombre}`
      const { error: errUpload } = await supabase.storage.from('comprobantes').upload(path, file)
      if (errUpload) {
        setGuardando(false)
        setErrorPago('No se pudo subir el comprobante. Revisá el archivo (máx. 10MB, foto o PDF) e intentá de nuevo.')
        return
      }
      comprobante_path = path
    }

    const { error } = await supabase.from('pagos').insert({
      viaje_pasajero_id: modalPago.viaje_pasajero_id,
      monto: Number(form.monto),
      tipo: form.tipo,
      metodo: form.metodo,
      fecha: form.fecha,
      notas: form.notas || null,
      comprobante_path,
    })

    setGuardando(false)
    if (error) { setErrorPago('No se pudo registrar el pago. Probá de nuevo.'); return }
    const vpId = modalPago.viaje_pasajero_id
    cerrarModalPago()
    cargar()
    if (expandido === vpId) toggleHistorial(vpId, true)
  }

  async function toggleHistorial(id: string, forzarRecarga = false) {
    if (expandido === id && !forzarRecarga) {
      setExpandido(null)
      return
    }
    setExpandido(id)
    setCargandoHist(id)
    const { data } = await supabase.from('pagos').select('*').eq('viaje_pasajero_id', id).order('fecha', { ascending: false })
    if (data) setHistorial(prev => ({ ...prev, [id]: data }))
    setCargandoHist(null)
  }

  async function verComprobante(path: string) {
    const { data } = await supabase.storage.from('comprobantes').createSignedUrl(path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
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
        <h1 className="text-xl font-semibold">Cobros</h1>
        <div className="flex items-center gap-2">
          <button onClick={refrescar} className="p-2 rounded-lg bg-white border border-[#E2DFD8] text-gray-500">
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => { setBuscar(''); setModalBuscar(true) }}
            className="flex items-center gap-1.5 bg-[#18181A] text-white text-sm font-medium px-3 py-2 rounded-xl"
          >
            <Plus size={16} /> Registrar pago
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-white rounded-xl p-3 border border-[#E2DFD8]">
          <div className="text-xs text-gray-400 mb-1">Total adeudado</div>
          <div className="text-lg font-semibold text-red-500">{formatCurrency(totalAdeudado)}</div>
        </div>
        <div className="bg-white rounded-xl p-3 border border-[#E2DFD8]">
          <div className="text-xs text-gray-400 mb-1">Deudores</div>
          <div className="text-lg font-semibold">{cantDeudores}</div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-500">
          {verTodos ? 'Todos los pasajeros' : 'Con deuda pendiente'}
        </span>
        <button onClick={() => setVerTodos(v => !v)} className="text-xs text-amber-600 font-medium">
          {verTodos ? 'Ver solo deudas' : 'Ver todos'}
        </button>
      </div>

      {visibles.length === 0 ? (
        verTodos ? (
          <EmptyState title="Todavía no hay pasajeros con pagos registrados" description="Asigná pasajeros a un viaje desde Grupos." />
        ) : (
          <div className="bg-green-50 rounded-2xl border border-green-200 p-10 text-center">
            <CheckCircle2 size={40} className="mx-auto mb-4 text-green-600" />
            <h2 className="text-base font-semibold text-[#18181A] mb-2">Sin deudas pendientes</h2>
            <p className="text-sm text-gray-500">Todos los pasajeros confirmados están al día.</p>
          </div>
        )
      ) : (
        <div className="flex flex-col gap-3">
          {visibles.map(d => (
            <div
              key={d.viaje_pasajero_id}
              className={cn(
                'bg-white rounded-2xl border-y border-r border-[#E2DFD8] border-l-4 overflow-hidden',
                d.debe > 0 ? 'border-l-red-400' : 'border-l-green-400'
              )}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  {pasajeroIdPorVp[d.viaje_pasajero_id] ? (
                    <Link
                      href={`/pasajeros?id=${pasajeroIdPorVp[d.viaje_pasajero_id]}`}
                      className="font-semibold text-[#18181A] text-sm hover:text-amber-600 hover:underline"
                    >
                      {d.pasajero}
                    </Link>
                  ) : (
                    <span className="font-semibold text-[#18181A] text-sm">{d.pasajero}</span>
                  )}
                  <span className={cn('text-xs px-2 py-0.5 rounded-full border shrink-0',
                    d.debe > 0 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-700 border-green-200')}>
                    {d.debe > 0 ? `Debe ${formatCurrency(d.debe)}` : 'Al día'}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mb-3">
                  {d.viaje} · {formatDateShort(d.fecha_salida)}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div className="bg-[#F0EEE9] rounded-lg p-2">
                    <div className="text-gray-400 mb-0.5">Precio base</div>
                    <div className="font-medium">{formatCurrency(d.precio_base)}</div>
                  </div>
                  <div className="bg-[#F0EEE9] rounded-lg p-2">
                    <div className="text-gray-400 mb-0.5">Pagado</div>
                    <div className="font-medium text-amber-600">{formatCurrency(d.pagado)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => abrirModalPago(d)}
                    className="flex-1 bg-[#18181A] text-white rounded-xl py-2 text-xs font-semibold"
                  >
                    Registrar pago
                  </button>
                  {d.telefono && (
                    <button onClick={() => abrirWA(d.telefono)} className="p-2 rounded-xl bg-green-50 text-green-600 border border-green-200">
                      <Phone size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => toggleHistorial(d.viaje_pasajero_id)}
                    className="p-2 rounded-xl bg-[#F0EEE9] text-gray-500"
                  >
                    {expandido === d.viaje_pasajero_id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>

              {expandido === d.viaje_pasajero_id && (
                <div className="border-t border-[#E2DFD8] bg-[#FAFAF8] p-3">
                  {cargandoHist === d.viaje_pasajero_id ? (
                    <div className="text-xs text-gray-400 text-center py-2">Cargando historial...</div>
                  ) : (historial[d.viaje_pasajero_id]?.length ?? 0) === 0 ? (
                    <div className="text-xs text-gray-400 text-center py-2">Sin pagos registrados todavía</div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {historial[d.viaje_pasajero_id].map(p => (
                        <div key={p.id} className="flex items-center justify-between bg-white rounded-lg px-2.5 py-2 text-xs border border-[#E2DFD8]">
                          <div>
                            <span className="font-medium">{formatCurrency(p.monto)}</span>
                            <span className="text-gray-400"> · {TIPO_LABELS[p.tipo]} · {METODO_LABELS[p.metodo]}</span>
                            <div className="text-gray-400">{formatDateShort(p.fecha)}{p.notas && ` · ${p.notas}`}</div>
                          </div>
                          {p.comprobante_path && (
                            <button onClick={() => verComprobante(p.comprobante_path!)} className="text-amber-600 flex items-center gap-1 shrink-0">
                              <Paperclip size={12} /> <ExternalLink size={10} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal: buscar pasajero para registrar pago */}
      <BottomSheet open={modalBuscar} onClose={() => setModalBuscar(false)} className="max-h-[80vh]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Elegí un pasajero</h2>
          <button onClick={() => setModalBuscar(false)}><X size={20} className="text-gray-400" /></button>
        </div>
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            autoFocus
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            placeholder="Buscar por nombre o viaje..."
            className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-[#E2DFD8] rounded-xl outline-none focus:border-amber-400"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          {resultadosBusqueda.map(d => (
            <div
              key={d.viaje_pasajero_id}
              onClick={() => abrirModalPago(d)}
              className="bg-[#F0EEE9] rounded-xl px-3 py-2.5 cursor-pointer hover:bg-amber-50 flex items-center justify-between"
            >
              <div>
                <div className="text-sm font-medium">{d.pasajero}</div>
                <div className="text-xs text-gray-400">{d.viaje}</div>
              </div>
              <span className={cn('text-xs font-medium', d.debe > 0 ? 'text-red-500' : 'text-green-600')}>
                {d.debe > 0 ? `Debe ${formatCurrency(d.debe)}` : 'Al día'}
              </span>
            </div>
          ))}
          {buscar.trim() && resultadosBusqueda.length === 0 && (
            <div className="text-center text-sm text-gray-400 py-6">Sin resultados</div>
          )}
        </div>
      </BottomSheet>

      {/* Modal: registrar pago */}
      <BottomSheet open={!!modalPago} onClose={cerrarModalPago}>
        {modalPago && (
          <>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold">Registrar pago</h2>
              <button onClick={cerrarModalPago}><X size={20} className="text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              {modalPago.pasajero} · {modalPago.viaje}
              {modalPago.debe > 0 && <span className="text-red-500 font-medium"> · Debe {formatCurrency(modalPago.debe)}</span>}
            </p>

            <ErrorBanner message={errorPago} />

            <form onSubmit={registrarPago} className="flex flex-col gap-3">
              <Campo label="Monto">
                <Input
                  required type="number" min="0.01" step="0.01"
                  value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })}
                />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Tipo">
                  <Select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value as Tipo })}>
                    {(Object.keys(TIPO_LABELS) as Tipo[]).map(k => <option key={k} value={k}>{TIPO_LABELS[k]}</option>)}
                  </Select>
                </Campo>
                <Campo label="Método">
                  <Select value={form.metodo} onChange={e => setForm({ ...form, metodo: e.target.value as Metodo })}>
                    {(Object.keys(METODO_LABELS) as Metodo[]).map(k => <option key={k} value={k}>{METODO_LABELS[k]}</option>)}
                  </Select>
                </Campo>
              </div>
              <Campo label="Fecha">
                <Input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
              </Campo>
              <Campo label="Notas">
                <Input
                  value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })}
                  placeholder="Opcional"
                />
              </Campo>
              <Campo label="Comprobante (foto o PDF)">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                  className="text-xs text-gray-500 file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-[#F0EEE9] file:text-xs file:font-medium"
                />
              </Campo>
              <button
                type="submit"
                disabled={guardando}
                className="w-full bg-[#18181A] text-white rounded-xl py-3 font-semibold mt-2 disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : 'Registrar pago'}
              </button>
            </form>
          </>
        )}
      </BottomSheet>
    </div>
  )
}
