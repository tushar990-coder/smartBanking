using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Management;
using System.Runtime.Versioning;

namespace Bhisi.LicenseGenerator
{
    [SupportedOSPlatform("windows")]
    class Program
    {
        static void Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("==================================================================");
            Console.WriteLine("    स्मार्ट बँकिंग (SmartBanking ERP) - Offline License Generator");
            Console.WriteLine("                  (Vendor RSA-2048 Signer)");
            Console.WriteLine("==================================================================");
            Console.ResetColor();

            string privateKeyPath = FindPrivateKeyPath();
            if (string.IsNullOrEmpty(privateKeyPath) || !File.Exists(privateKeyPath))
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("\n[ERROR] vendor_private_key.xml फाईल सापडली नाही! Please check 'keys' folder.");
                Console.ResetColor();
                return;
            }

            string privateKeyXml = File.ReadAllText(privateKeyPath, Encoding.UTF8);

            string sansthaName = "श्री गुरुदेव नागरी सहकारी पतसंस्था";
            string clientName = "Admin";
            string machineCode = "";
            int validityDays = 365;
            string planName = "SmartBanking-Enterprise";

            bool autoLocal = args.Length > 0 && (args[0] == "--current-machine" || args[0] == "--auto");

            if (autoLocal)
            {
                machineCode = GetLocalMachineCode();
                Console.WriteLine($"[AUTO] Current Machine Detected: {machineCode}");
            }
            else
            {
                string localCode = GetLocalMachineCode();
                Console.WriteLine($"\nसध्याच्या कॉम्प्युटरचा Machine Code: {localCode}");
                Console.WriteLine("------------------------------------------------------------------");

                Console.Write($"१. संस्थेचे नाव [{sansthaName}]: ");
                string? sInput = Console.ReadLine()?.Trim();
                if (!string.IsNullOrWhiteSpace(sInput)) sansthaName = sInput;

                Console.Write($"२. संपर्क व्यक्ती / क्लायंट नाव [{clientName}]: ");
                string? cInput = Console.ReadLine()?.Trim();
                if (!string.IsNullOrWhiteSpace(cInput)) clientName = cInput;

                Console.Write($"३. क्लायंट कॉम्प्युटरचा Machine Code [एंटर दाबल्यास सध्याचा कोड ({localCode}) घेतला जाईल]: ");
                string? mInput = Console.ReadLine()?.Trim();
                machineCode = string.IsNullOrWhiteSpace(mInput) ? localCode : mInput;

                Console.Write($"४. लायसन्स मुदत (दिवसांमध्ये / Days) [{validityDays}]: ");
                string? dInput = Console.ReadLine()?.Trim();
                if (int.TryParse(dInput, out int d) && d > 0) validityDays = d;

                Console.Write("५. प्लॅन प्रकार [1=Full ERP (Default), 2=Standard]: ");
                string? pInput = Console.ReadLine()?.Trim();
                if (pInput == "2") planName = "SmartBanking-Standard";
            }

            DateTime issueDate = DateTime.Today.AddDays(-1); // Allow clock jitter
            DateTime expiryDate = issueDate.AddDays(validityDays + 1);

            var payload = new
            {
                ClientName = clientName,
                SansthaName = sansthaName,
                MachineCode = machineCode,
                IssuedDate = issueDate,
                ExpiryDate = expiryDate,
                MaxBranches = 5,
                PlanName = planName,
                EnabledFeatures = new[] { "SAVINGS", "LOANS", "FD", "PIGMY", "LOCKER", "SHARES", "DAYBOOK", "REPORTS", "AUDIT" }
            };

            string payloadJson = JsonSerializer.Serialize(payload, new JsonSerializerOptions { WriteIndented = false });
            string signatureBase64 = SignData(payloadJson, privateKeyXml);

            var signedLicense = new
            {
                PayloadJson = payloadJson,
                Signature = signatureBase64
            };

            string outputLicenseJson = JsonSerializer.Serialize(signedLicense, new JsonSerializerOptions { WriteIndented = true });

            // Save to root, API dir, and GeneratedLicenses dir
            SaveLicenseFiles(outputLicenseJson, sansthaName);

            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("\n==================================================================");
            Console.WriteLine("       अभिनंदन! डिजिटल स्वाक्षरी असलेले लायसन्स तयार झाले! ");
            Console.WriteLine("==================================================================");
            Console.ResetColor();

            Console.WriteLine($"संस्था नाव     : {sansthaName}");
            Console.WriteLine($"मशीन कोड       : {machineCode}");
            Console.WriteLine($"जारी तारीख     : {issueDate:dd-MM-yyyy}");
            Console.WriteLine($"समाप्ती तारीख  : {expiryDate:dd-MM-yyyy} ({validityDays} दिवस)");
            Console.WriteLine($"प्लॅन          : {planName}");

