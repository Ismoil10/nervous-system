@echo off
rem Brain System - starts a local server and opens it in the browser.
rem ES modules do not work over file://, so a small HTTP server is required.
cd /d "%~dp0"
start "" http://127.0.0.1:8768/
python -m http.server 8768 --bind 127.0.0.1
