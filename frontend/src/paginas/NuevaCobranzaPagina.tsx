import NuevaCobranza from '../componentes/NuevaCobranza'

// Sección dedicada de ingreso (como la portada del sistema original):
// el formulario de alta de cobranza en su propia página.

export default function NuevaCobranzaPagina() {
  return (
    <>
      <header className="pagina-cabecera">
        <h1>Ingreso de cobranza</h1>
      </header>
      <NuevaCobranza enPagina />
    </>
  )
}
