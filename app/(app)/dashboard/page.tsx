'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase, type Actividad } from '@/lib/supabase'
import { formatCurrency, getMargen } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, DollarSign, Users, Percent, Activity, RefreshCw } from 'lucide-react'

const COLORS = ['#7A4600','#9C6B1F','#B5651D','#D97706','#E8A33D','#F0C674']
const MESES_LABELS: Record<string,string> = {
  '06':'Jun','07':'Jul','08':'Ago','09':'Sep','10':'Oct','11':'Nov','12':'Dic',
  '01':'Ene','02':'Feb','03':'Mar','04':'Abr','05':'May',
}

export default function DashboardPage() {
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [loading, setLoading] = useState(true)
  const [mesActual, setMesActual] = useState('todos')
  const [meses, setMeses] = useState<string[]>([])

  async function cargar() {
    const { data } = await supabase.from('actividades').select('*').order('fecha')
    if (data) {
      setActividades(data)
      const ms = [...new Set(data.map((a:Actividad) => a.fecha.slice(0, 7)))].sort()
      setMeses(ms)
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

  const filtradas = useMemo(() =>
    actividades.filter(a => mesActual === 'todos' || a.fecha.startsWith(mesActual))
  , [actividades, mesActual])

  const totalCobrado = filtradas.reduce((s, a) => s + a.cobro, 0)
  const totalCosto = filtradas.reduce((s, a) => s + a.costo, 0)
  const totalGanancia = filtradas.reduce((s, a) => s + a.ganancia, 0)
  const margen = getMargen(totalCobrado, totalCosto)
  const clientesUnicos = new Set(filtradas.map(a => a.nombre)).size

  // Por mes
  const porMes = useMemo(() => {
    const map: Record<string, { cobrado: number; ganancia: number; count: number }> = {}
    actividades.forEach(a => {
      const m = a.fecha.slice(5, 7)
      if (!map[m]) map[m] = { cobrado: 0, ganancia: 0, count: 0 }
      map[m].cobrado += a.cobro
      map[m].ganancia += a.ganancia
      map[m].count++
    })
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b)).map(([m, v]) => ({
      mes: MESES_LABELS[m] || m, ...v
    }))
  }, [actividades])

  // Top actividades
  const topActividades = useMemo(() => {
    const map: Record<string, number> = {}
    filtradas.forEach(a => { map[a.actividad] = (map[a.actividad] || 0) + a.ganancia })
    return Object.entries(map).sort(([,a],[,b]) => b-a).slice(0,6).map(([name,value]) => ({ name, value }))
  }, [filtradas])

  // Por referido
  const porReferido = useMemo(() => {
    const map: Record<string, number> = {}
    filtradas.forEach(a => { const r = a.referido || 'Directo'; map[r] = (map[r]||0) + a.ganancia })
    return Object.entries(map).sort(([,a],[,b]) => b-a).map(([name, value]) => ({ name, value }))
  }, [filtradas])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <RefreshCw size={24} className="animate-spin mr-2" /> Cargando...
    </div>
  )

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="flex gap-2 items-center">
          <select
            value={mesActual}
            onChange={e => setMesActual(e.target.value)}
            className="text-sm bg-white border border-[#E2DFD8] rounded-xl px-3 py-2 outline-none"
          >
            <option value="todos">Temporada</option>
            {meses.map(m => (
              <option key={m} value={m}>
                {new Date(m+'-01T12:00:00').toLocaleDateString('es-AR',{month:'long'})}
              </option>
            ))}
          </select>
          <button onClick={refrescar} className="p-2 rounded-lg bg-white border border-[#E2DFD8] text-gray-500">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        {[
          { label:'Cobrado', value: formatCurrency(totalCobrado), icon: DollarSign, color:'text-amber-600', bg:'bg-amber-50' },
          { label:'Ganancia', value: formatCurrency(totalGanancia), icon: TrendingUp, color:'text-green-600', bg:'bg-green-50' },
          { label:'Actividades', value: filtradas.length.toString(), icon: Activity, color:'text-[#18181A]', bg:'bg-[#F0EEE9]' },
          { label:'Margen', value: `${margen}%`, icon: Percent, color:'text-amber-600', bg:'bg-amber-50' },
          { label:'Costo total', value: formatCurrency(totalCosto), icon: DollarSign, color:'text-red-500', bg:'bg-red-50' },
          { label:'Clientes únicos', value: clientesUnicos.toString(), icon: Users, color:'text-[#18181A]', bg:'bg-[#F0EEE9]' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-[#E2DFD8] p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${bg}`}>
              <Icon size={16} className={color} />
            </div>
            <div>
              <div className="text-xs text-gray-400">{label}</div>
              <div className={`text-base font-semibold ${color}`}>{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Gráfico por mes */}
      {porMes.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E2DFD8] p-4 mb-4">
          <div className="text-sm font-semibold mb-3 text-[#18181A]">Ganancia por mes</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={porMes} margin={{ top:0, right:0, left:-20, bottom:0 }}>
              <XAxis dataKey="mes" tick={{ fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:10 }} axisLine={false} tickLine={false}
                tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Bar dataKey="ganancia" fill="#D97706" radius={[4,4,0,0]} minPointSize={3} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top actividades */}
      {topActividades.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E2DFD8] p-4 mb-4">
          <div className="text-sm font-semibold mb-3">Top actividades</div>
          <div className="flex flex-col gap-2">
            {topActividades.map(({ name, value }, i) => {
              const max = topActividades[0].value
              return (
                <div key={name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 truncate mr-2">{name}</span>
                    <span className="font-medium text-green-600 shrink-0">{formatCurrency(value)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(value/max)*100}%`, background: COLORS[i % COLORS.length] }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Por referido */}
      {porReferido.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E2DFD8] p-4 mb-4">
          <div className="text-sm font-semibold mb-3">Origen de clientes</div>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={porReferido} cx="50%" cy="50%" innerRadius={30} outerRadius={55}
                  dataKey="value" paddingAngle={2}>
                  {porReferido.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-1.5 flex-1">
              {porReferido.map(({ name, value }, i) => (
                <div key={name} className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-gray-600 truncate flex-1">{name}</span>
                  <span className="font-medium">{formatCurrency(value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
