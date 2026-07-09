import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { ReporteUsuario } from '../api/tipos'
import { Plata } from '../componentes/utiles'

// Panel de control del admin: productividad de cada trabajador.
// Cuántas gestiones hizo (y de qué tipo), acuerdos, pagos y montos.

export default function Equipo() {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const { data: reporte, isLoading } = useQuery({
    queryKey: ['reporte-equipo', desde, hasta],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (desde) params.desde = desde
      if (hasta) params.hasta = hasta
      return (await api.get<ReporteUsuario[]>('/reportes/equipo', { params })).data
    },
  })

  return (
    <>
      <header className="pagina-cabecera">
        <h1>Equipo</h1>
      </header>

      <div className="filtros">
        <label>
          Desde
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
      </div>

      {isLoading ? (
        <div className="pantalla-carga">Cargando reporte…</div>
      ) : (
        <div className="equipo-grilla">
          {reporte?.map((u) => (
            <section className="tarjeta" key={u.usuario_id}>
              <h2>
                {u.nombre}
                {!u.activo && <span className="etiqueta etiqueta-archivada">inactivo</span>}
              </h2>
              <dl className="datos">
                <dt>Gestiones</dt>
                <dd className="negrita">{u.gestiones_total}</dd>
                <dt>Acuerdos creados</dt>
                <dd>{u.acuerdos_creados}</dd>
                <dt>Pagos ingresados</dt>
                <dd>{u.pagos_ingresados}</dd>
                <dt>Monto recaudado</dt>
                <dd><Plata valor={u.monto_pagos} /></dd>
              </dl>
              {Object.keys(u.gestiones_por_tipo).length > 0 && (
                <>
                  <h2 className="separado">Por tipo de gestión</h2>
                  <ul className="lista-tipos">
                    {Object.entries(u.gestiones_por_tipo)
                      .sort(([, a], [, b]) => b - a)
                      .map(([tipo, n]) => (
                        <li key={tipo}>
                          <span>{tipo}</span>
                          <span className="mono negrita">{n}</span>
                        </li>
                      ))}
                  </ul>
                </>
              )}
            </section>
          ))}
        </div>
      )}
    </>
  )
}
