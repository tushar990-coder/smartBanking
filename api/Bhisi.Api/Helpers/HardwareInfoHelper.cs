using System;
using System.Management;
using System.Runtime.Versioning;
using System.Security.Cryptography;
using System.Text;

namespace Bhisi.Api.Helpers
{
    [SupportedOSPlatform("windows")]
    public static class HardwareInfoHelper
    {
        private static string? _cachedMachineCode;

        public static string GetMachineCode()
        {
            if (!string.IsNullOrEmpty(_cachedMachineCode))
            {
                return _cachedMachineCode;
            }

            try
            {
                string cpuId = GetWmiProperty("Win32_Processor", "ProcessorId");
                string motherBoardSerial = GetWmiProperty("Win32_BaseBoard", "SerialNumber");
                string biosSerial = GetWmiProperty("Win32_BIOS", "SerialNumber");
                string diskSerial = GetWmiProperty("Win32_LogicalDisk WHERE DeviceID='C:'", "VolumeSerialNumber");

                if (string.IsNullOrWhiteSpace(cpuId) && string.IsNullOrWhiteSpace(motherBoardSerial))
                {
                    // Fallback to MachineName + OS Info if WMI is restricted
                    cpuId = Environment.MachineName + "_" + Environment.ProcessorCount;
                    motherBoardSerial = Environment.OSVersion.VersionString;
                }

                string combinedRaw = $"CPU:{cpuId}|MB:{motherBoardSerial}|BIOS:{biosSerial}|DISK:{diskSerial}";

                using var sha256 = SHA256.Create();
                byte[] hashBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(combinedRaw));
                string hex = Convert.ToHexString(hashBytes).ToUpperInvariant();

                // Format as SB-MCH-XXXX-XXXX-XXXX-XXXX (16 chars from hash)
                string chunk1 = hex.Substring(0, 4);
                string chunk2 = hex.Substring(4, 4);
                string chunk3 = hex.Substring(8, 4);
                string chunk4 = hex.Substring(12, 4);

                _cachedMachineCode = $"SB-MCH-{chunk1}-{chunk2}-{chunk3}-{chunk4}";
                return _cachedMachineCode;
            }
            catch
            {
                // Resilient fallback
                string fallback = Environment.MachineName + "_" + Environment.UserName;
                using var sha256 = SHA256.Create();
                byte[] hashBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(fallback));
                string hex = Convert.ToHexString(hashBytes).ToUpperInvariant();
                _cachedMachineCode = $"SB-MCH-{hex.Substring(0, 4)}-{hex.Substring(4, 4)}-{hex.Substring(8, 4)}-{hex.Substring(12, 4)}";
                return _cachedMachineCode;
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
                    if (!string.IsNullOrWhiteSpace(val))
                    {
                        return val.Trim();
                    }
                }
            }
            catch
            {
                // Silently ignore WMI errors on restricted permissions
            }
            return string.Empty;
        }

        public static (string Cpu, string Motherboard, string Bios, string Disk) GetHardwareDebugInfo()
        {
            return (
                GetWmiProperty("Win32_Processor", "ProcessorId"),
                GetWmiProperty("Win32_BaseBoard", "SerialNumber"),
                GetWmiProperty("Win32_BIOS", "SerialNumber"),
                GetWmiProperty("Win32_LogicalDisk WHERE DeviceID='C:'", "VolumeSerialNumber")
            );
        }
    }
}
