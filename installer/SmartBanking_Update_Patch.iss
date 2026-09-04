; Inno Setup Script for SmartBanking ERP - 1-Click Update Patch
; ===============================================================

#define MyAppName "SmartBanking ERP Update Patch"
#define MyAppVersion "2.0.0"
#define MyAppPublisher "SmartBanking Solutions"

[Setup]
AppId={{4A51D683-5F1A-4F39-B945-8C1B317E3F11}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName=C:\SmartBankingERP
DisableDirPage=no
DirExistsWarning=no
OutputDir=..\installer_output
OutputBaseFilename=SmartBanking_Update_Patch_v2.0
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64

[Files]
; Only update application binaries and web assets - NEVER overwrite database or config files
Source: "..\OfflineRelease\Bhisi.Api.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\OfflineRelease\wwwroot\*"; DestDir: "{app}\wwwroot"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\OfflineRelease\StartSmartBanking.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\OfflineRelease\StopSmartBanking.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\OfflineRelease\ApplyUpdate.bat"; DestDir: "{app}"; Flags: ignoreversion

[InstallDelete]
; Clean old web cache if needed
Type: files; Name: "{app}\wwwroot\assets\*.map"

[Run]
; Stop running server before updating
Filename: "taskkill"; Parameters: "/F /IM Bhisi.Api.exe"; Flags: runhidden; StatusMsg: "चालू सर्व्हर थांबवत आहे..."
; Start server after update completes
Filename: "{app}\StartSmartBanking.bat"; Description: "स्मार्ट बँकिंग सुरू करा (Launch SmartBanking ERP)"; Flags: shellexec postinstall nowait skipifsilent
