/*
 * MODO DEMO: backend simulado dentro del navegador.
 *
 * Cuando la app se compila con `npm run build:demo`, este adaptador
 * reemplaza las llamadas HTTP de axios: los datos viven en localStorage
 * del navegador de quien mira la demo. Sirve para publicar SOLO el
 * frontend (ej. Vercel) y que se pueda "jugar" con datos de práctica
 * sin servidor ni base de datos.
 *
 * Replica las reglas de negocio clave del backend real:
 *  - solo el CAPITAL descuenta el saldo de la cobranza
 *  - cuotas → pagada / pagada_parcial; todas pagadas → acuerdo cumplido
 *  - gestiones automáticas (ACUERDO DE PAGO, ABONO, Pagado)
 *  - un solo acuerdo vigente por cobranza
 */

import type { AxiosAdapter, InternalAxiosRequestConfig, AxiosResponse } from 'axios'

const CLAVE_DB = 'hadad_demo_db'
const VERSION_SEMILLA = 3

// ---------- utilidades ----------

let secuencia = 1000
const uid = () => `demo-${++secuencia}-${Math.random().toString(36).slice(2, 8)}`
const ahora = () => new Date().toISOString()
const hoy = () => new Date().toISOString().slice(0, 10)

function clp(v: number): string {
  return '$' + Math.round(v).toLocaleString('es-CL')
}

function sumarMeses(fechaISO: string, meses: number): string {
  const [a, m, d] = fechaISO.split('-').map(Number)
  const totalMeses = (m - 1) + meses
  const anio = a + Math.floor(totalMeses / 12)
  const mes = (totalMeses % 12) + 1
  const ultimoDia = new Date(anio, mes, 0).getDate()
  const dia = Math.min(d, ultimoDia)
  const dd = String(dia).padStart(2, '0')
  const mm = String(mes).padStart(2, '0')
  return `${anio}-${mm}-${dd}`
}

// ---------- datos de práctica (semilla) ----------

