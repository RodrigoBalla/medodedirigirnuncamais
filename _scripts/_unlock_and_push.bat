@echo off
cd /d "%~dp0"
(
echo === Removendo locks ===
del /F /Q ".git\index.lock" 2^>nul
del /F /Q ".git\index.lock.bak" 2^>nul
del /F /Q ".git\index.corrupt.bak" 2^>nul
echo === Resetando index ===
del /F /Q ".git\index" 2^>nul
git reset HEAD
echo === Git status ===
git status --short
echo === Git add ===
git add -A
echo === Git commit ===
git commit -m "feat(admin/alunos): copiar link e reenviar email de primeiro acesso"
echo === Git push ===
git push origin main 2^>^&1
echo === Log ===
git log --oneline -3
echo.
echo === FIM ===
) > _unlock_and_push.log 2>&1
exit
