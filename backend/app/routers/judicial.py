"""
Endpoints HTTP para la ficha judicial de las cobranzas.

  GET  /api/judicial                          → listar fichas judiciales
  GET  /api/judicial/cobranza/{cobranza_id}   → ficha de una cobranza (1-a-1)
  GET  /api/judicial/{id}                     → ficha por su id
  POST /api/judicial                          → crear ficha (cobranza → judicial)
  PUT  /api/judicial/{id}                     → actualizar (el proceso avanza)

Al CREAR la ficha, la cobranza pasa a estado 'judicial' y tipo 'judicial'
en la misma transacción. No hay DELETE: si la causa termina, se refleja en
estado_proceso y en el estado de la cobranza (pagada/archivada/castigo).
"""

from uuid import UUID
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.security import usuario_autorizado
from app.models.judicial import GestionJudicial
from app.models.cobranza import Cobranza
from app.schemas.judicial import JudicialCreate, JudicialUpdate, JudicialResponse


# dependencies=[...] exige token válido en TODOS los endpoints del router
# y aplica la regla de roles (viewer = solo lectura).
router = APIRouter(
    prefix="/api/judicial",
    tags=["Gestión judicial"],
    dependencies=[Depends(usuario_autorizado)],
)


@router.get("/", response_model=List[JudicialResponse])
def listar_fichas(
    abogado_id: Optional[UUID] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """Lista fichas judiciales, filtrable por abogado a cargo."""
    query = db.query(GestionJudicial)
    if abogado_id is not None:
        query = query.filter(GestionJudicial.abogado_id == abogado_id)
    return query.order_by(GestionJudicial.fecha_ingreso.desc()).offset(skip).limit(limit).all()


@router.get("/cobranza/{cobranza_id}", response_model=JudicialResponse)
def ficha_de_cobranza(cobranza_id: UUID, db: Session = Depends(get_db)):
    """Devuelve la ficha judicial de una cobranza (404 si no ha ido a tribunal)."""
    ficha = (
        db.query(GestionJudicial)
        .filter(GestionJudicial.cobranza_id == cobranza_id)
        .first()
    )
    if not ficha:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Esta cobranza no tiene ficha judicial (no ha ido a tribunal)",
        )
    return ficha


@router.get("/{ficha_id}", response_model=JudicialResponse)
def obtener_ficha(ficha_id: UUID, db: Session = Depends(get_db)):
    """Obtiene una ficha judicial por su UUID."""
    ficha = db.query(GestionJudicial).filter(GestionJudicial.id == ficha_id).first()
    if not ficha:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ficha judicial con id {ficha_id} no encontrada",
        )
    return ficha


@router.post("/", response_model=JudicialResponse, status_code=status.HTTP_201_CREATED)
def crear_ficha(datos: JudicialCreate, db: Session = Depends(get_db)):
    """
    Crea la ficha judicial de una cobranza. En la misma transacción, la
    cobranza pasa a estado 'judicial' y tipo 'judicial'.
    Rechaza si la cobranza ya tiene ficha (es 1-a-1).
    """
    cobranza = db.query(Cobranza).filter(Cobranza.id == datos.cobranza_id).first()
    if not cobranza:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cobranza con id {datos.cobranza_id} no encontrada",
        )

    nueva_ficha = GestionJudicial(**datos.model_dump())
    cobranza.estado = "judicial"
    cobranza.tipo = "judicial"

    try:
        db.add(nueva_ficha)
        db.commit()
        db.refresh(nueva_ficha)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Esta cobranza ya tiene ficha judicial (es una por cobranza) "
                "o el abogado indicado no existe."
            ),
        )
    return nueva_ficha


@router.put("/{ficha_id}", response_model=JudicialResponse)
def actualizar_ficha(
    ficha_id: UUID,
    datos: JudicialUpdate,
    db: Session = Depends(get_db),
):
    """Actualiza la ficha judicial (rol, tribunal, estado del proceso...)."""
    ficha = db.query(GestionJudicial).filter(GestionJudicial.id == ficha_id).first()
    if not ficha:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ficha judicial con id {ficha_id} no encontrada",
        )

    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(ficha, campo, valor)

    try:
        db.commit()
        db.refresh(ficha)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El abogado indicado no existe.",
        )
    return ficha
