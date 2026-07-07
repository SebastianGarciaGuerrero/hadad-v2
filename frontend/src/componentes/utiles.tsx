import type { EstadoCobranza } from '../api/tipos'

// Piezas chicas reutilizables: montos en pesos y etiquetas de estado.

const formatoCLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
})

export function Plata({ valor }: { valor: string | number }) {
  return <span className="mono">{formatoCLP.format(Number(valor))}</span>
}

const NOMBRE_ESTADO: Record<EstadoCobranza, string> = {
  activa: 'Activa',
  acuerdo_pago: 'Acuerdo de pago',
  judicial: 'Judicial',
  pagada: 'Pagada',
  archivada: 'Archivada',
  castigo: 'Castigo',
}

export function EtiquetaEstado({ estado }: { estado: EstadoCobranza }) {
  return <span className={`etiqueta etiqueta-${estado}`}>{NOMBRE_ESTADO[estado]}</span>
}

export function fechaLegible(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

export function fechaHoraLegible(iso: string): string {
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
