import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ProveedorAuth } from './auth'
import Layout from './componentes/Layout'
import Login from './paginas/Login'
import Cobranzas from './paginas/Cobranzas'
import CobranzaDetalle from './paginas/CobranzaDetalle'
import Deudores from './paginas/Deudores'
import Informes from './paginas/Informes'
import Equipo from './paginas/Equipo'
import NuevaCobranzaPagina from './paginas/NuevaCobranzaPagina'
import Abonos from './paginas/Abonos'
import CargaMasiva from './paginas/CargaMasiva'

export default function App() {
  return (
    <ProveedorAuth>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/cobranzas" replace />} />
            <Route path="/cobranzas" element={<Cobranzas />} />
            <Route path="/cobranzas/nueva" element={<NuevaCobranzaPagina />} />
            <Route path="/cobranzas/:id" element={<CobranzaDetalle />} />
            <Route path="/abonos" element={<Abonos />} />
            <Route path="/carga-masiva" element={<CargaMasiva />} />
            <Route path="/deudores" element={<Deudores />} />
            <Route path="/informes" element={<Informes />} />
            <Route path="/equipo" element={<Equipo />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ProveedorAuth>
  )
}
