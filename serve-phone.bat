@echo off
rem Double-click to serve this site to your phone on the same Wi-Fi.
rem The phone address is printed below. Close this window to stop.
title Colliery map - local server
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Lan
pause