function semilla() {
  const usuarios = [
    { id: 'u-admin', nombre: 'Admin Hadad', email: 'admin@hadad.cl', password: 'hadad2026', rol_id: 1, activo: true },
    { id: 'u-sgg', nombre: 'SGG', email: 'sgg@hadad.cl', password: 'sebastian', rol_id: 1, activo: true },
    { id: 'u-grv', nombre: 'GRV', email: 'grv@hadad.cl', password: 'giselle', rol_id: 3, activo: true },
  ]
  const clientes = [
    { id: 'cl-1', rut: '96570220-7', razon_social: 'RED SALUD S.A.', nombre_fantasia: 'Redsalud' },
    { id: 'cl-2', rut: '99520000-1', razon_social: 'COPEC S.A.', nombre_fantasia: 'COPEC' },
  ]
  const filiales = [
    ...['Iquique', 'Elqui', 'Valparaíso', 'Rancagua', 'Temuco', 'Magallanes', 'Santiago', 'Providencia', 'Vitacura']
      .map((nombre, i) => ({ id: i + 1, cliente_id: 'cl-1', nombre, activo: true })),
    { id: 10, cliente_id: 'cl-2', nombre: 'Principal', activo: true },
  ]
  const deudores = [
    {
      id: 'd-1', rut: '12345678-5', tipo: 'natural', nombre: 'Pedro Antonio González Rojas',
      comuna: 'Valparaíso', ciudad: 'Valparaíso', en_dicom: true,
      observaciones: 'Deudor del caso de práctica. Padre de la paciente.',
      contactos: [
        { id: 'ct-1', deudor_id: 'd-1', tipo: 'celular', valor: '+56 9 5678 1234', activo: true },
        { id: 'ct-2', deudor_id: 'd-1', tipo: 'email', valor: 'pedro.gonzalez@gmail.com', activo: true },
      ],
    },
    {
      id: 'd-2', rut: '15987654-3', tipo: 'natural', nombre: 'María Pérez Soto',
      comuna: 'Viña del Mar', ciudad: 'Viña del Mar', en_dicom: false, observaciones: null,
      contactos: [
        { id: 'ct-3', deudor_id: 'd-2', tipo: 'celular', valor: '+56 9 4433 2211', activo: true },
      ],
    },
  ]
  const cobranzas = [
    {
      id: 'cob-1', numero: 20001, cliente_id: 'cl-1', filial_id: 3 as number | null, deudor_id: 'd-1',
      id_clinica: '145678', monto_original: '850000', monto_actual: '705000',
      tipo_documento: 'pagare', numero_pagare: 'PG-2025-0145',
      estado: 'acuerdo_pago', tipo: 'extrajudicial',
      fecha_ingreso_hadad: '2026-06-02',
      observaciones: 'Caso ingresado vía planilla mensual Redsalud. Paciente menor de edad atendida por urgencia.',
    },
    {
      id: 'cob-2', numero: 20002, cliente_id: 'cl-1', filial_id: 3, deudor_id: 'd-2',
      id_clinica: '198765', monto_original: '420000', monto_actual: '420000',
      tipo_documento: 'pagare', numero_pagare: null,
      estado: 'activa', tipo: 'extrajudicial',
      fecha_ingreso_hadad: '2026-06-08', observaciones: null,
    },
    {
      id: 'cob-3', numero: 20003, cliente_id: 'cl-2', filial_id: 10, deudor_id: 'd-2',
      id_clinica: 'SAP-77120', monto_original: '1250000', monto_actual: '1250000',
      tipo_documento: 'factura', numero_pagare: 'F-00981',
      estado: 'activa', tipo: 'extrajudicial',
      fecha_ingreso_hadad: '2026-06-08', observaciones: null,
    },
  ]
  const tiposGestion = [
    'Llamada telefónica', 'Email enviado', 'WhatsApp', 'Carta de cobranza',
    'Acuerdo de pago', 'Visita en terreno', 'Nota interna', 'Gestión automática',
    'Cobranza ingresada al sistema', 'Demanda presentada', 'Pagaré ejecutado',
    'Acuerdo incumplido', 'Abono', 'Pagado',
  ].map((nombre, i) => ({ id: i + 1, nombre, activo: true }))

  const gestiones = [
    {
      id: 'g-1', cobranza_id: 'cob-1', usuario_id: 'u-grv', tipo_id: 1 as number | null,
      descripcion: 'Primera llamada a don Pedro. Contesta. Reconoce la deuda y pide unos días para revisar su situación.',
      fecha_gestion: '2026-06-02T10:30:00', fecha_proximo_contacto: null,
    },
    {
      id: 'g-2', cobranza_id: 'cob-1', usuario_id: 'u-grv', tipo_id: 4,
      descripcion: 'Se envía carta de cobranza formal por correo certificado. Comprobante Correos Chile N° 458921.',
      fecha_gestion: '2026-06-05T15:00:00', fecha_proximo_contacto: null,
    },
    {
      id: 'g-3', cobranza_id: 'cob-1', usuario_id: 'u-grv', tipo_id: 5,
      descripcion: 'ACUERDO DE PAGO: $870.000 en 6 cuota(s) de $145.000. Primera cuota vence el 11-07-2026, última el 11-12-2026.',
      fecha_gestion: '2026-06-11T11:45:00', fecha_proximo_contacto: null,
    },
  ]
  const cuotas = Array.from({ length: 6 }, (_, i) => ({
    id: `cu-${i + 1}`, acuerdo_id: 'ac-1', numero_cuota: i + 1, monto: '145000',
    fecha_vencimiento: sumarMeses('2026-07-11', i),
    monto_pagado: i === 0 ? '145000' : '0',
    estado: i === 0 ? 'pagada' : 'pendiente',
  }))
  const acuerdos = [
    {
      id: 'ac-1', cobranza_id: 'cob-1', estado: 'vigente', fecha_acuerdo: '2026-06-11',
      fecha_termino: '2026-12-11', pie: '0', monto_total_acordado: '870000',
      numero_cuotas: 6, dia_pago: 11, fecha_primera_cuota: '2026-07-11',
      usuario_id: 'u-grv', cuotas,
    },
  ]
  const pagos = [
    {
      id: 'p-1', cobranza_id: 'cob-1', cuota_id: 'cu-1', fecha_pago: '2026-07-12',
      monto: '145000', capital_clinica: '123750', honorarios_hadad: '21250',
      interes_clinica: '0', gastos_judiciales: '0',
      forma_pago: 'transferencia', numero_comprobante: 'BCI-20260712-458912',
      estado_pago: 'cuota', usuario_id: 'u-grv',
    },
  ]
  return { version: VERSION_SEMILLA, usuarios, clientes, filiales, deudores, cobranzas, tiposGestion, gestiones, acuerdos, pagos, proximoNumero: 20004 }
}

