import axios from 'axios'

// Cliente HTTP central. El token JWT viaja en cada petición; si el backend
// responde 401 (token vencido o inválido), se limpia la sesión y se vuelve
// al login.

export const TOKEN_KEY = 'hadad_token'

export const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem(TOKEN_KEY)
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

/** Extrae un mensaje legible del error de la API (detail de FastAPI). */
export function mensajeDeError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detalle = error.response?.data?.detail
    if (typeof detalle === 'string') return detalle
    if (Array.isArray(detalle)) return detalle.map((d) => d.msg).join('; ')
  }
  return 'Error inesperado. Revisa la conexión con el servidor.'
}
