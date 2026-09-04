$rsa = New-Object System.Security.Cryptography.RSACryptoServiceProvider(2048)
$privXml = $rsa.ToXmlString($true)
$pubXml = $rsa.ToXmlString($false)

$dir = "d:\Bhisi Software\keys"
if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir }
Set-Content -Path "$dir\vendor_private_key.xml" -Value $privXml
Set-Content -Path "$dir\client_public_key.xml" -Value $pubXml
Write-Host "RSA 2048 XML Keys created successfully in $dir"
