@echo off
rem Anger Galaxy - starts a local server and opens it in the browser.
rem ES modules do not work over file://, so a small HTTP server is required.
cd /d "%~dp0"
start "" http://127.0.0.1:8765/
python -m http.server 8765 --bind 127.0.0.1