            Console.WriteLine("\n'license.lic' फाईल सेव्ह झाली आहे आणि सक्रिय झाली आहे.");
            if (!autoLocal)
            {
                Console.WriteLine("\nPress any key to close...");
                Console.ReadKey();
            }
        }

        private static void SaveLicenseFiles(string json, string sansthaName)
        {
            try
            {
                string outputDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "GeneratedLicenses");
                Directory.CreateDirectory(outputDir);
                string safeName = string.Join("_", sansthaName.Split(Path.GetInvalidFileNameChars()));
                File.WriteAllText(Path.Combine(outputDir, $"license_{safeName}_{DateTime.Now:yyyyMMdd_HHmmss}.lic"), json, Encoding.UTF8);
                File.WriteAllText(Path.Combine(outputDir, "license.lic"), json, Encoding.UTF8);

                // Also copy to API project and solution root if present
                string apiLicensePath = "D:\\Bhisi Software\\api\\Bhisi.Api\\license.lic";
                string rootLicensePath = "D:\\Bhisi Software\\license.lic";
                string offlineReleaseLicensePath = "D:\\Bhisi Software\\OfflineRelease\\license.lic";

                try { File.WriteAllText(apiLicensePath, json, Encoding.UTF8); } catch { }
                try { File.WriteAllText(rootLicensePath, json, Encoding.UTF8); } catch { }
                try { if (Directory.Exists("D:\\Bhisi Software\\OfflineRelease")) File.WriteAllText(offlineReleaseLicensePath, json, Encoding.UTF8); } catch { }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Notice: {ex.Message}");
            }
        }

        private static string SignData(string data, string privateKeyXml)
        {
            using var rsa = RSA.Create();
            rsa.FromXmlString(privateKeyXml);
            byte[] dataBytes = Encoding.UTF8.GetBytes(data);
            byte[] signature = rsa.SignData(dataBytes, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
            return Convert.ToBase64String(signature);
        }

        private static string GetLocalMachineCode()
        {
            try
            {
                string cpuId = GetWmiProperty("Win32_Processor", "ProcessorId");
                string motherBoardSerial = GetWmiProperty("Win32_BaseBoard", "SerialNumber");
                string biosSerial = GetWmiProperty("Win32_BIOS", "SerialNumber");
                string diskSerial = GetWmiProperty("Win32_LogicalDisk WHERE DeviceID='C:'", "VolumeSerialNumber");

                if (string.IsNullOrWhiteSpace(cpuId) && string.IsNullOrWhiteSpace(motherBoardSerial))
                {
                    cpuId = Environment.MachineName + "_" + Environment.ProcessorCount;
                    motherBoardSerial = Environment.OSVersion.VersionString;
                }

                string combinedRaw = $"CPU:{cpuId}|MB:{motherBoardSerial}|BIOS:{biosSerial}|DISK:{diskSerial}";

                using var sha256 = SHA256.Create();
                byte[] hashBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(combinedRaw));
                string hex = Convert.ToHexString(hashBytes).ToUpperInvariant();

                return $"SB-MCH-{hex.Substring(0, 4)}-{hex.Substring(4, 4)}-{hex.Substring(8, 4)}-{hex.Substring(12, 4)}";
            }
            catch
            {
                string fallback = Environment.MachineName + "_" + Environment.UserName;
                using var sha256 = SHA256.Create();
                byte[] hashBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(fallback));
                string hex = Convert.ToHexString(hashBytes).ToUpperInvariant();
                return $"SB-MCH-{hex.Substring(0, 4)}-{hex.Substring(4, 4)}-{hex.Substring(8, 4)}-{hex.Substring(12, 4)}";
            }
        }

        private static string GetWmiProperty(string wmiClass, string propertyName)
        {
            try
            {
                using var searcher = new ManagementObjectSearcher($"SELECT {propertyName} FROM {wmiClass}");
                foreach (var item in searcher.Get())
                {
                    var val = item[propertyName]?.ToString();
                    if (!string.IsNullOrWhiteSpace(val)) return val.Trim();
                }
            }
            catch { }
            return string.Empty;
        }

        private static string FindPrivateKeyPath()
        {
            string[] possiblePaths = new[]
            {
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "vendor_private_key.xml"),
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "..", "keys", "vendor_private_key.xml"),
                Path.Combine(Directory.GetCurrentDirectory(), "keys", "vendor_private_key.xml"),
                Path.Combine(Directory.GetCurrentDirectory(), "..", "keys", "vendor_private_key.xml"),
                "D:\\Bhisi Software\\keys\\vendor_private_key.xml"
            };

            foreach (var p in possiblePaths)
            {
                try
                {
                    string fullPath = Path.GetFullPath(p);
                    if (File.Exists(fullPath)) return fullPath;
                }
                catch { }
            }
            return "";
        }
    }
}
