@echo off
chcp 65001 >nul
cls
echo ========================================
echo   Estado del container Hadad PostgreSQL
echo ========================================
echo.

docker ps --filter "name=hadad-postgres" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo.
echo ========================================
echo   Ultimos 30 logs
echo ========================================
docker compose logs --tail 30 postgres

echo.
echo ========================================
echo   Verificacion rapida de tablas
echo ========================================
docker exec hadad-postgres psql -U hadad_admin -d hadad_v2 -c "SELECT count(*) AS total_tablas FROM information_schema.tables WHERE table_schema = 'public';"

echo.
pause
