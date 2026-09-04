; Inno Setup Script for SmartBanking ERP Offline Setup
; ==========================================================

#define MyAppName "SmartBanking ERP"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "SmartBanking Solutions"
#define MyAppExeName "Bhisi.Api.exe"

[Setup]
AppId={{4A51D683-5F1A-4F39-B945-8C1B317E3F11}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName=C:\SmartBankingERP
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=..\installer_output
OutputBaseFilename=SmartBanking_Setup_v1.0
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "firewallrule"; Description: "स्थानिक नेटवर्क (LAN) साठी विंडोज फायरवॉल पोर्ट उघडा (Allow LAN access on Port 5242)"; GroupDescription: "नेटवर्क सेटिंग्ज (Network):"

[Files]
Source: "..\OfflineRelease\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\StartSmartBanking.bat"; WorkingDir: "{app}"
Name: "{group}\सर्व्हर बंद करा (Stop Server)"; Filename: "{app}\StopSmartBanking.bat"; WorkingDir: "{app}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\StartSmartBanking.bat"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "netsh"; Parameters: "advfirewall firewall add rule name=""SmartBanking ERP LAN 5242"" dir=in action=allow protocol=TCP localport=5242"; Flags: runhidden; Tasks: firewallrule
Filename: "{app}\StartSmartBanking.bat"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: shellexec postinstall nowait skipifsilent

[UninstallRun]
Filename: "taskkill"; Parameters: "/F /IM Bhisi.Api.exe"; Flags: runhidden
Filename: "netsh"; Parameters: "advfirewall firewall delete rule name=""SmartBanking ERP LAN 5242"""; Flags: runhidden