// ---------- base de datos en localStorage ----------

type DB = ReturnType<typeof semilla>

function cargarDB(): DB {
  try {
    const crudo = localStorage.getItem(CLAVE_DB)
    if (crudo) {
      const db = JSON.parse(crudo)
      if (db.version === VERSION_SEMILLA) return db
    }
  } catch { /* semilla nueva */ }
  const db = semilla()
  guardarDB(db)
  return db
}

function guardarDB(db: DB) {
  localStorage.setItem(CLAVE_DB, JSON.stringify(db))
}

// ---------- helpers de respuesta ----------

function ok(config: InternalAxiosRequestConfig, data: unknown, status = 200): AxiosResponse {
  return { data, status, statusText: 'OK', headers: {}, config }
}

function error(status: number, detail: string) {
  return Promise.reject({
    isAxiosError: true,
    response: { status, data: { detail } },
    message: detail,
  })
}

function cuerpo(config: InternalAxiosRequestConfig): Record<string, unknown> {
  const d = config.data
  if (!d) return {}
  if (typeof d === 'string') {
    try { return JSON.parse(d) } catch { /* form-urlencoded */ }
    return Object.fromEntries(new URLSearchParams(d))
  }
  return d as Record<string, unknown>
}

function usuarioDelToken(config: InternalAxiosRequestConfig, db: DB) {
  const auth = String(config.headers?.Authorization ?? '')
  const id = auth.replace('Bearer demo-token-', '')
  return db.usuarios.find((u) => u.id === id) ?? db.usuarios[0]
}

function gestionAutomatica(db: DB, cobranza_id: string, usuario_id: string, nombreTipo: string, descripcion: string) {
  const tipo = db.tiposGestion.find((t) => t.nombre === nombreTipo)
  db.gestiones.push({
    id: uid(), cobranza_id, usuario_id, tipo_id: tipo?.id ?? null,
    descripcion, fecha_gestion: ahora(), fecha_proximo_contacto: null,
  })
}

// ---------- el adaptador ----------

