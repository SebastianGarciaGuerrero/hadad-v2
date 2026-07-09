import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api, descargarArchivo as descargar, mensajeDeError } from '../api/client'
import type { Cliente } from '../api/tipos'

interface ResultadoImportacion {
  filas_procesadas: number
  cobranzas_creadas: number
  deudores_nuevos: number
  errores: { fila: number; error: string }[]
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export default function Informes() {
  const hoy = new Date()
  const [dias, setDias] = useState('15')
  const [clienteId, setClienteId] = useState('')
  const [mes, setMes] = useState(String(hoy.getMonth() + 1))
  const [anio, setAnio] = useState(String(hoy.getFullYear()))

  const { data: clientes } = useQuery({
    queryKey: ['clientes'],
    queryFn: async () => (await api.get<Cliente[]>('/clientes/')).data,
  })

  const filtroCliente: Record<string, string> = clienteId
    ? { cliente_id: clienteId }
    : {}

  return (
    <>
      <header className="pagina-cabecera">
        <h1>Informes</h1>
      </header>

      <div className="filtros">
        <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
          <option value="">Todos los clientes</option>
          {clientes?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre_fantasia ?? c.razon_social}
            </option>
          ))}
        </select>
      </div>

      <div className="informes-grilla">
        <section className="tarjeta">
          <h2>📋 Gestiones recientes</h2>
          <p className="suave">
            Todas las gestiones realizadas en los últimos días, con deudor,
            tipo y quién la registró.
          </p>
          <div className="fila">
            <label>
              Últimos
              <select value={dias} onChange={(e) => setDias(e.target.value)}>
                <option value="7">7 días</option>
                <option value="15">15 días</option>
                <option value="30">30 días</option>
                <option value="45">45 días</option>
              </select>
            </label>
          </div>
          <button
            className="btn btn-primario"
            onClick={() => descargar('/exportar/gestiones', { dias, ...filtroCliente })}
          >
            ⬇ Descargar Excel
          </button>
        </section>

        <section className="tarjeta">
          <h2>💰 Recupero mensual</h2>
          <p className="suave">
            Detalle de cada pago del mes con su desglose capital /
            honorarios / interés.
          </p>
          <div className="fila">
            <select value={mes} onChange={(e) => setMes(e.target.value)}>
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <input
              type="number"
              className="anio"
              value={anio}
              onChange={(e) => setAnio(e.target.value)}
            />
          </div>
          <button
            className="btn btn-primario"
            onClick={() => descargar('/exportar/recupero', { mes, anio, ...filtroCliente })}
          >
            ⬇ Descargar Excel
          </button>
        </section>

        <section className="tarjeta">
          <h2>🏥 Cuadro de rendición</h2>
          <p className="suave">
            Resumen por cliente y filial: cuánto se rinde a la clínica en el
            mes. Usa el mismo mes y año del recupero.
          </p>
          <button
            className="btn btn-primario"
            onClick={() => descargar('/exportar/rendicion', { mes, anio, ...filtroCliente })}
          >
            ⬇ Descargar Excel
          </button>
        </section>

        <CargaMasiva />
      </div>
    </>
  )
}

// ------------------------------------------------------------
// Carga masiva: plantilla + subida del Excel lleno
// ------------------------------------------------------------

function CargaMasiva() {
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null)
  const [error, setError] = useState('')

  const subir = useMutation({
    mutationFn: async (archivo: File) => {
      const form = new FormData()
      form.append('archivo', archivo)
      const { data } = await api.post<ResultadoImportacion>('/importar/cobranzas', form)
      return data
    },
    onSuccess: (data) => { setResultado(data); setError('') },
    onError: (err) => { setResultado(null); setError(mensajeDeError(err)) },
  })

  function alElegirArchivo(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (archivo) subir.mutate(archivo)
    e.target.value = ''  // permite volver a subir el mismo archivo
  }

  return (
    <section className="tarjeta">
      <h2>📥 Carga masiva</h2>
      <p className="suave">
        Ingresa muchas cobranzas de una vez: descarga la plantilla, llénala
        (una fila por cobranza) y súbela. Los deudores nuevos se crean solos
        por RUT; el cliente debe existir en el sistema.
      </p>
      <div className="fila">
        <button
          className="btn btn-secundario"
          onClick={() => descargar('/importar/plantilla')}
        >
          ⬇ Descargar plantilla
        </button>
        <label className="btn btn-primario subir-archivo">
          {subir.isPending ? 'Procesando…' : '⬆ Subir Excel lleno'}
          <input
            type="file"
            accept=".xlsx"
            onChange={alElegirArchivo}
            disabled={subir.isPending}
            hidden
          />
        </label>
      </div>

      {error && <div className="alerta-error">{error}</div>}
      {resultado && (
        <div className="resultado-carga">
          <p>
            ✅ <strong>{resultado.cobranzas_creadas}</strong> cobranzas creadas
            de {resultado.filas_procesadas} filas
            ({resultado.deudores_nuevos} deudores nuevos).
          </p>
          {resultado.errores.length > 0 && (
            <>
              <p className="suave">Filas con problemas ({resultado.errores.length}):</p>
              <ul className="lista-errores">
                {resultado.errores.map((e) => (
                  <li key={e.fila}>
                    <span className="mono">Fila {e.fila}:</span> {e.error}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  )
}
