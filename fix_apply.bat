@echo off
echo === Registless authService fix ===

REM 1. Duplikált fájl törlése
echo [1/2] Duplikalt AuthScreen.js torlese a services mappából...
if exist "src\services\AuthScreen.js" (
    del "src\services\AuthScreen.js"
    echo     TORÖLVE: src\services\AuthScreen.js
) else (
    echo     Nem talalhato (mar törölve?)
)

REM 2. authService.js csere
echo [2/2] authService.js csere...
copy /Y authService.js src\services\authService.js
echo     KÉSZ: src\services\authService.js frissítve

echo.
echo === Minden kész! Következő lépések: ===
echo 1. eas build -p android --profile preview
echo 2. APK telepítés: adb -s R3CX80CBJGH install -r app.apk
echo.
pause
