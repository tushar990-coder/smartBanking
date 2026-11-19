using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;

namespace Bhisi.Api.Helpers
{
    public static class FileUploadSecurityHelper
    {
        private static readonly string[] AllowedExtensions = { ".jpg", ".jpeg", ".png", ".webp", ".pdf" };

        public static string GetPrivateUploadDirectory()
        {
            var folder = Path.Combine(Directory.GetCurrentDirectory(), "App_Data", "kyc_uploads");
            if (!Directory.Exists(folder))
            {
                Directory.CreateDirectory(folder);
            }
            return folder;
        }

        public static async Task<(bool IsValid, string? ErrorMessage, string? SavedFileName, string? ApiUrl)> SaveValidatedKycFileAsync(IFormFile? file)
        {
            if (file == null || file.Length == 0)
            {
                return (false, "कोणतीही फाईल अपलोड केलेली नाही.", null, null);
            }

            if (file.Length > 10 * 1024 * 1024)
            {
                return (false, "फाईलची साईझ १० MB पेक्षा जास्त नसावी.", null, null);
            }

            var fileExt = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!AllowedExtensions.Contains(fileExt))
            {
                return (false, "केवळ .jpg, .jpeg, .png, .webp किंवा .pdf फाईल्स अपलोड करता येतील.", null, null);
            }

            byte[] header = new byte[12];
            using (var stream = file.OpenReadStream())
            {
                int bytesRead = await stream.ReadAsync(header, 0, header.Length);
                if (!HasValidSignature(fileExt, header, bytesRead))
                {
                    return (false, "फाईलची अंतर्गत रचना (File signature) निवडलेल्या प्रकाराशी जुळत नाही.", null, null);
                }
            }

            var uploadsFolder = GetPrivateUploadDirectory();
            var uniqueFileName = Guid.NewGuid().ToString("N") + fileExt;
            var filePath = Path.Combine(uploadsFolder, uniqueFileName);

            using (var fileStream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(fileStream);
            }

            return (true, null, uniqueFileName, $"/api/Upload/kyc/{uniqueFileName}");
        }

        private static bool HasValidSignature(string ext, byte[] h, int len)
        {
            return ext switch
            {
                ".jpg" or ".jpeg" => len >= 3 && h[0] == 0xFF && h[1] == 0xD8 && h[2] == 0xFF,
                ".png" => len >= 8 && h[0] == 0x89 && h[1] == 0x50 && h[2] == 0x4E && h[3] == 0x47,
                ".webp" => len >= 12 && h[0] == 0x52 && h[1] == 0x49 && h[2] == 0x46 && h[3] == 0x46 && h[8] == 0x57 && h[9] == 0x45 && h[10] == 0x42 && h[11] == 0x50,
                ".pdf" => len >= 4 && h[0] == 0x25 && h[1] == 0x50 && h[2] == 0x44 && h[3] == 0x46,
                _ => false
            };
        }

        public static string GetContentType(string fileName)
        {
            return Path.GetExtension(fileName).ToLowerInvariant() switch
            {
                ".jpg" or ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                ".webp" => "image/webp",
                ".pdf" => "application/pdf",
                _ => "application/octet-stream"
            };
        }
    }
}
