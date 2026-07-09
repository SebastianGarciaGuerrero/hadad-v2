import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, mensajeDeError } from '../api/client'

// Alta de deudor con sus contactos (teléfonos/emails) en una transacción.

interface FilaContacto {
  tipo: string
  valor: string
}

export default function NuevoDeudor({ alCrear }: { alCrear?: () => void }) {
  const qc = useQueryClient()
  const [abierto, setAbierto] = useState(false)
  const [rut, setRut] = useState('')
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState('natural')
  const [comuna, setComuna] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [contactos, setContactos] = useState<FilaContacto[]>([
    { tipo: 'celular', valor: '' },
  ])
  const [error, setError] = useState('')

  function limpiar() {
    setRut(''); setNombre(''); setTipo('natural'); setComuna('')
    setCiudad(''); setObservaciones('')
    setContactos([{ tipo: 'celular', valor: '' }])
    setError('')
  }

  const crear = useMutation({
    mutationFn: async () => {
      await api.post('/deudores/', {
        rut: rut.trim(),
        nombre: nombre.trim(),
        tipo,
        comuna: comuna || null,
        ciudad: ciudad || null,
        observaciones: observaciones || null,
        contactos: contactos.filter((c) => c.valor.trim() !== ''),
      })
    },
    onSuccess: () => {
      limpiar()
      setAbierto(false)
      qc.invalidateQueries({ queryKey: ['deudores'] })
      alCrear?.()
    },
    onError: (err) => setError(mensajeDeError(err)),
  })

  if (!abierto) {
    return (
      <button className="btn btn-primario" onClick={() => setAbierto(true)}>
        + Nuevo deudor
      </button>
    )
  }

  function alEnviar(e: FormEvent) {
    e.preventDefault()
    setError('')
    crear.mutate()
  }

  function editarContacto(i: number, campo: keyof FilaContacto, valor: string) {
    setContactos(contactos.map((c, j) => (j === i ? { ...c, [campo]: valor } : c)))
  }

  return (
    <form className="form-finanzas form-alta" onSubmit={alEnviar}>
      <h3>Nuevo deudor</h3>
      <div className="fila">
        <label>
          RUT *
          <input value={rut} onChange={(e) => setRut(e.target.value)}
            placeholder="12345678-9" required minLength={8} maxLength={12} />
        </label>
        <label>
          Nombre completo *
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </label>
        <label>
          Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="natural">Persona natural</option>
            <option value="juridica">Persona jurídica</option>
          </select>
        </label>
      </div>
      <div className="fila">
        <label>
          Comuna
          <input value={comuna} onChange={(e) => setComuna(e.target.value)} />
        </label>
        <label>
          Ciudad
          <input value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
        </label>
      </div>

      <div>
        <div className="suave" style={{ marginBottom: 6 }}>Contactos</div>
        {contactos.map((c, i) => (
          <div className="fila fila-contacto" key={i}>
            <select value={c.tipo} onChange={(e) => editarContacto(i, 'tipo', e.target.value)}>
              <option value="celular">Celular</option>
              <option value="telefono">Teléfono</option>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="otro">Otro</option>
            </select>
            <input
              value={c.valor}
              onChange={(e) => editarContacto(i, 'valor', e.target.value)}
              placeholder="+56 9 1234 5678 / correo@…"
            />
            <button type="button" className="btn btn-chico btn-secundario"
              onClick={() => setContactos(contactos.filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-chico btn-secundario"
          onClick={() => setContactos([...contactos, { tipo: 'celular', valor: '' }])}>
          + Agregar contacto
        </button>
      </div>

      <label>
        Observaciones
        <textarea rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
      </label>

      {error && <div className="alerta-error">{error}</div>}
      <div className="fila">
        <button className="btn btn-primario" disabled={crear.isPending}>
          {crear.isPending ? 'Creando…' : 'Crear deudor'}
        </button>
        <button type="button" className="btn btn-secundario"
          onClick={() => { limpiar(); setAbierto(false) }}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
