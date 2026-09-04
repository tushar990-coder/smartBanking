using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Bhisi.Api.Services;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class NotificationController : ControllerBase
    {
        private readonly INotificationEngineService _notificationService;

        public NotificationController(INotificationEngineService notificationService)
        {
            _notificationService = notificationService;
        }

        // GET: api/Notification?branchId=1&module=Loans&priority=HIGH&status=Active
        [HttpGet]
        public async Task<IActionResult> GetNotifications(
            [FromQuery] int branchId = 1,
            [FromQuery] string? module = null,
            [FromQuery] string? priority = null,
            [FromQuery] string? status = "Active")
        {
            try
            {
                var notifications = await _notificationService.GetNotificationsAsync(branchId, module, priority, status);
                return Ok(notifications);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "सूचना लोड करताना त्रुटी आली. (Error loading notifications)", detail = ex.Message });
            }
        }

        // GET: api/Notification/module-counts?branchId=1
        [HttpGet("module-counts")]
        public async Task<IActionResult> GetModuleCounts([FromQuery] int branchId = 1)
        {
            try
            {
                var counts = await _notificationService.GetModuleCountsAsync(branchId);
                return Ok(counts);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "मॉड्यूल संख्या लोड करताना त्रुटी आली.", detail = ex.Message });
            }
        }

        // POST: api/Notification/generate?branchId=1
        [HttpPost("generate")]
        public async Task<IActionResult> GenerateNotifications([FromQuery] int branchId = 1)
        {
            try
            {
                int created = await _notificationService.GenerateAutoNotificationsAsync(branchId);
                return Ok(new { message = $"स्वयंचलित सूचना यशस्वीरीत्या तयार झाल्या. ({created} नवीन नोंदी)", count = created });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "सूचना जनरेट करताना त्रुटी आली.", detail = ex.Message });
            }
        }

        // POST: api/Notification/{id}/complete
        [HttpPost("{id}/complete")]
        public async Task<IActionResult> CompleteNotification(long id)
        {
            try
            {
                int? userId = null;
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (!string.IsNullOrEmpty(userIdClaim) && int.TryParse(userIdClaim, out int uid))
                {
                    userId = uid;
                }

                bool result = await _notificationService.CompleteNotificationAsync(id, userId);
                if (!result) return NotFound(new { message = "सूचना सापडली नाही." });

                return Ok(new { message = "सूचना पूर्ण झाली म्हणून नोंदवली आहे. (Notification completed successfully)" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "सूचना अपडेट करताना त्रुटी आली.", detail = ex.Message });
            }
        }
    }
}
