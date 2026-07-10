import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api, descargarArchivo, mensajeDeError } from '../api/client'

// Carga masiva de cobranzas: descargar la plantilla, llenarla (una fila por
// cobranza) y subirla. Cada fila es independiente: las buenas entran aunque
// otras fallen, y se reporta fila por fila qué falló y por qué.

interface ResultadoImportacion {
  filas_procesadas: number
  cobranzas_creadas: number
  deudores_nuevos: number
  errores: { fila: number; error: string }[]
}

const CAMPOS: [string, boolean, string][] = [
  // [columna, obligatorio, descripción]
  ['RUT deudor', true, 'Formato 12345678-9. Si el deudor ya existe, se reutiliza (no se duplica).'],
  ['Nombre deudor', true, 'Nombre completo. Solo se usa si el deudor es nuevo.'],
  ['Teléfono', false, 'Se guarda como contacto del deudor (si es nuevo).'],
  ['Email', false, 'Se guarda como contacto del deudor (si es nuevo).'],
  ['Cliente', true, 'Debe existir en el sistema (ej: Redsalud, COPEC). Se busca por nombre.'],
  ['Filial', false, 'Sucursal del cliente (ej: Valparaíso). Debe existir si se indica.'],
  ['ID cliente', false, 'N° interno del cliente (SAP, HIS…). No puede repetirse para el mismo cliente.'],
  ['Monto deuda', true, 'Capital adeudado, solo números (ej: 450000).'],
  ['Tipo documento', false, 'pagare, factura, letra, cheque u otro. Si se omite: pagare.'],
  ['N° documento', false, 'N° del pagaré, factura, etc.'],
  ['Fecha atención', false, 'Formato AAAA-MM-DD (ej: 2026-05-12).'],
  ['Previsión', false, 'FONASA, ISAPRE…'],
  ['Observaciones', false, 'Texto libre.'],
]

export default function CargaMasiva() {
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
    e.target.value = ''
  }

  return (
    <>
      <header className="pagina-cabecera">
        <h1>Carga masiva de cobranzas</h1>
      </header>

      <div className="ficha-grilla">
        <section className="tarjeta">
          <h2>Paso 1 · Descargar formato</h2>
          <p className="suave">
            Descarga el Excel de formato, llénalo con una fila por cobranza y
            guárdalo. La primera fila trae un ejemplo que puedes borrar.
          </p>
          <button
            className="btn btn-secundario"
            onClick={() => descargarArchivo('/importar/plantilla')}
          >
            ⬇ Descargar Excel de formato
          </button>

          <h2 className="separado">Paso 2 · Subir el archivo lleno</h2>
          <p className="suave">
            Las filas correctas se ingresan aunque otras tengan errores; abajo
            verás el detalle de las que fallaron para corregirlas y resubirlas.
          </p>
          <label className="btn btn-primario subir-archivo">
            {subir.isPending ? 'Procesando…' : '⬆ Subir formato lleno'}
            <input type="file" accept=".xlsx" onChange={alElegirArchivo}
              disabled={subir.isPending} hidden />
          </label>

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

        <section className="tarjeta">
          <h2>Columnas del formato</h2>
          <table className="tabla">
            <thead>
              <tr><th>Columna</th><th>¿Obligatoria?</th><th>Detalle</th></tr>
            </thead>
            <tbody>
              {CAMPOS.map(([nombre, obligatorio, detalle]) => (
                <tr key={nombre}>
                  <td className="negrita">{nombre}</td>
                  <td>
                    {obligatorio
                      ? <span className="etiqueta etiqueta-castigo">Obligatoria</span>
                      : <span className="etiqueta etiqueta-archivada">Opcional</span>}
                  </td>
                  <td className="suave">{detalle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  )
}
