-- Core Seed Data for Banking ERP
USE [SmartBanking_Prod]
GO

-- 1. Insert Initial System Settings
-- Example: Default Admin User, Default Roles, Base Configurations
INSERT INTO [Roles] ([Name]) VALUES ('Admin'), ('Manager'), ('Cashier');

-- 2. Basic Sanstha Detail
INSERT INTO [SansthaDetails] ([Name], [RegistrationNumber], [Address], [City], [State], [ZipCode], [Phone], [Email]) 
VALUES ('Bhisi Co-operative Credit Society Ltd.', 'REG123456789', 'Main Branch', 'Pune', 'Maharashtra', '411001', '020-1234567', 'info@bhisisoftware.com');

-- 3. Initial Financial Year
INSERT INTO [FinancialYears] ([Name], [StartDate], [EndDate], [IsActive]) 
VALUES ('2026-2027', '2026-04-01', '2027-03-31', 1);

GO
