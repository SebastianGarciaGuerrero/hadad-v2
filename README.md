---
title: Hadad 2.0 Demo
emoji: 📁
colorFrom: gray
colorTo: gray
sdk: docker
app_port: 8000
pinned: false
---

# Hadad 2.0

Sistema de cobranza extrajudicial y judicial para González & Hadad Profesionales Asociados.

## Stack
- **Backend:** Python 3.12 + FastAPI
- **Frontend:** React 18 + TypeScript + Vite
- **Base de datos:** PostgreSQL 16
- **Contenedores:** Docker + Docker Compose

## Estructura del proyecto

```
hadad-v2/
├── .env                  ← Variables de entorno (NO subir a Git)
├── .env.example          ← Plantilla pública
├── .gitignore
├── docker-compose.yml    ← Configuración de containers
├── database/
│   └── init/             ← Scripts SQL de inicialización
│       ├── 001_schema.sql      ← DDL completo
│       └── 002_verificacion.sql ← Datos de prueba
├── backend/              ← (próximo paso)
└── frontend/             ← (más adelante)
```

## Setup inicial

### Requisitos
- Docker Desktop instalado y corriendo
- Git (opcional pero recomendado)

### Levantar la base de datos
```bash
docker compose up -d
```

### Detener
```bash
docker compose down
```

### Reset total (borra todos los datos)
```bash
docker compose down -v
docker compose up -d
```

## Conexión desde DBeaver

| Campo | Valor |
|---|---|
| Host | localhost |
| Port | 5433 |
| Database | hadad_v2 |
| Username | hadad_admin |
| Password | desarrollo_local_2026 |

## Documentación
Ver `SPEC.md` para el esquema completo y decisiones de arquitectura.
