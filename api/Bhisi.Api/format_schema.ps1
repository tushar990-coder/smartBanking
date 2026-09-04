$header = @"
-- ============================================================================
-- SmartBanking ERP - Complete Empty Database Schema Creation Script
-- Generated Date: 2026-08-06
-- Includes: All 100 Tables, Primary Keys, Foreign Keys, Indexes & Latest Schema Updates
-- ============================================================================

-- INSTRUCTIONS FOR SERVER DEPLOYMENT:
-- 1. Open SQL Server Management Studio (SSMS) on server.
-- 2. Create a new empty database (e.g. SmartBanking_Prod or SmartBanking_Gurudev).
-- 3. Select your new database and Execute (F5) this script.

IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

"@

$existingContent = Get-Content -Path "Create_Empty_Database_Schema.sql" -Raw
# Strip any leading __EFMigrationsHistory block if present to avoid duplication
if ($existingContent -match "IF OBJECT_ID\(N'\[__EFMigrationsHistory\]'\) IS NULL[\s\S]*?GO") {
    $existingContent = $existingContent -replace "IF OBJECT_ID\(N'\[__EFMigrationsHistory\]'\) IS NULL[\s\S]*?GO", ""
}

$fullScript = $header + $existingContent
Set-Content -Path "Create_Empty_Database_Schema.sql" -Value $fullScript -Encoding UTF8

Write-Host "Create_Empty_Database_Schema.sql updated successfully!" -ForegroundColor Green
