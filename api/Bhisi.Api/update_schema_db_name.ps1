$header = @"
-- ============================================================================
-- SmartBanking ERP - Complete Empty Database Schema Creation Script
-- Target Database Name: Gurudev_SmartBanking
-- Generated Date: 2026-08-06
-- Includes: All 100 Tables, Primary Keys, Foreign Keys, Indexes & Latest Schema Updates
-- ============================================================================

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'Gurudev_SmartBanking')
BEGIN
    CREATE DATABASE [Gurudev_SmartBanking];
END;
GO

USE [Gurudev_SmartBanking];
GO

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

# Clean any existing top header up to the first BEGIN TRANSACTION
if ($existingContent -match "(?s)^.*?BEGIN TRANSACTION;") {
    $existingContent = $existingContent -replace "(?s)^.*?BEGIN TRANSACTION;", "BEGIN TRANSACTION;"
}

$fullScript = $header + $existingContent
Set-Content -Path "Create_Empty_Database_Schema.sql" -Value $fullScript -Encoding UTF8

Write-Host "Create_Empty_Database_Schema.sql updated to target database Gurudev_SmartBanking!" -ForegroundColor Green
