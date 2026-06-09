"""
Hadad 2.0 - Backend API
Punto de entrada principal de la aplicación FastAPI.
"""

from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.config import settings
from app.routers import clientes
from app.routers import filiales


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Sistema de cobranza extrajudicial y judicial - González & Hadad"
)


# Registrar routers (módulos de endpoints)
app.include_router(clientes.router)
app.include_router(filiales.router)


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