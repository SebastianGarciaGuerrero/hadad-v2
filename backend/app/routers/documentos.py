"""
Documentos Word (.docx) formales para entregar a clínicas, deudores o
tribunales. Diseño sobrio de estudio jurídico (membrete Hadad & Asociados).

  GET /api/documentos/informe-gestiones/{cobranza_id} → Word con el historial
      completo de gestiones del caso a la fecha.
  GET /api/documentos/estado-cuenta/{cobranza_id}     → Word con el estado de
      cuenta actualizado (deuda, abonos, acuerdo, cuotas).
"""

from io import BytesIO
from uuid import UUID
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT

from app.database import get_db
from app.security import get_current_user
from app.models.cobranza import Cobranza
from app.models.gestion import Gestion, TipoGestion
from app.models.acuerdo import AcuerdoPago
from app.models.pago import Pago


router = APIRouter(
    prefix="/api/documentos",
    tags=["Documentos Word"],
    dependencies=[Depends(get_current_user)],
)

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

GRIS_OSCURO = RGBColor(0x21, 0x21, 0x26)
GRIS_SUAVE = RGBColor(0x71, 0x71, 0x7A)

MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
    "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]


def _clp(valor) -> str:
    return "$" + f"{int(valor):,}".replace(",", ".")


def _fecha_larga(f: date) -> str:
    return f"{f.day} de {MESES[f.month - 1]} de {f.year}"


def _fecha_corta(f) -> str:
    return f.strftime("%d-%m-%Y") if f else "—"


def _membrete(doc: Document):
    """Encabezado institucional: wordmark centrado + línea divisoria."""
    titulo = doc.add_paragraph()
    titulo.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = titulo.add_run("HADAD & ASOCIADOS")
    r.bold = True
    r.font.size = Pt(18)
    r.font.color.rgb = GRIS_OSCURO

    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = sub.add_run("ASESORÍA LEGAL Y FINANCIERA")
    r.font.size = Pt(9)
    r.font.color.rgb = GRIS_SUAVE
    # espaciado entre letras (estilo del logo)
    r.font.name = "Segoe UI"

    linea = doc.add_paragraph()
    linea.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = linea.add_run("_" * 72)
    r.font.color.rgb = GRIS_SUAVE
    r.font.size = Pt(8)


def _titulo_documento(doc: Document, texto: str):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(14)
    p.paragraph_format.space_after = Pt(14)
    r = p.add_run(texto)
    r.bold = True
    r.font.size = Pt(13)
    r.font.color.rgb = GRIS_OSCURO


def _tabla_datos(doc: Document, pares: list):
    """Tabla de dos columnas etiqueta/valor con estilo sobrio."""
    tabla = doc.add_table(rows=len(pares), cols=2)
    tabla.style = "Table Grid"
    tabla.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, (etiqueta, valor) in enumerate(pares):
        c0, c1 = tabla.rows[i].cells
        c0.width, c1.width = Cm(5.5), Cm(10.5)
        r = c0.paragraphs[0].add_run(etiqueta)
        r.bold = True
        r.font.size = Pt(10)
        r = c1.paragraphs[0].add_run(str(valor))
        r.font.size = Pt(10)
    return tabla


def _pie_firma(doc: Document):
    doc.add_paragraph()
    doc.add_paragraph()
    firma = doc.add_paragraph()
    firma.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = firma.add_run("_______________________________")
    r.font.color.rgb = GRIS_OSCURO
    quien = doc.add_paragraph()
    quien.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = quien.add_run("González & Hadad Profesionales Asociados")
    r.bold = True
    r.font.size = Pt(10)
    dire = doc.add_paragraph()
    dire.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = dire.add_run("Valparaíso, Chile")
    r.font.size = Pt(9)
    r.font.color.rgb = GRIS_SUAVE


def _cargar_cobranza(db: Session, cobranza_id: UUID) -> Cobranza:
    cobranza = db.query(Cobranza).filter(Cobranza.id == cobranza_id).first()
    if not cobranza:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cobranza con id {cobranza_id} no encontrada",
        )
    return cobranza


