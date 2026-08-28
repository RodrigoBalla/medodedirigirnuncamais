@echo off
cd /d "%~dp0"
git push origin main > _push.log 2>&1
exit
