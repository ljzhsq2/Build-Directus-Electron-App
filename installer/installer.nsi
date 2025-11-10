; ===================================================================
; Directus Desktop 11.5.1 - NSIS 安装脚本
; ===================================================================

; 包含必要的头文件
!include "MUI2.nsh"
!include "FileFunc.nsh"

; ===================================================================
; 应用信息
; ===================================================================
!define PRODUCT_NAME "Directus Desktop"
!define PRODUCT_VERSION "VERSION_PLACEHOLDER"
!define PRODUCT_PUBLISHER "Directus Desktop"
!define PRODUCT_WEB_SITE "https://github.com/ljzhsq2/Build-Directus-Electron-App"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "Directus-Desktop-Setup-${PRODUCT_VERSION}.exe"
InstallDir "$PROGRAMFILES\Directus Desktop"
InstallDirRegKey HKLM "Software\${PRODUCT_NAME}" "InstallDir"

RequestExecutionLevel admin
SetCompressor /SOLID lzma

; ===================================================================
; 界面设置
; ===================================================================
!define MUI_ABORTWARNING
!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"

; 欢迎页面
!insertmacro MUI_PAGE_WELCOME

; 许可协议页面
!insertmacro MUI_PAGE_LICENSE "LICENSE.txt"

; 安装目录选择页面
!insertmacro MUI_PAGE_DIRECTORY

; 安装进度页面
!insertmacro MUI_PAGE_INSTFILES

; 完成页面
!define MUI_FINISHPAGE_RUN "$INSTDIR\start.bat"
!define MUI_FINISHPAGE_RUN_TEXT "启动 Directus Desktop"
!insertmacro MUI_PAGE_FINISH

; 卸载页面
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; 语言
!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"

; ===================================================================
; 安装部分
; ===================================================================
Section "MainSection" SEC01
    SetOutPath "$INSTDIR"
    SetOverwrite on

    ; 显示安装信息
    DetailPrint "正在安装 Directus Desktop ${PRODUCT_VERSION}..."

    ; 复制运行时文件
    DetailPrint "正在复制运行时文件..."
    File /r "runtime"

    ; 复制启动脚本
    DetailPrint "正在复制启动脚本..."
    File "start.bat"
    File "stop.bat"

    ; 创建桌面快捷方式
    DetailPrint "正在创建快捷方式..."
    CreateShortCut "$DESKTOP\Directus Desktop.lnk" "$INSTDIR\start.bat" "" "$INSTDIR\runtime\node.exe" 0

    ; 创建开始菜单快捷方式
    CreateDirectory "$SMPROGRAMS\Directus Desktop"
    CreateShortCut "$SMPROGRAMS\Directus Desktop\Directus Desktop.lnk" "$INSTDIR\start.bat" "" "$INSTDIR\runtime\node.exe" 0
    CreateShortCut "$SMPROGRAMS\Directus Desktop\停止 Directus.lnk" "$INSTDIR\stop.bat"
    CreateShortCut "$SMPROGRAMS\Directus Desktop\卸载.lnk" "$INSTDIR\uninstall.exe"

    ; 创建用户数据目录
    DetailPrint "正在创建用户数据目录..."
    SetShellVarContext current
    CreateDirectory "$APPDATA\directus-desktop"
    CreateDirectory "$APPDATA\directus-desktop\database"
    CreateDirectory "$APPDATA\directus-desktop\uploads"
    CreateDirectory "$APPDATA\directus-desktop\extensions"

    ; 写入 README
    DetailPrint "正在写入说明文件..."
    FileOpen $0 "$APPDATA\directus-desktop\README.txt" w
    FileWrite $0 "Directus Desktop 11.5.1$\r$\n"
    FileWrite $0 "====================$\r$\n$\r$\n"
    FileWrite $0 "数据目录说明：$\r$\n$\r$\n"
    FileWrite $0 "database\  - SQLite 数据库文件$\r$\n"
    FileWrite $0 "uploads\   - 上传的文件$\r$\n"
    FileWrite $0 "extensions\ - 扩展插件$\r$\n$\r$\n"
    FileWrite $0 "数据迁移：$\r$\n"
    FileWrite $0 "1. 关闭 Directus Desktop$\r$\n"
    FileWrite $0 "2. 备份此目录$\r$\n"
    FileWrite $0 "3. 复制到新电脑的相同位置$\r$\n$\r$\n"
    FileWrite $0 "默认登录：$\r$\n"
    FileWrite $0 "邮箱: admin@example.com$\r$\n"
    FileWrite $0 "密码: admin$\r$\n"
    FileClose $0

SectionEnd

Section -Post
    ; 写入注册表
    WriteRegStr HKLM "Software\${PRODUCT_NAME}" "InstallDir" "$INSTDIR"
    WriteRegStr HKLM "Software\${PRODUCT_NAME}" "Version" "${PRODUCT_VERSION}"

    ; 创建卸载程序
    WriteUninstaller "$INSTDIR\uninstall.exe"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayName" "${PRODUCT_NAME}"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\uninstall.exe"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"

    ; 计算安装大小
    ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
    IntFmt $0 "0x%08X" $0
    WriteRegDWORD HKLM "${PRODUCT_UNINST_KEY}" "EstimatedSize" "$0"
SectionEnd

; ===================================================================
; 卸载部分
; ===================================================================
Section Uninstall
    ; 停止 Directus 进程
    DetailPrint "正在停止 Directus 进程..."
    nsExec::ExecToLog 'taskkill /F /IM node.exe /T'
    Sleep 1000

    ; 删除快捷方式
    DetailPrint "正在删除快捷方式..."
    Delete "$DESKTOP\Directus Desktop.lnk"
    RMDir /r "$SMPROGRAMS\Directus Desktop"

    ; 删除安装文件
    DetailPrint "正在删除程序文件..."
    RMDir /r "$INSTDIR\runtime"
    Delete "$INSTDIR\start.bat"
    Delete "$INSTDIR\stop.bat"
    Delete "$INSTDIR\uninstall.exe"
    RMDir "$INSTDIR"

    ; 删除注册表
    DeleteRegKey HKLM "${PRODUCT_UNINST_KEY}"
    DeleteRegKey HKLM "Software\${PRODUCT_NAME}"

    ; 询问是否删除用户数据
    MessageBox MB_YESNO|MB_ICONQUESTION \
        "是否删除用户数据？$\n$\n数据位置：$\n$APPDATA\directus-desktop$\n$\n包括：数据库、上传文件、扩展等$\n$\n选择"否"保留数据以便将来使用" \
        IDYES DeleteData IDNO KeepData

    DeleteData:
        DetailPrint "正在删除用户数据..."
        SetShellVarContext current
        RMDir /r "$APPDATA\directus-desktop"
        Goto Done

    KeepData:
        DetailPrint "保留用户数据"
        MessageBox MB_OK|MB_ICONINFORMATION "用户数据已保留在：$\n$APPDATA\directus-desktop"

    Done:
        DetailPrint "卸载完成"
SectionEnd