def _responder_docx(doc: Document, nombre: str) -> StreamingResponse:
    buffer = BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type=DOCX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
    )


@router.get("/informe-gestiones/{cobranza_id}")
def informe_gestiones(cobranza_id: UUID, db: Session = Depends(get_db)):
    """Word formal con todas las gestiones del caso a la fecha."""
    cob = _cargar_cobranza(db, cobranza_id)
    gestiones = (
        db.query(Gestion)
        .filter(Gestion.cobranza_id == cobranza_id)
        .order_by(Gestion.fecha_gestion)
        .all()
    )
    tipos = {t.id: t.nombre for t in db.query(TipoGestion).all()}

    doc = Document()
    _membrete(doc)
    _titulo_documento(doc, "INFORME DE GESTIONES DE COBRANZA")

    intro = doc.add_paragraph()
    r = intro.add_run(
        f"En Valparaíso, a {_fecha_larga(date.today())}, se informa el detalle "
        f"de las gestiones de cobranza realizadas a la fecha respecto del "
        f"siguiente caso:"
    )
    r.font.size = Pt(10.5)

    _tabla_datos(doc, [
        ("N° de cobranza", cob.numero),
        ("ID cliente", cob.id_clinica or "—"),
        ("Deudor", f"{cob.deudor.nombre} — RUT {cob.deudor.rut}" if cob.deudor else "—"),
        ("Cliente", (cob.cliente.nombre_fantasia or cob.cliente.razon_social) if cob.cliente else "—"),
        ("Filial", cob.filial.nombre if cob.filial else "—"),
        ("Deuda original", _clp(cob.monto_original)),
        ("Saldo a la fecha", _clp(cob.monto_actual)),
    ])

    doc.add_paragraph()
    sub = doc.add_paragraph()
    r = sub.add_run(f"Detalle de gestiones ({len(gestiones)})")
    r.bold = True
    r.font.size = Pt(11)

    tabla = doc.add_table(rows=1, cols=3)
    tabla.style = "Table Grid"
    encabezados = ("Fecha", "Tipo", "Detalle de la gestión")
    anchos = (Cm(3), Cm(3.6), Cm(9.4))
    for i, (texto, ancho) in enumerate(zip(encabezados, anchos)):
        celda = tabla.rows[0].cells[i]
        celda.width = ancho
        r = celda.paragraphs[0].add_run(texto)
        r.bold = True
        r.font.size = Pt(10)
    for g in gestiones:
        fila = tabla.add_row().cells
        for i, ancho in enumerate(anchos):
            fila[i].width = ancho
        fila[0].paragraphs[0].add_run(
            g.fecha_gestion.strftime("%d-%m-%Y")).font.size = Pt(9.5)
        fila[1].paragraphs[0].add_run(
            tipos.get(g.tipo_id, "Gestión")).font.size = Pt(9.5)
        fila[2].paragraphs[0].add_run(g.descripcion).font.size = Pt(9.5)

    _pie_firma(doc)

    nombre = f"informe_gestiones_cobranza_{cob.numero}_{date.today().isoformat()}.docx"
    return _responder_docx(doc, nombre)


