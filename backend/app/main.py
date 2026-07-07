"""
Hadad 2.0 - Backend API
Punto de entrada principal de la aplicación FastAPI.
"""

from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.config import settings
# Modelos sin router propio todavía: se importan para registrar sus tablas en
# el metadata de SQLAlchemy, necesario para resolver las FK que apuntan a ellas
# (cobranzas.ejecutivo_id/paciente_id, gestiones/acuerdos.usuario_id).
from app.models import rol, usuario, paciente  # noqa: F401

# Auditoría automática: importar este módulo registra el listener que escribe
# en audit_log cada INSERT/UPDATE/DELETE de las tablas de negocio.
from app import auditoria  # noqa: F401

from app.routers import auth
from app.routers import usuarios
from app.routers import clientes
from app.routers import filiales
from app.routers import deudores
from app.routers import cobranzas
from app.routers import gestiones
from app.routers import acuerdos
from app.routers import pagos
from app.routers import judicial
from app.routers import exportar
from app.routers import auditoria as auditoria_router


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Sistema de cobranza extrajudicial y judicial - González & Hadad"
)


# Registrar routers (módulos de endpoints)
app.include_router(auth.router)
app.include_router(usuarios.router)
app.include_router(clientes.router)
app.include_router(filiales.router)
app.include_router(deudores.router)
app.include_router(cobranzas.router)
app.include_router(gestiones.router)
app.include_router(acuerdos.router)
app.include_router(pagos.router)
app.include_router(judicial.router)
app.include_router(exportar.router)
app.include_router(auditoria_router.router)


@app.get("/")
def root():
    return {
        "mensaje": "Hadad 2.0 API funcionando correctamente",
        "documentacion": "/docs"
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": "0.1.0",
        "environment": settings.environment
    }


@app.get("/api/health/db")
def health_check_db(db: Session = Depends(get_db)):
    try:
        resultado = db.execute(
            text("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")
        ).scalar()
        return {
            "status": "ok",
            "database": "PostgreSQL 16",
            "tablas_encontradas": resultado
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))