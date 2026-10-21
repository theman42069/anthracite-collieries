@echo off
rem Double-click to rebuild CREDITS-TODO.md, the photo credits checklist.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0credits-report.ps1"
pause
