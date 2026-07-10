import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Cobranza, Cliente, EstadoCobranza } from '../api/tipos'
import { EtiquetaEstado, Plata } from '../componentes/utiles'

const ESTADOS: EstadoCobranza[] = [
  'activa', 'acuerdo_pago', 'judicial', 'pagada', 'archivada', 'castigo',
]

export default function Cobranzas() {
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('')
  const [clienteId, setClienteId] = useState('')

  const { data: clientes } = useQuery({
    queryKey: ['clientes'],
    queryFn: async () => (await api.get<Cliente[]>('/clientes/')).data,
  })

  // Si hay texto de búsqueda usa /buscar; si no, lista con filtros.
  const { data: cobranzas, isLoading } = useQuery({
    queryKey: ['cobranzas', busqueda, estado, clienteId],
    queryFn: async () => {
      if (busqueda.trim()) {
        const { data } = await api.get<Cobranza[]>('/cobranzas/buscar', {
          params: { q: busqueda.trim() },
        })
        return data
      }
      const params: Record<string, string> = {}
      if (estado) params.estado = estado
      if (clienteId) params.cliente_id = clienteId
      return (await api.get<Cobranza[]>('/cobranzas/', { params })).data
    },
  })

  return (
    <>
      <header className="pagina-cabecera">
        <h1>Cobranzas</h1>
      </header>

      <div className="filtros">
        <input
          className="buscador"
          placeholder="Buscar por N° Hadad, ID cliente, RUT o nombre del deudor…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <select value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>{e.replace('_', ' ')}</option>
          ))}
        </select>
        <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
          <option value="">Todos los clientes</option>
          {clientes?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre_fantasia ?? c.razon_social}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="pantalla-carga">Cargando cobranzas…</div>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <th>N° Hadad</th>
              <th>ID cliente</th>
              <th>Estado</th>
              <th className="der">Deuda original</th>
              <th className="der">Saldo actual</th>
              <th>Ingreso</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cobranzas?.map((c) => (
              <tr key={c.id}>
                <td className="mono negrita">{c.numero}</td>
                <td className="mono">{c.id_clinica ?? '—'}</td>
                <td><EtiquetaEstado estado={c.estado} /></td>
                <td className="der"><Plata valor={c.monto_original} /></td>
                <td className="der"><Plata valor={c.monto_actual} /></td>
                <td>{c.fecha_ingreso_hadad ?? '—'}</td>
                <td>
                  <Link className="btn btn-chico btn-secundario" to={`/cobranzas/${c.id}`}>
                    Ver ficha
                  </Link>
                </td>
              </tr>
            ))}
            {cobranzas?.length === 0 && (
              <tr><td colSpan={7} className="vacio">Sin resultados</td></tr>
            )}
          </tbody>
        </table>
      )}
    </>
  )
}
