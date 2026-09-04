using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Bhisi.Api.Data;
using Bhisi.Api.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Bhisi.Api.Services
{
    public class LicenseService : ILicenseService
    {
        // Embedded RSA 2048-bit Public Key
        private const string VENDOR_PUBLIC_KEY_XML = @"<RSAKeyValue><Modulus>mOFzlWrQD0VOZGu6ZwQG085SM+ZGEU68fPUjJf2775acfb9tVdEFk+vdEtjo2POn5yIzlppmXmGFbzgfCjoi+qAvsrsIgMXSQkyja3yuP+5gMMU/i0M5ZCuBGOIA9QU6z7Hi3DhMPCjT+x3muktcT8h6tq0ox9U+qcFJvYwIqDIkmJpZsKSEXmCNS+8NualqBQkqbrm+b4My9J2n3V1dWD+5QXJN9m9A4eI1RMfXaeHLQVotSdrVR51ghjSOPuvlvDn1n9sdhoXSzFqTInlzj00oymQ44zPFe1atm/xOl9Khv6mG1VceJTFcqOQVKq/jNcWbSmut46bzv0gBYDudnQ==</Modulus><Exponent>AQAB</Exponent></RSAKeyValue>";

        private readonly ILogger<LicenseService> _logger;
        private readonly IServiceProvider _serviceProvider;
        private readonly IWebHostEnvironment _env;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private static LicenseStatusDto? _cachedStatus;
        private static DateTime _lastChecked = DateTime.MinValue;

        public LicenseService(ILogger<LicenseService> logger, IServiceProvider serviceProvider, IWebHostEnvironment env, IHttpContextAccessor httpContextAccessor)
        {
            _logger = logger;
            _serviceProvider = serviceProvider;
            _env = env;
            _httpContextAccessor = httpContextAccessor;
        }

        public string GetMachineCode()
        {
            return HardwareInfoHelper.GetMachineCode();
        }

        public LicenseStatusDto GetLicenseStatus()
        {
            // 1. Bypass license check in Development Mode for seamless debugging
            if (_env.IsDevelopment())
            {
                return new LicenseStatusDto
                {
                    IsValid = true,
                    StatusCode = "DEVELOPMENT_MODE",
                    Message = "डेव्हलपमेंट मोड सक्रिय आहे (License Bypass for Development & Debugging)",
                    MachineCode = GetMachineCode(),
                    ClientName = "Developer Environment",
                    SansthaName = "विकासक चाचणी शाखा (Developer Testing)",
                    IssuedDate = DateTime.Today.AddDays(-30),
                    ExpiryDate = DateTime.Today.AddYears(10),
                    DaysRemaining = 3650,
                    PlanName = "SmartBanking-Enterprise-Dev",
                    EnabledFeatures = new() { "SAVINGS", "LOANS", "FD", "PIGMY", "LOCKER", "SHARES", "DAYBOOK", "REPORTS", "AUDIT", "SEC101" }
                };
            }

            // 2. Online Wildcard Domain Authorization (*.hellomindspace.in for cloud VPS testing)
            string currentHost = GetCurrentRequestHost();
            if (IsAuthorizedWildcardDomain(currentHost))
            {
                return new LicenseStatusDto
                {
                    IsValid = true,
                    StatusCode = "ACTIVE",
                    LicenseType = "ONLINE_VPS",
                    Message = $"ऑनलाइन चाचणी परवाना सक्रिय आहे ({currentHost})",
                    MachineCode = GetMachineCode(),
                    ClientName = "Hellomindspace Cloud Testing",
                    SansthaName = "श्री जोतिर्लिंग नागरी सहकारी पतसंस्था",
                    ActiveDomain = currentHost,
                    IssuedDate = DateTime.Today.AddDays(-30),
                    ExpiryDate = DateTime.Today.AddYears(5),
                    DaysRemaining = 1825,
                    PlanName = "SmartBanking-Cloud-Enterprise",
                    EnabledFeatures = new() { "CORE", "SAVINGS", "LOANS", "FD", "RD", "PIGMY", "LOCKER", "SHARES", "DAYBOOK", "REPORTS", "AUDIT", "SEC101" }
                };
            }

            // 3. Cache valid status for 10 minutes to prevent disk/crypto overhead on every API call
            if (_cachedStatus != null && _cachedStatus.IsValid && (DateTime.Now - _lastChecked).TotalMinutes < 10)
            {
                return _cachedStatus;
            }

            var result = ValidateCurrentLicense();
            _cachedStatus = result;
            _lastChecked = DateTime.Now;
            return result;
        }

        public async Task<LicenseStatusDto> ActivateLicenseAsync(string licenseContent)
        {
            if (string.IsNullOrWhiteSpace(licenseContent))
            {
                return new LicenseStatusDto
                {
                    IsValid = false,
                    StatusCode = "INVALID_DATA",
                    Message = "लायसन्स डेटा रिकामा आहे. कृपया वैध लायसन्स की किंवा फाईल द्या. (License content is empty)",
                    MachineCode = GetMachineCode()
                };
            }

            var validation = ValidateLicenseText(licenseContent);
            if (!validation.IsValid)
            {
                return validation;
            }

            // Save to license.lic
            try
            {
                string licensePath = GetLicenseFilePath();
                await File.WriteAllTextAsync(licensePath, licenseContent.Trim(), Encoding.UTF8);
                _cachedStatus = validation;
                _lastChecked = DateTime.Now;
                _logger.LogInformation("License activated successfully for {ClientName} ({SansthaName}).", validation.ClientName, validation.SansthaName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to save license.lic file.");
                return new LicenseStatusDto
                {
                    IsValid = false,
                    StatusCode = "FILE_WRITE_ERROR",
                    Message = "लायसन्स फाईल सेव्ह करताना त्रुटी आली. कृपया ॲडमिनिस्ट्रेटर म्हणून रन करा. (Error writing license file)",
                    MachineCode = GetMachineCode()
                };
            }

            return validation;
        }

        private LicenseStatusDto ValidateCurrentLicense()
        {
            string machineCode = GetMachineCode();
            string licensePath = GetLicenseFilePath();

            if (!File.Exists(licensePath))
            {
                return new LicenseStatusDto
                {
                    IsValid = false,
                    StatusCode = "NOT_FOUND",
                    Message = "सॉफ्टवेअरचे लायसन्स सापडले नाही. कृपया वेंडरकडून 'license.lic' की मिळवून सॉफ्टवेअर सक्रिय करा. (License file not found)",
                    MachineCode = machineCode
                };
            }

            try
            {
                string content = File.ReadAllText(licensePath, Encoding.UTF8);
                return ValidateLicenseText(content);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reading license file.");
                return new LicenseStatusDto
                {
                    IsValid = false,
                    StatusCode = "CORRUPTED",
                    Message = "लायसन्स फाईल वाचता येत नाही किंवा ती दूषित झाली आहे. (Corrupted license file)",
                    MachineCode = machineCode
                };
            }
        }

        private LicenseStatusDto ValidateLicenseText(string content)
        {
            string currentMachineCode = GetMachineCode();

            try
            {
                var signedLicense = JsonSerializer.Deserialize<SignedLicense>(content, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                if (signedLicense == null || string.IsNullOrWhiteSpace(signedLicense.PayloadJson) || string.IsNullOrWhiteSpace(signedLicense.Signature))
                {
                    return new LicenseStatusDto
                    {
                        IsValid = false,
                        StatusCode = "INVALID_FORMAT",
                        Message = "लायसन्स फॉरमॅट अमान्य आहे. (Invalid license format)",
                        MachineCode = currentMachineCode
                    };
                }

                // 1. Verify RSA Digital Signature
                bool isSignatureValid = VerifyRsaSignature(signedLicense.PayloadJson, signedLicense.Signature);
                if (!isSignatureValid)
                {
                    return new LicenseStatusDto
                    {
                        IsValid = false,
                        StatusCode = "TAMPERED",
                        Message = "लायसन्स डिजिटल स्वाक्षरी अवैध आहे किंवा फाईलमध्ये छेडछाड झाली आहे! (Invalid cryptographic signature / Tampered license)",
                        MachineCode = currentMachineCode
                    };
                }

                // 2. Parse Payload
                var payload = JsonSerializer.Deserialize<LicensePayload>(signedLicense.PayloadJson, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                if (payload == null)
                {
                    return new LicenseStatusDto
                    {
                        IsValid = false,
                        StatusCode = "INVALID_PAYLOAD",
                        Message = "लायसन्स डेटा पार्स करता आला नाही. (Failed to parse license payload)",
                        MachineCode = currentMachineCode
                    };
                }

                // 3. Verify Target (Domain vs Machine Code)
                string currentHost = GetCurrentRequestHost();
                bool isOnlineDomain = IsAuthorizedWildcardDomain(currentHost) || 
                                      string.Equals(payload.LicenseType, "ONLINE_VPS", StringComparison.OrdinalIgnoreCase) ||
                                      (payload.AllowedDomains != null && payload.AllowedDomains.Any(d => IsDomainMatch(d, currentHost)));

                if (!isOnlineDomain)
                {
                    // OFFLINE NODE: Strict Machine Code Match
                    if (!string.Equals(payload.MachineCode?.Trim(), currentMachineCode.Trim(), StringComparison.OrdinalIgnoreCase))
                    {
                        return new LicenseStatusDto
                        {
                            IsValid = false,
                            StatusCode = "MACHINE_MISMATCH",
                            Message = $"हे लायसन्स या कॉम्प्युटरसाठी नाही! (Unregistered Machine. Expected: {payload.MachineCode}, Actual: {currentMachineCode})",
                            MachineCode = currentMachineCode,
                            ClientName = payload.ClientName,
                            SansthaName = payload.SansthaName,
                            ExpiryDate = payload.ExpiryDate
                        };
                    }
                }

                // 4. Verify Expiry Date
                DateTime today = DateTime.Today;
                if (today > payload.ExpiryDate.Date)
                {
                    return new LicenseStatusDto
                    {
                        IsValid = false,
                        StatusCode = "EXPIRED",
                        Message = $"सॉफ्टवेअरची लायसन्स मुदत ({payload.ExpiryDate:dd-MM-yyyy}) संपली आहे. कृपया नूतनीकरण करा. (License Expired)",
                        MachineCode = currentMachineCode,
                        ClientName = payload.ClientName,
                        SansthaName = payload.SansthaName,
                        IssuedDate = payload.IssuedDate,
                        ExpiryDate = payload.ExpiryDate,
                        DaysRemaining = 0
                    };
                }

                // 5. Anti-Clock Tampering Check (System date set before issue date)
                if (today < payload.IssuedDate.Date.AddDays(-1))
                {
                    return new LicenseStatusDto
                    {
                        IsValid = false,
                        StatusCode = "CLOCK_TAMPERED",
                        Message = "कॉम्प्युटरची तारीख चुकीची किंवा मागे सेट केलेली आढळली आहे. कृपया खरी तारीख सेट करा. (System date set before license issue date)",
                        MachineCode = currentMachineCode,
                        ClientName = payload.ClientName,
                        SansthaName = payload.SansthaName
                    };
                }

                // 6. Database Transaction Anti-Clock Tampering Check (Clock moved back after recording transactions)
                var lastTxDate = GetLastRecordedTransactionDate();
                if (lastTxDate.HasValue && today < lastTxDate.Value.Date.AddDays(-1))
                {
                    return new LicenseStatusDto
                    {
                        IsValid = false,
                        StatusCode = "CLOCK_TAMPERED",
                        Message = $"कॉम्प्युटरचे घड्याळ मागे फिरवलेले आढळले आहे! डेटाबेसमधील शेवटचा व्यवहार {lastTxDate.Value:dd-MM-yyyy} चा आहे. कृपया योग्य तारीख सेट करा. (Clock rollback detected from recorded transactions)",
                        MachineCode = currentMachineCode,
                        ClientName = payload.ClientName,
                        SansthaName = payload.SansthaName
                    };
                }

                int daysRemaining = (payload.ExpiryDate.Date - today).Days;

                return new LicenseStatusDto
                {
                    IsValid = true,
                    StatusCode = "ACTIVE",
                    LicenseType = payload.LicenseType,
                    Message = $"लायसन्स सक्रिय आहे. {daysRemaining} दिवस शिल्लक आहेत. (License Active)",
                    MachineCode = currentMachineCode,
                    ClientName = payload.ClientName,
                    SansthaName = payload.SansthaName,
                    ActiveDomain = currentHost,
                    IssuedDate = payload.IssuedDate,
                    ExpiryDate = payload.ExpiryDate,
                    DaysRemaining = daysRemaining,
                    PlanName = payload.PlanName,
                    EnabledFeatures = payload.EnabledFeatures ?? new()
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception while validating license text.");
                return new LicenseStatusDto
                {
                    IsValid = false,
                    StatusCode = "VALIDATION_ERROR",
                    Message = "लायसन्स तपासताना तांत्रिक त्रुटी आली. (Validation exception)",
                    MachineCode = currentMachineCode
                };
            }
        }

        private string GetCurrentRequestHost()
        {
            try
            {
                var httpContext = _httpContextAccessor?.HttpContext;
                if (httpContext != null)
                {
                    var host = httpContext.Request.Host.Host;
                    if (!string.IsNullOrWhiteSpace(host))
                    {
                        return host.Trim().ToLowerInvariant();
                    }
                }
            }
            catch { }
            return string.Empty;
        }

        private bool IsAuthorizedWildcardDomain(string host)
        {
            if (string.IsNullOrWhiteSpace(host)) return false;
            host = host.ToLowerInvariant().Trim();
            if (host.Contains(":")) host = host.Split(':')[0];

            return host.EndsWith(".hellomindspace.in", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(host, "hellomindspace.in", StringComparison.OrdinalIgnoreCase);
        }

        private bool IsDomainMatch(string pattern, string host)
        {
            if (string.IsNullOrWhiteSpace(pattern) || string.IsNullOrWhiteSpace(host)) return false;
            pattern = pattern.Trim().ToLowerInvariant();
            host = host.Trim().ToLowerInvariant();
            if (host.Contains(":")) host = host.Split(':')[0];

            if (pattern.StartsWith("*."))
            {
                string rootDomain = pattern.Substring(2);
                return host.EndsWith("." + rootDomain, StringComparison.OrdinalIgnoreCase) || string.Equals(host, rootDomain, StringComparison.OrdinalIgnoreCase);
            }
            return string.Equals(pattern, host, StringComparison.OrdinalIgnoreCase);
        }

        private bool VerifyRsaSignature(string data, string signatureBase64)
        {
            try
            {
                using var rsa = RSA.Create();
                rsa.FromXmlString(VENDOR_PUBLIC_KEY_XML);
                byte[] dataBytes = Encoding.UTF8.GetBytes(data);
                byte[] signatureBytes = Convert.FromBase64String(signatureBase64);

                return rsa.VerifyData(dataBytes, signatureBytes, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "RSA Signature verification failed.");
                return false;
            }
        }

        private string GetLicenseFilePath()
        {
            string baseDir = AppContext.BaseDirectory;
            string directPath = Path.Combine(baseDir, "license.lic");
            if (File.Exists(directPath))
            {
                return directPath;
            }

            string currentDir = Directory.GetCurrentDirectory();
            string currentPath = Path.Combine(currentDir, "license.lic");
            if (File.Exists(currentPath))
            {
                return currentPath;
            }

            return directPath; // Default fallback path to create/read
        }

        private DateTime? GetLastRecordedTransactionDate()
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetService<AppDbContext>();
                if (db == null) return null;

                // Check if connection can be opened
                if (!db.Database.CanConnect()) return null;

                // Find highest transaction date from Vouchers
                var lastVoucherDate = db.Vouchers
                    .OrderByDescending(v => v.VoucherDate)
                    .Select(v => (DateTime?)v.VoucherDate)
                    .FirstOrDefault();

                return lastVoucherDate;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not fetch latest transaction date for clock verification (likely initial installation).");
                return null;
            }
        }
    }
}
