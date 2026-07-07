import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, mensajeDeError } from '../api/client'
import type { CobranzaDetalle as Ficha, Gestion, TipoGestion } from '../api/tipos'
import { EtiquetaEstado, Plata, fechaLegible, fechaHoraLegible } from '../componentes/utiles'

// La pantalla más usada del sistema: la ficha de una cobranza con su
// historial de gestiones y el formulario para registrar la siguiente.

export default function CobranzaDetalle() {
  const { id } = useParams()
  const cliente = useQueryClient()

  const { data: cob, isLoading } = useQuery({
    queryKey: ['cobranza', id],
    queryFn: async () => (await api.get<Ficha>(`/cobranzas/${id}`)).data,
  })

  const { data: gestiones } = useQuery({
    queryKey: ['gestiones', id],
    queryFn: async () =>
      (await api.get<Gestion[]>('/gestiones/', { params: { cobranza_id: id } })).data,
  })

  const { data: tipos } = useQuery({
    queryKey: ['tipos-gestion'],
    queryFn: async () => (await api.get<TipoGestion[]>('/gestiones/tipos')).data,
  })

  // --- Formulario de nueva gestión ---
  const [tipoId, setTipoId] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [proximoContacto, setProximoContacto] = useState('')
  const [error, setError] = useState('')

  const crearGestion = useMutation({
    mutationFn: async () => {
      const cuerpo: Record<string, unknown> = {
        cobranza_id: id,
        descripcion,
      }
      if (tipoId) cuerpo.tipo_id = Number(tipoId)
      if (proximoContacto) cuerpo.fecha_proximo_contacto = proximoContacto
      await api.post('/gestiones/', cuerpo)
    },
    onSuccess: () => {
      setDescripcion('')
      setProximoContacto('')
      setError('')
      cliente.invalidateQueries({ queryKey: ['gestiones', id] })
    },
    onError: (err) => setError(mensajeDeError(err)),
  })

  if (isLoading || !cob) return <div className="pantalla-carga">Cargando ficha…</div>

  const nombreTipo = (tipo_id: number | null) =>
    tipos?.find((t) => t.id === tipo_id)?.nombre ?? 'Gestión'

  return (
    <>
      <header className="pagina-cabecera">
        <div>
          <Link to="/cobranzas" className="volver">← Cobranzas</Link>
          <h1>
            Cobranza N° {cob.numero}{' '}
            <EtiquetaEstado estado={cob.estado} />
          </h1>
        </div>
      </header>

      <div className="ficha-grilla">
        {/* Columna izquierda: datos del caso */}
        <section className="tarjeta">
          <h2>Datos del caso</h2>
          <dl className="datos">
            <dt>Deudor</dt>
            <dd>
              <strong>{cob.deudor?.nombre ?? '—'}</strong>
              <span className="mono suave"> {cob.deudor?.rut}</span>
              {cob.deudor?.en_dicom && <span className="etiqueta etiqueta-castigo">DICOM</span>}
            </dd>
            <dt>Cliente</dt>
            <dd>
              {cob.cliente?.nombre_fantasia ?? cob.cliente?.razon_social ?? '—'}
              {cob.filial && <span className="suave"> · {cob.filial.nombre}</span>}
            </dd>
            <dt>ID clínica</dt>
            <dd className="mono">{cob.id_clinica ?? '—'}</dd>
            <dt>Deuda original</dt>
            <dd><Plata valor={cob.monto_original} /></dd>
            <dt>Saldo actual</dt>
            <dd className="negrita"><Plata valor={cob.monto_actual} /></dd>
            <dt>Ingreso a Hadad</dt>
            <dd>{fechaLegible(cob.fecha_ingreso_hadad)}</dd>
            <dt>Tipo</dt>
            <dd>{cob.tipo}</dd>
          </dl>
          {cob.observaciones && (
            <p className="observaciones">{cob.observaciones}</p>
          )}
        </section>

        {/* Columna derecha: gestiones */}
        <section className="tarjeta">
          <h2>Registrar gestión</h2>
          <form
            className="form-gestion"
            onSubmit={(e) => {
              e.preventDefault()
              crearGestion.mutate()
            }}
          >
            <div className="fila">
              <select value={tipoId} onChange={(e) => setTipoId(e.target.value)} required>
                <option value="">Tipo de gestión…</option>
                {tipos?.map((t) => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
              <label className="proximo">
                Próximo contacto
                <input
                  type="date"
                  value={proximoContacto}
                  onChange={(e) => setProximoContacto(e.target.value)}
                />
              </label>
            </div>
            <textarea
              placeholder="¿Qué pasó? Ej: Llamada a don Pedro, se compromete a pagar el día 5…"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              required
            />
            {error && <div className="alerta-error">{error}</div>}
            <button className="btn btn-primario" disabled={crearGestion.isPending}>
              {crearGestion.isPending ? 'Guardando…' : 'Registrar gestión'}
            </button>
            <p className="nota">
              Las gestiones son inmutables: no se pueden editar ni borrar después.
            </p>
          </form>

          <h2>Historial ({gestiones?.length ?? 0})</h2>
          <ul className="linea-tiempo">
            {gestiones?.map((g) => (
              <li key={g.id}>
                <div className="gestion-cabecera">
                  <span className="gestion-tipo">{nombreTipo(g.tipo_id)}</span>
                  <span className="suave">{fechaHoraLegible(g.fecha_gestion)}</span>
                </div>
                <p>{g.descripcion}</p>
                {g.fecha_proximo_contacto && (
                  <div className="proximo-aviso">
                    📅 Próximo contacto: {fechaLegible(g.fecha_proximo_contacto)}
                  </div>
                )}
              </li>
            ))}
            {gestiones?.length === 0 && (
              <li className="vacio">Aún no hay gestiones registradas.</li>
            )}
          </ul>
        </section>
      </div>
    </>
  )
}
