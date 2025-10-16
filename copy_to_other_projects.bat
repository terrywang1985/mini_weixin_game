@echo off
setlocal enabledelayedexpansion

:: Set source directory (js folder in the same directory as this script)
set "source=.\js"

:: Define multiple destination directories (add more "destN" if needed)
set "dest1=../weixin_game2/test_game/js"
set "dest2=../weixin_game2/test_game_2/js"

:: Check if source directory exists
if not exist "%source%" (
    echo Error: Source directory does not exist - %source%
    pause
    exit /b 1
)

:: Copy to each destination (call the copy function)
call :copyToDir "!dest1!"
call :copyToDir "!dest2!"

:: Add more destinations here (e.g., call :copyToDir "!dest3!")

echo.
echo ==============================================
echo All directories processed successfully
pause
exit /b 0

:: Copy function (parameter: destination path)
:copyToDir
set "dest=%~1"
echo.
echo ==============================================
echo Processing destination directory: %dest%

:: Create destination directory if it doesn't exist
if not exist "%dest%" (
    echo Destination directory not found, creating...
    md "%dest%" >nul 2>&1
    if errorlevel 1 (
        echo Error: Failed to create destination directory - %dest%
        goto :eof
    )
)

:: Execute copy (E=copy subdirs, H=copy hidden files, Y=force overwrite)
echo Copying files...
xcopy "%source%\*" "%dest%\" /E /H /Y >nul 2>&1

:: Check copy result
if errorlevel 1 (
    echo Error: Failed to copy to %dest%
) else (
    echo Success: Copy to %dest% completed
)
goto :eof