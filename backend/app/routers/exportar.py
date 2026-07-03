"""
Endpoints de exportación a Excel (openpyxl).

  GET /api/exportar/gestiones → descarga un .xlsx con las gestiones de los
      últimos N días (default 15), filtrable por cliente o por filial.

Pensado para el informe periódico que se envía/revisa por clínica:
"todas las gestiones de los últimos 15 días de Redsalud Temuco".

El archivo se genera en memoria (BytesIO): no se escribe nada a disco.
"""

import unicodedata
from io import BytesIO
from uuid import UUID
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

from app.database import get_db
from app.security import get_current_user
from app.models.gestion import Gestion, TipoGestion
from app.models.cobranza import Cobranza
from app.models.deudor import Deudor
from app.models.cliente import Cliente
from app.models.filial import Filial
from app.models.usuario import Usuario


# dependencies=[...] exige token válido en TODOS los endpoints del router.
router = APIRouter(
    prefix="/api/exportar",
    tags=["Exportar"],
    dependencies=[Depends(get_current_user)],
)

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

ENCABEZADOS = [
    "Fecha gestión", "N° Hadad", "ID clínica", "RUT deudor", "Deudor",
    "Cliente", "Filial", "Tipo de gestión", "Descripción",
    "Próximo contacto", "Registrada por",
]


@router.get("/gestiones")
def exportar_gestiones(
    dias: int = Query(15, ge=1, le=365, description="Cuántos días hacia atrás incluir"),
    cliente_id: Optional[UUID] = Query(None, description="Filtrar por cliente (clínica)"),
    filial_id: Optional[int] = Query(None, description="Filtrar por filial (sucursal)"),
    db: Session = Depends(get_db),
):
    """
    Descarga un Excel con las gestiones de los últimos `dias` días.
    Filtros combinables: por cliente (toda la clínica) o por filial puntual.
    """
    desde = datetime.now(timezone.utc) - timedelta(days=dias)

    # Join: gestión → cobranza → deudor/cliente; filial y tipo pueden ser NULL
    # (outerjoin) para no perder gestiones de cobranzas sin filial asignada.
    query = (
        db.query(Gestion, Cobranza, Deudor, Cliente, Filial, TipoGestion, Usuario)
        .join(Cobranza, Gestion.cobranza_id == Cobranza.id)
        .join(Deudor, Cobranza.deudor_id == Deudor.id)
        .join(Cliente, Cobranza.cliente_id == Cliente.id)
        .outerjoin(Filial, Cobranza.filial_id == Filial.id)
        .outerjoin(TipoGestion, Gestion.tipo_id == TipoGestion.id)
        .join(Usuario, Gestion.usuario_id == Usuario.id)
        .filter(Gestion.fecha_gestion >= desde)
    )

    nombre_filtro = "todas"
    if cliente_id is not None:
        cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
        if not cliente:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Cliente con id {cliente_id} no encontrado",
            )
        query = query.filter(Cobranza.cliente_id == cliente_id)
        nombre_filtro = (cliente.nombre_fantasia or cliente.razon_social)
    if filial_id is not None:
        filial = db.query(Filial).filter(Filial.id == filial_id).first()
        if not filial:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Filial con id {filial_id} no encontrada",
            )
        query = query.filter(Cobranza.filial_id == filial_id)
        nombre_filtro = f"{nombre_filtro}-{filial.nombre}" if cliente_id else filial.nombre

    filas = query.order_by(Gestion.fecha_gestion.desc()).all()

    # --- Armar el Excel ---
    wb = Workbook()
    ws = wb.active
    ws.title = f"Gestiones últimos {dias} días"

    # Encabezado con estilo (negrita, fondo, centrado) y panel congelado.
    fill = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
    for col, titulo in enumerate(ENCABEZADOS, start=1):
        celda = ws.cell(row=1, column=col, value=titulo)
        celda.font = Font(bold=True, color="FFFFFF")
        celda.fill = fill
        celda.alignment = Alignment(horizontal="center")
    ws.freeze_panes = "A2"

    for i, (g, cob, deu, cli, fil, tipo, usu) in enumerate(filas, start=2):
        ws.cell(row=i, column=1, value=g.fecha_gestion.replace(tzinfo=None)
                ).number_format = "DD-MM-YYYY HH:MM"
        ws.cell(row=i, column=2, value=cob.numero)
        ws.cell(row=i, column=3, value=cob.id_clinica)
        ws.cell(row=i, column=4, value=deu.rut)
        ws.cell(row=i, column=5, value=deu.nombre)
        ws.cell(row=i, column=6, value=cli.nombre_fantasia or cli.razon_social)
        ws.cell(row=i, column=7, value=fil.nombre if fil else "")
        ws.cell(row=i, column=8, value=tipo.nombre if tipo else "")
        ws.cell(row=i, column=9, value=g.descripcion)
        if g.fecha_proximo_contacto:
            ws.cell(row=i, column=10, value=g.fecha_proximo_contacto
                    ).number_format = "DD-MM-YYYY"
        ws.cell(row=i, column=11, value=usu.nombre)

    # Anchos de columna razonables (descripción más ancha).
    anchos = [17, 10, 12, 13, 30, 16, 14, 22, 60, 16, 20]
    for col, ancho in enumerate(anchos, start=1):
        ws.column_dimensions[get_column_letter(col)].width = ancho

    # Guardar en memoria y responder como descarga.
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    hoy = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    nombre_archivo = f"gestiones_{nombre_filtro}_{dias}dias_{hoy}.xlsx".replace(" ", "_")
    # Los headers HTTP no aceptan bien acentos/ñ: normalizamos a ASCII
    # ("Valparaíso" → "Valparaiso") para que el nombre no se corrompa.
    nombre_archivo = (
        unicodedata.normalize("NFKD", nombre_archivo)
        .encode("ascii", "ignore")
        .decode("ascii")
    )

    return StreamingResponse(
        buffer,
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{nombre_archivo}"'},
    )
