[System.Reflection.Assembly]::LoadWithPartialName('Microsoft.SqlServer.Smo') | Out-Null
[System.Reflection.Assembly]::LoadWithPartialName('Microsoft.SqlServer.SmoExtended') | Out-Null

$serverName = ".\SQLEXPRESS01"
$dbName = "SmartBanking_Template"
$outputFile = "d:\Bhisi Software\tools\template_export\SmartBanking_Template_Complete_Script.sql"

$server = New-Object Microsoft.SqlServer.Management.Smo.Server($serverName)
$db = $server.Databases[$dbName]

if ($null -eq $db) {
    Write-Error "Database $dbName not found."
    exit 1
}

$scripter = New-Object Microsoft.SqlServer.Management.Smo.Scripter($server)
$scripter.Options.ScriptSchema = $true
$scripter.Options.ScriptData = $true
$scripter.Options.Indexes = $true
$scripter.Options.Triggers = $true
$scripter.Options.DriAll = $true
$scripter.Options.NoCollation = $true
$scripter.Options.IncludeDatabaseContext = $true
$scripter.Options.AnsiPadding = $true
$scripter.Options.IncludeHeaders = $true
$scripter.Options.ToFileOnly = $false
$scripter.Options.FileName = $outputFile

# Script all tables
$tables = $db.Tables | Where-Object { -not $_.IsSystemObject }
Write-Host "Found $($tables.Count) user tables."

$sw = New-Object System.IO.StreamWriter($outputFile, $false, [System.Text.Encoding]::UTF8)

# Write header
$sw.WriteLine("-- ===========================================================================")
$sw.WriteLine("-- SmartBanking_Template - Master CBS Database Template (Pure CIF-First)")
$sw.WriteLine("-- Target: Production / VPS Deployment")
$sw.WriteLine("-- Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
$sw.WriteLine("-- Includes: All Schemes, 91 Group Ledgers, 410 Ledgers, Sanstha Info,")
$sw.WriteLine("--           Branch 1, Admin User & Roles, Financial Year, Bank Masters.")
$sw.WriteLine("-- Zero test records. All IDs and Sequences start strictly at 1.")
$sw.WriteLine("-- ===========================================================================")
$sw.WriteLine("USE master;")
$sw.WriteLine("GO")
$sw.WriteLine("IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'$dbName')")
$sw.WriteLine("BEGIN")
$sw.WriteLine("    CREATE DATABASE [$dbName];")
$sw.WriteLine("END")
$sw.WriteLine("GO")
$sw.WriteLine("USE [$dbName];")
$sw.WriteLine("GO")
$sw.WriteLine("SET ANSI_NULLS ON;")
$sw.WriteLine("SET QUOTED_IDENTIFIER ON;")
$sw.WriteLine("GO")

# Generate scripts in order
Write-Host "Scripting tables (schema and master data)..."
foreach ($tbl in $tables) {
    $scripts = $scripter.EnumScript($tbl)
    foreach ($line in $scripts) {
        $sw.WriteLine($line)
        $sw.WriteLine("GO")
    }
}

# Also script views
Write-Host "Scripting views..."
foreach ($view in $db.Views) {
    if (-not $view.IsSystemObject) {
        $scripts = $scripter.EnumScript($view)
        foreach ($line in $scripts) {
            $sw.WriteLine($line)
            $sw.WriteLine("GO")
        }
    }
}

# Also script stored procedures
Write-Host "Scripting stored procedures..."
foreach ($sp in $db.StoredProcedures) {
    if (-not $sp.IsSystemObject) {
        $scripts = $scripter.EnumScript($sp)
        foreach ($line in $scripts) {
            $sw.WriteLine($line)
            $sw.WriteLine("GO")
        }
    }
}

$sw.Close()
Write-Host "Successfully generated SQL script at $outputFile"
