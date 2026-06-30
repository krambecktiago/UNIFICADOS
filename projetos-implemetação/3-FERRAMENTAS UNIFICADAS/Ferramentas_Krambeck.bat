@echo off
echo Iniciando Ferramentas Krambeck...
echo.

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Python nao encontrado.
    echo Instale em https://www.python.org/downloads/
    pause
    exit /b 1
)

echo Instalando dependencias...
python -m pip install pillow openpyxl pdfplumber --quiet --disable-pip-version-check

echo Abrindo aplicacao...
python "%~dp0ferramentas_krambeck.py"

if %errorlevel% neq 0 (
    echo.
    echo ERRO ao executar o script. Veja a mensagem acima.
)
pause
