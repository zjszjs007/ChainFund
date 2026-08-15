@echo off
chcp 65001 >nul
setlocal

REM 切换到本脚本所在目录（兼容双击运行，无论从哪打开）
cd /d "%~dp0"

REM 确保 node 可用：先查 PATH，找不到再用 WorkBuddy 管理的 node 路径兜底
where node >nul 2>&1
if errorlevel 1 (
    set "N_PREFIX=C:\Users\LiuXiaolong\.workbuddy\binaries\node\versions\22.22.2"
    if exist "%N_PREFIX%\node.exe" (
        set "PATH=%N_PREFIX%;%PATH%"
    ) else (
        echo [错误] 未找到 node，请先安装 Node.js 18+ 后重试。
        pause
        exit /b 1
    )
)

echo ============================================
echo   ChainFund 一键本地启动
echo   浏览器访问： http://localhost:5173
echo ============================================
echo.

node start-dev.cjs
if errorlevel 1 (
    echo.
    echo [启动异常] 请查看上方日志或 chainfund-node.log / chainfund-frontend.log
    pause
    exit /b 1
)

echo.
echo 启动完成。若浏览器未自动打开，请手动访问 http://localhost:5173
echo （关闭本窗口不会停止后台服务；停止请结束 Hardhat / Vite 进程）
pause
