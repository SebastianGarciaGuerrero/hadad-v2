import { NavLink, Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../auth'

// Estructura general: barra lateral de navegación + contenido.
// Si no hay sesión, redirige al login (esto protege todas las rutas hijas).

export default function Layout() {
  const { usuario, cargando, logout } = useAuth()

  if (cargando) return <div className="pantalla-carga">Cargando…</div>
  if (!usuario) return <Navigate to="/login" replace />

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="marca">
          <img className="marca-logo-img" src="/logo.svg" alt="Hadad & Asociados" />
          <div>
            <div className="marca-nombre">Hadad &amp; Asociados</div>
            <div className="marca-sub">Asesoría legal y financiera</div>
          </div>
        </div>

        <nav className="menu">
          <NavLink to="/cobranzas">📁 Cobranzas</NavLink>
          <NavLink to="/deudores">👤 Deudores</NavLink>
          <NavLink to="/informes">📊 Informes</NavLink>
        </nav>

        <div className="sidebar-pie">
          <div className="usuario-nombre">{usuario.nombre}</div>
          <div className="usuario-email">{usuario.email}</div>
          <button className="btn btn-secundario btn-chico" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="contenido">
        <Outlet />
        <footer className="pie-firma">
          Creado por{' '}
          <a href="https://sebastiangarcia.cl" target="_blank" rel="noreferrer">
            sebastiangarcia.cl
          </a>
        </footer>
      </main>
    </div>
  )
}
