@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================================
echo          🚀 Antigravity 中文本地化 GitHub 一键推送
echo ========================================================
echo.

git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo [提示] 检测到尚未绑定 GitHub 远程仓库！
    echo 请先在 GitHub 创建一个新仓库 (https://github.com/new)
    set /p repo_url=请输入您的 GitHub 仓库地址 (如 https://github.com/xxx/xxx.git): 
    if "%repo_url%"=="" (
        echo [错误] 仓库地址不能为空！
        pause
        exit /b 1
    )
    git remote add origin %repo_url%
    echo [成功] 已成功绑定远程仓库！
    echo.
)

echo [1/3] 正在添加所有改动到暂存区...
git add .

echo [2/3] 正在提交本地更新...
set commit_msg=chore: update antigravity i18n
set /p custom_msg=请输入提交说明 (直接回车默认为: %commit_msg%): 
if not "%custom_msg%"=="" set commit_msg=%custom_msg%
git commit -m "%commit_msg%" >nul 2>&1

echo [3/3] 正在推送到 GitHub (main 分支)...
git push -u origin main

if errorlevel 1 (
    echo.
    echo ❌ [推送失败] 请检查：
    echo 1. 网络是否畅通 (是否能访问 github.com)
    echo 2. 仓库地址是否正确且具备写入权限
    echo.
) else (
    echo.
    echo 🎉 [推送成功] 项目已全部成功同步至 GitHub！
    echo.
)

pause
