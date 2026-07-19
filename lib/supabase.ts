import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      actividades: {
        Row: Actividad
        Insert: Omit<Actividad, 'id' | 'created_at'>
        Update: Partial<Omit<Actividad, 'id' | 'created_at'>>
      }
      viajes: {
        Row: Viaje
        Insert: Omit<Viaje, 'id' | 'created_at'>
        Update: Partial<Omit<Viaje, 'id' | 'created_at'>>
      }
      pasajeros: {
        Row: Pasajero
        Insert: Omit<Pasajero, 'id' | 'created_at'>
        Update: Partial<Omit<Pasajero, 'id' | 'created_at'>>
      }
      viaje_pasajeros: {
        Row: ViajePasajero
        Insert: Omit<ViajePasajero, 'id' | 'created_at'>
        Update: Partial<Omit<ViajePasajero, 'id' | 'created_at'>>
      }
      pagos: {
        Row: Pago
        Insert: Omit<Pago, 'id' | 'created_at'>
        Update: Partial<Omit<Pago, 'id' | 'created_at'>>
      }
    }
    Views: {
      deuda_pasajeros: {
        Row: DeudaPasajero
      }
    }
  }
}

export type Actividad = {
  id: string
  created_at: string
  fecha: string
  actividad: string
  nombre: string
  hotel: string | null
  telefono: string | null
  pax_mayor: number
  pax_menor: number
  pax_infante: number
  pax_jubilado: number
  pax_total: number
  cobro: number
  costo: number
  ganancia: number
  proveedor: string | null
  referido: string | null
  temporada: string
  pasajero_id: string | null
}

export type Viaje = {
  id: string
  created_at: string
  nombre: string
  destino: string
  fecha_salida: string
  fecha_regreso: string | null
  cupo_max: number
  precio_base: number
  proveedor: string | null
  estado: 'borrador' | 'confirmado' | 'en_espera' | 'cancelado'
  temporada: string
  notas: string | null
}

export type Pasajero = {
  id: string
  created_at: string
  nombre: string
  apellido: string
  dni: string | null
  telefono: string | null
  email: string | null
  fecha_nacimiento: string | null
  hotel_salida: string | null
  notas: string | null
}

export type ViajePasajero = {
  id: string
  viaje_id: string
  pasajero_id: string
  estado: 'confirmado' | 'en_espera' | 'cancelado'
  created_at: string
}

export type DeudaPasajero = {
  viaje_pasajero_id: string
  viaje: string
  fecha_salida: string
  pasajero: string
  telefono: string | null
  precio_base: number
  pagado: number
  debe: number
}

export type Pago = {
  id: string
  created_at: string
  viaje_pasajero_id: string
  monto: number
  tipo: 'seña' | 'saldo' | 'total'
  metodo: 'efectivo' | 'transferencia' | 'mercado_pago' | 'tarjeta' | 'dolares'
  fecha: string
  notas: string | null
  comprobante_path: string | null
}
