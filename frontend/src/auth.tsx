import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api, TOKEN_KEY } from './api/client'
import type { Usuario } from './api/tipos'

// Sesión de la app: guarda el token y los datos del usuario logueado.
// Al recargar la página, si hay token guardado se re-valida contra /auth/me.

interface Sesion {
  usuario: Usuario | null
  cargando: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const ContextoAuth = createContext<Sesion>(null!)

export function useAuth() {
  return useContext(ContextoAuth)
}

export function ProveedorAuth({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    // Si hay un token guardado, preguntar al backend quién soy.
    if (!localStorage.getItem(TOKEN_KEY)) {
      setCargando(false)
      return
    }
    api.get<Usuario>('/auth/me')
      .then((res) => setUsuario(res.data))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setCargando(false))
  }, [])

  async function login(email: string, password: string) {
    // El backend espera form-data OAuth2 (username + password).
    const form = new URLSearchParams({ username: email, password })
    const { data } = await api.post('/auth/login', form)
    localStorage.setItem(TOKEN_KEY, data.access_token)
    const yo = await api.get<Usuario>('/auth/me')
    setUsuario(yo.data)
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setUsuario(null)
  }

  return (
    <ContextoAuth.Provider value={{ usuario, cargando, login, logout }}>
      {children}
    </ContextoAuth.Provider>
  )
}
