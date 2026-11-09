@echo off
cd /d "%~dp0"
if not exist import\old.xlsx (
  echo File import\old.xlsx not found.
  pause
  exit /b
)
docker compose up -d db
docker compose run --rm app node migrate.js /import/old.xlsx
docker compose up -d
pause