@router.get("/estado-cuenta/{cobranza_id}")
def estado_cuenta(cobranza_id: UUID, db: Session = Depends(get_db)):
    """Word formal con el estado de cuenta actualizado del caso."""
    cob = _cargar_cobranza(db, cobranza_id)
    pagos = (
        db.query(Pago)
        .filter(Pago.cobranza_id == cobranza_id)
        .order_by(Pago.fecha_pago)
        .all()
    )
    acuerdo = (
        db.query(AcuerdoPago)
        .filter(AcuerdoPago.cobranza_id == cobranza_id, AcuerdoPago.estado == "vigente")
        .first()
    )

    doc = Document()
    _membrete(doc)
    _titulo_documento(doc, "ESTADO DE CUENTA")

    intro = doc.add_paragraph()
    r = intro.add_run(
        f"En Valparaíso, a {_fecha_larga(date.today())}, se certifica el "
        f"siguiente estado de cuenta del caso que se individualiza:"
    )
    r.font.size = Pt(10.5)

    total_abonado = sum((p.monto or 0) for p in pagos)
    capital_abonado = sum((p.capital_clinica or 0) for p in pagos)

    _tabla_datos(doc, [
        ("N° de cobranza", cob.numero),
        ("ID cliente", cob.id_clinica or "—"),
        ("Deudor", f"{cob.deudor.nombre} — RUT {cob.deudor.rut}" if cob.deudor else "—"),
        ("Cliente", (cob.cliente.nombre_fantasia or cob.cliente.razon_social) if cob.cliente else "—"),
        ("Deuda original (capital)", _clp(cob.monto_original)),
        ("Capital abonado", _clp(capital_abonado)),
        ("Total abonado (incluye honorarios)", _clp(total_abonado)),
        ("SALDO DE CAPITAL ADEUDADO", _clp(cob.monto_actual)),
        ("Estado del caso", cob.estado.replace("_", " ").capitalize()),
    ])

    if acuerdo is not None:
        doc.add_paragraph()
        sub = doc.add_paragraph()
        r = sub.add_run("Acuerdo de pago vigente")
        r.bold = True
        r.font.size = Pt(11)
        det = doc.add_paragraph()
        r = det.add_run(
            f"Acuerdo de fecha {_fecha_corta(acuerdo.fecha_acuerdo)} por "
            f"{_clp(acuerdo.monto_total_acordado)} en {acuerdo.numero_cuotas} "
            f"cuota(s), con vencimiento final el {_fecha_corta(acuerdo.fecha_termino)}."
        )
        r.font.size = Pt(10.5)

        tabla = doc.add_table(rows=1, cols=5)
        tabla.style = "Table Grid"
        for i, texto in enumerate(("Cuota", "Vencimiento", "Monto", "Pagado", "Estado")):
            r = tabla.rows[0].cells[i].paragraphs[0].add_run(texto)
            r.bold = True
            r.font.size = Pt(10)
        for c in acuerdo.cuotas:
            fila = tabla.add_row().cells
            valores = (
                f"{c.numero_cuota}/{acuerdo.numero_cuotas}",
                _fecha_corta(c.fecha_vencimiento),
                _clp(c.monto),
                _clp(c.monto_pagado),
                c.estado.replace("_", " "),
            )
            for i, v in enumerate(valores):
                fila[i].paragraphs[0].add_run(v).font.size = Pt(9.5)

    if pagos:
        doc.add_paragraph()
        sub = doc.add_paragraph()
        r = sub.add_run(f"Pagos registrados ({len(pagos)})")
        r.bold = True
        r.font.size = Pt(11)

        tabla = doc.add_table(rows=1, cols=4)
        tabla.style = "Table Grid"
        for i, texto in enumerate(("Fecha", "Monto", "Capital", "Forma de pago")):
            r = tabla.rows[0].cells[i].paragraphs[0].add_run(texto)
            r.bold = True
            r.font.size = Pt(10)
        for p in pagos:
            fila = tabla.add_row().cells
            valores = (
                _fecha_corta(p.fecha_pago),
                _clp(p.monto),
                _clp(p.capital_clinica or 0),
                p.forma_pago or "—",
            )
            for i, v in enumerate(valores):
                fila[i].paragraphs[0].add_run(v).font.size = Pt(9.5)

    nota = doc.add_paragraph()
    nota.paragraph_format.space_before = Pt(10)
    r = nota.add_run(
        "El presente documento refleja el estado de la cuenta a la fecha de "
        "emisión y no constituye finiquito ni renuncia a acciones de cobro."
    )
    r.font.size = Pt(9)
    r.font.color.rgb = GRIS_SUAVE

    _pie_firma(doc)

    nombre = f"estado_cuenta_cobranza_{cob.numero}_{date.today().isoformat()}.docx"
    return _responder_docx(doc, nombre)
