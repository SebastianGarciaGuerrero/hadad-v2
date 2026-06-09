@echo off
chcp 65001 >nul
cls
echo ========================================
echo   Consola SQL - Hadad 2.0
echo ========================================
echo.
echo Estas dentro de PostgreSQL.
echo Comandos utiles:
echo   \dt              Listar todas las tablas
echo   \d nombre_tabla  Ver estructura de una tabla
echo   \q               Salir
echo.


docker exec -it hadad-postgres psql -U hadad_admin -d hadad_v2