export const adaptadorDemo: AxiosAdapter = async (config) => {
  const metodo = (config.method ?? 'get').toUpperCase()
  const url = (config.url ?? '').split('?')[0]
  const params = (config.params ?? {}) as Record<string, string>
  const db = cargarDB()

  // pequeña pausa para que se sienta real
  await new Promise((r) => setTimeout(r, 120))

  // ---- auth ----
  if (metodo === 'POST' && url === '/auth/login') {
    const { username, password } = cuerpo(config) as { username: string; password: string }
    const u = db.usuarios.find((x) => x.email === username && x.password === password)
    if (!u) return error(401, 'Email o contraseña incorrectos')
    return ok(config, { access_token: `demo-token-${u.id}`, token_type: 'bearer' })
  }
  if (metodo === 'GET' && url === '/auth/me') {
    const u = usuarioDelToken(config, db)
    const { password: _p, ...seguro } = u
    return ok(config, seguro)
  }

  // ---- catálogos ----
  if (metodo === 'GET' && url === '/clientes/') return ok(config, db.clientes)
  if (metodo === 'GET' && url === '/filiales/') {
    const lista = db.filiales.filter((f) => !params.cliente_id || f.cliente_id === params.cliente_id)
    return ok(config, lista)
  }
  if (metodo === 'GET' && url === '/gestiones/tipos') return ok(config, db.tiposGestion)

  // ---- deudores ----
  if (metodo === 'GET' && url === '/deudores/buscar') {
    const q = (params.q ?? '').toLowerCase()
    return ok(config, db.deudores.filter((d) => d.rut.includes(q) || d.nombre.toLowerCase().includes(q)))
  }
  if (metodo === 'GET' && url === '/deudores/') return ok(config, db.deudores)
  if (metodo === 'GET' && /^\/deudores\/[^/]+$/.test(url)) {
    const d = db.deudores.find((x) => x.id === url.split('/')[2])
    return d ? ok(config, d) : error(404, 'Deudor no encontrado')
  }
  if (metodo === 'POST' && url === '/deudores/') {
    const datos = cuerpo(config) as Record<string, unknown> & { rut: string; contactos?: { tipo: string; valor: string }[] }
    if (db.deudores.some((d) => d.rut === datos.rut)) {
      return error(400, `Ya existe un deudor con RUT ${datos.rut}`)
    }
    const id = uid()
    const nuevo = {
      id, rut: datos.rut, tipo: (datos.tipo as string) ?? 'natural',
      nombre: datos.nombre as string, comuna: (datos.comuna as string) ?? null,
      ciudad: (datos.ciudad as string) ?? null, en_dicom: false,
      observaciones: (datos.observaciones as string) ?? null,
      contactos: (datos.contactos ?? []).map((c) => ({ id: uid(), deudor_id: id, tipo: c.tipo, valor: c.valor, activo: true })),
    }
    db.deudores.push(nuevo as never)
    guardarDB(db)
    return ok(config, nuevo, 201)
  }

  // ---- cobranzas ----
  if (metodo === 'GET' && url === '/cobranzas/buscar') {
    const q = (params.q ?? '').toLowerCase()
    const lista = db.cobranzas.filter((c) => {
      const d = db.deudores.find((x) => x.id === c.deudor_id)
      return String(c.numero).includes(q) || (c.id_clinica ?? '').toLowerCase().includes(q)
        || d?.rut.includes(q) || d?.nombre.toLowerCase().includes(q)
    })
    return ok(config, lista)
  }
  if (metodo === 'GET' && url === '/cobranzas/') {
    let lista = db.cobranzas
    if (params.estado) lista = lista.filter((c) => c.estado === params.estado)
    if (params.cliente_id) lista = lista.filter((c) => c.cliente_id === params.cliente_id)
    return ok(config, lista)
  }
  if (metodo === 'GET' && /^\/cobranzas\/[^/]+$/.test(url)) {
    const c = db.cobranzas.find((x) => x.id === url.split('/')[2])
    if (!c) return error(404, 'Cobranza no encontrada')
    return ok(config, {
      ...c,
      cliente: db.clientes.find((x) => x.id === c.cliente_id) ?? null,
      filial: db.filiales.find((x) => x.id === c.filial_id) ?? null,
      deudor: db.deudores.find((x) => x.id === c.deudor_id) ?? null,
    })
  }
  if (metodo === 'POST' && url === '/cobranzas/') {
    const datos = cuerpo(config) as Record<string, string | number | null>
    if (datos.id_clinica && db.cobranzas.some((c) => c.cliente_id === datos.cliente_id && c.id_clinica === datos.id_clinica)) {
      return error(400, 'El ID cliente ya existe para ese cliente')
    }
    const nueva = {
      id: uid(), numero: db.proximoNumero++,
      cliente_id: datos.cliente_id as string, filial_id: (datos.filial_id as number) ?? null,
      deudor_id: datos.deudor_id as string, id_clinica: (datos.id_clinica as string) ?? null,
      monto_original: String(datos.monto_original), monto_actual: String(datos.monto_original),
      tipo_documento: (datos.tipo_documento as string) ?? 'pagare',
      numero_pagare: (datos.numero_pagare as string) ?? null,
      estado: 'activa', tipo: 'extrajudicial',
      fecha_ingreso_hadad: hoy(), observaciones: (datos.observaciones as string) ?? null,
    }
    db.cobranzas.push(nueva as never)
    guardarDB(db)
    return ok(config, nueva, 201)
  }

  // ---- gestiones ----
  if (metodo === 'GET' && url === '/gestiones/') {
    const lista = db.gestiones
      .filter((g) => !params.cobranza_id || g.cobranza_id === params.cobranza_id)
      .sort((a, b) => b.fecha_gestion.localeCompare(a.fecha_gestion))
      .map((g) => ({
        ...g,
        usuario_nombre: db.usuarios.find((u) => u.id === g.usuario_id)?.nombre ?? null,
      }))
    return ok(config, lista)
  }
  if (metodo === 'POST' && url === '/gestiones/') {
    const datos = cuerpo(config) as { cobranza_id: string; tipo_id?: number; descripcion: string }
    const u = usuarioDelToken(config, db)
    const nueva = {
      id: uid(), cobranza_id: datos.cobranza_id, usuario_id: u.id,
      tipo_id: datos.tipo_id ?? null, descripcion: datos.descripcion,
      fecha_gestion: ahora(), fecha_proximo_contacto: null,
    }
    db.gestiones.push(nueva)
    guardarDB(db)
    return ok(config, nueva, 201)
  }

  // ---- acuerdos ----
  if (metodo === 'GET' && url === '/acuerdos/') {
    return ok(config, db.acuerdos.filter((a) => !params.cobranza_id || a.cobranza_id === params.cobranza_id))
  }
  if (metodo === 'GET' && /^\/acuerdos\/[^/]+$/.test(url)) {
    const a = db.acuerdos.find((x) => x.id === url.split('/')[2])
    return a ? ok(config, a) : error(404, 'Acuerdo no encontrado')
  }
  if (metodo === 'POST' && url === '/acuerdos/') {
    const datos = cuerpo(config) as Record<string, string | number>
    const cob = db.cobranzas.find((c) => c.id === datos.cobranza_id)
    if (!cob) return error(404, 'Cobranza no encontrada')
    if (db.acuerdos.some((a) => a.cobranza_id === cob.id && a.estado === 'vigente')) {
      return error(400, 'La cobranza ya tiene un acuerdo vigente.')
    }
    const u = usuarioDelToken(config, db)
    const n = Number(datos.numero_cuotas)
    const total = Number(datos.monto_total_acordado)
    const pie = Number(datos.pie ?? 0)
    const base = Math.round((total - pie) / n)
    const acuerdoId = uid()
    const cuotasNuevas = Array.from({ length: n }, (_, i) => ({
      id: uid(), acuerdo_id: acuerdoId, numero_cuota: i + 1,
      monto: String(i === n - 1 ? total - pie - base * (n - 1) : base),
      fecha_vencimiento: sumarMeses(String(datos.fecha_primera_cuota), i),
      monto_pagado: '0', estado: 'pendiente',
    }))
    const nuevo = {
      id: acuerdoId, cobranza_id: cob.id, estado: 'vigente', fecha_acuerdo: hoy(),
      fecha_termino: cuotasNuevas[n - 1].fecha_vencimiento,
      pie: String(pie), monto_total_acordado: String(total), numero_cuotas: n,
      dia_pago: (datos.dia_pago as number) ?? null,
      fecha_primera_cuota: String(datos.fecha_primera_cuota),
      usuario_id: u.id, cuotas: cuotasNuevas,
    }
    db.acuerdos.push(nuevo as never)
    cob.estado = 'acuerdo_pago'
    gestionAutomatica(db, cob.id, u.id, 'Acuerdo de pago',
      `ACUERDO DE PAGO: ${clp(total)} en ${n} cuota(s) de ${clp(base)}. ` +
      `Primera cuota vence el ${cuotasNuevas[0].fecha_vencimiento}, última el ${nuevo.fecha_termino}.`)
    guardarDB(db)
    return ok(config, nuevo, 201)
  }

  // ---- pagos (con la cascada del backend real) ----
  if (metodo === 'GET' && url === '/pagos/') {
    return ok(config, db.pagos.filter((p) => !params.cobranza_id || p.cobranza_id === params.cobranza_id))
  }
  if (metodo === 'POST' && url === '/pagos/') {
    const datos = cuerpo(config) as Record<string, string | null>
    const cob = db.cobranzas.find((c) => c.id === datos.cobranza_id)
    if (!cob) return error(404, 'Cobranza no encontrada')
    const u = usuarioDelToken(config, db)
    const monto = Number(datos.monto)
    const capital = Number(datos.capital_clinica ?? 0)

    const nuevo = {
      id: uid(), cobranza_id: cob.id, cuota_id: datos.cuota_id ?? null,
      fecha_pago: hoy(), monto: String(monto),
      capital_clinica: String(capital),
      honorarios_hadad: String(datos.honorarios_hadad ?? 0),
      interes_clinica: String(datos.interes_clinica ?? 0),
      gastos_judiciales: String(datos.gastos_judiciales ?? 0),
      forma_pago: (datos.forma_pago as string) ?? null,
      numero_comprobante: (datos.numero_comprobante as string) ?? null,
      estado_pago: (datos.estado_pago as string) ?? 'abono', usuario_id: u.id,
    }
    db.pagos.push(nuevo as never)

    // Solo el capital descuenta el saldo.
    const descuento = capital > 0 ? capital : monto
    cob.monto_actual = String(Math.max(0, Number(cob.monto_actual) - descuento))

    let encabezado = 'ABONO'
    if (nuevo.cuota_id) {
      const acuerdo = db.acuerdos.find((a) => a.cuotas.some((c) => c.id === nuevo.cuota_id))
      const cuota = acuerdo?.cuotas.find((c) => c.id === nuevo.cuota_id)
      if (acuerdo && cuota) {
        cuota.monto_pagado = String(Number(cuota.monto_pagado) + monto)
        cuota.estado = Number(cuota.monto_pagado) >= Number(cuota.monto) ? 'pagada' : 'pagada_parcial'
        encabezado = `PAGO CUOTA ${cuota.numero_cuota}`
        if (acuerdo.cuotas.every((c) => c.estado === 'pagada')) {
          acuerdo.estado = 'cumplido'
          cob.estado = 'pagada'
        }
      }
    }
    if (Number(cob.monto_actual) === 0) cob.estado = 'pagada'

    const partes = [`total ${clp(monto)}`]
    if (capital > 0) partes.push(`capital ${clp(capital)}`)
    if (Number(nuevo.honorarios_hadad) > 0) partes.push(`honorarios ${clp(Number(nuevo.honorarios_hadad))}`)
    gestionAutomatica(db, cob.id, u.id, 'Abono',
      `${encabezado}: ${partes.join(', ')}. Saldo capital restante: ${clp(Number(cob.monto_actual))}.`)
    if (cob.estado === 'pagada') {
      gestionAutomatica(db, cob.id, u.id, 'Pagado', 'CUENTA SALDADA. La cobranza queda en estado pagada.')
    }
    guardarDB(db)
    return ok(config, nuevo, 201)
  }

  // ---- reportes (admin) ----
  if (metodo === 'GET' && url === '/reportes/equipo') {
    const reporte = db.usuarios.map((u) => {
      const gestionesU = db.gestiones.filter((g) => g.usuario_id === u.id)
      const porTipo: Record<string, number> = {}
      for (const g of gestionesU) {
        const nombre = db.tiposGestion.find((t) => t.id === g.tipo_id)?.nombre ?? 'Sin tipo'
        porTipo[nombre] = (porTipo[nombre] ?? 0) + 1
      }
      const pagosU = db.pagos.filter((p) => p.usuario_id === u.id)
      return {
        usuario_id: u.id, nombre: u.nombre, activo: u.activo,
        gestiones_total: gestionesU.length, gestiones_por_tipo: porTipo,
        acuerdos_creados: db.acuerdos.filter((a) => a.usuario_id === u.id).length,
        pagos_ingresados: pagosU.length,
        monto_pagos: String(pagosU.reduce((s, p) => s + Number(p.monto), 0)),
      }
    })
    return ok(config, reporte)
  }

  // ---- lo que necesita servidor de verdad ----
  return error(501, 'Esta función (descargas Excel/Word, carga masiva) está disponible en la versión completa con servidor.')
}
