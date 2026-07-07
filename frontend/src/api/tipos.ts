// Tipos TypeScript que reflejan los schemas Pydantic del backend.
// Si el backend cambia un schema, actualizar aquí.

export interface Usuario {
  id: string
  nombre: string
  email: string
  rol_id: number
  activo: boolean
}

export interface Cliente {
  id: string
  rut: string
  razon_social: string
  nombre_fantasia: string | null
}

export interface Filial {
  id: number
  cliente_id: string
  nombre: string
  activo: boolean
}

export interface Deudor {
  id: string
  rut: string
  tipo: 'natural' | 'juridica'
  nombre: string
  comuna: string | null
  ciudad: string | null
  en_dicom: boolean
  observaciones: string | null
}

export interface Contacto {
  id: string
  deudor_id: string
  tipo: 'telefono' | 'celular' | 'email' | 'whatsapp' | 'otro'
  valor: string
  activo: boolean
}

export interface DeudorDetalle extends Deudor {
  contactos: Contacto[]
}

export type EstadoCobranza =
  | 'activa' | 'acuerdo_pago' | 'judicial' | 'pagada' | 'archivada' | 'castigo'

export interface Cobranza {
  id: string
  numero: number
  cliente_id: string
  deudor_id: string
  filial_id: number | null
  id_clinica: string | null
  monto_original: string
  monto_actual: string
  estado: EstadoCobranza
  tipo: 'extrajudicial' | 'judicial'
  fecha_ingreso_hadad: string | null
  observaciones: string | null
}

export interface CobranzaDetalle extends Cobranza {
  cliente: Cliente | null
  filial: Filial | null
  deudor: Deudor | null
}

export interface TipoGestion {
  id: number
  nombre: string
  activo: boolean
}

export interface Gestion {
  id: string
  cobranza_id: string
  usuario_id: string
  tipo_id: number | null
  descripcion: string
  fecha_gestion: string
  fecha_proximo_contacto: string | null
}
