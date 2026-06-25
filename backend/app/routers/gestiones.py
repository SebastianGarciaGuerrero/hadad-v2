"""
Endpoints HTTP para gestiones (el historial de acciones, INMUTABLE).

Endpoints:
  GET  /api/gestiones/tipos      → catálogo de tipos de gestión (para selects)
  GET  /api/gestiones            → listar (normalmente filtrado por cobranza_id)
  GET  /api/gestiones/{id}       → obtener una, con su tipo anidado
  POST /api/gestiones            → registrar una gestión nueva

*** NO hay PUT ni DELETE: las gestiones son inmutables. ***
Si una gestión quedó mal, se registra una gestión correctiva nueva.
"""

from uuid import UUID
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models.gestion import Gestion, TipoGestion
from app.models.cobranza import Cobranza
from app.schemas.gestion import (
    GestionCreate,
    GestionResponse,
    GestionDetalle,
    TipoGestionResponse,
)


router = APIRouter(
    prefix="/api/gestiones",
    tags=["Gestiones"]
)


@router.get("/tipos", response_model=List[TipoGestionResponse])
def listar_tipos_gestion(
    solo_activos: bool = True,
    db: Session = Depends(get_db)
):
    """Lista los tipos de gestión del catálogo (para poblar un select)."""
    query = db.query(TipoGestion)
    if solo_activos:
        query = query.filter(TipoGestion.activo.is_(True))
    return query.order_by(TipoGestion.nombre).all()


@router.get("/", response_model=List[GestionResponse])
def listar_gestiones(
    cobranza_id: Optional[UUID] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Lista gestiones, normalmente filtradas por cobranza (su historial).
    Ordena de la más reciente a la más antigua.
    """
    query = db.query(Gestion)
    if cobranza_id is not None:
        query = query.filter(Gestion.cobranza_id == cobranza_id)
    return (
        query.order_by(Gestion.fecha_gestion.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/{gestion_id}", response_model=GestionDetalle)
def obtener_gestion(gestion_id: UUID, db: Session = Depends(get_db)):
    """Obtiene una gestión por su UUID, con el tipo anidado."""
    gestion = db.query(Gestion).filter(Gestion.id == gestion_id).first()

    if not gestion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Gestión con id {gestion_id} no encontrada"
        )

    return gestion


@router.post("/", response_model=GestionResponse, status_code=status.HTTP_201_CREATED)
def crear_gestion(gestion_data: GestionCreate, db: Session = Depends(get_db)):
    """
    Registra una gestión nueva (única operación de escritura permitida).
    Valida que la cobranza exista. Si el usuario o el tipo no existen,
    PostgreSQL rechaza la inserción y se devuelve 400.
    """
    # Validar que la cobranza referenciada exista (404 explícito).
    cobranza = db.query(Cobranza).filter(Cobranza.id == gestion_data.cobranza_id).first()
    if not cobranza:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cobranza con id {gestion_data.cobranza_id} no encontrada"
        )

    # exclude_unset para que, si no envían fecha_gestion, PostgreSQL ponga NOW().
    nueva_gestion = Gestion(**gestion_data.model_dump(exclude_unset=True))

    try:
        db.add(nueva_gestion)
        db.commit()
        db.refresh(nueva_gestion)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "No se pudo registrar la gestión. Verifica que el usuario "
                "(usuario_id) y el tipo (tipo_id) existan."
            )
        )

    return nueva_gestion
