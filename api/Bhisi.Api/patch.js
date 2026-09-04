const fs = require('fs');
const path = 'd:/Bhisi Software/api/Bhisi.Api/Controllers/ReportsController.cs';
let content = fs.readFileSync(path, 'utf8');

// I will use regex because the exact spaces/newlines might differ slightly.
const targetRegex = /if\s*\(\s*shareAccount\s*!=\s*null\s*&&\s*shareAccount\.Transactions\s*!=\s*null\s*\)\s*\{\s*decimal\s+runningBalance\s*=\s*0;\s*string\s+currentCertificate\s*=\s*\"\";/;

const replaceStr = `            decimal runningBalance = 0;
            string currentCertificate = "";

            // 1. Fetch Opening Balance from MemberOpeningBalances
            var opBal = await _context.MemberOpeningBalances
                .Include(o => o.Ledger)
                .FirstOrDefaultAsync(o => o.MemberID == memberId && (o.Ledger.LedgerName.Contains("सभासद भाग") || o.Ledger.LedgerName.Contains("Share")));

            if (opBal != null && opBal.Amount > 0)
            {
                bool hasExistingOpBal = shareAccount != null && shareAccount.Transactions != null && 
                                        shareAccount.Transactions.Any(t => t.TransactionType == "OpeningBalance");
                
                if (!hasExistingOpBal)
                {
                    var opBalAmount = opBal.BalanceType == "Cr" ? opBal.Amount : -opBal.Amount;
                    var dto = new INamunaTransactionDto
                    {
                        AllotmentDate = member.JoiningDate,
                        AllotmentCashbookNo = "OP-BAL",
                        Application = "-",
                        TotalAmountReceived = opBalAmount,
                        NumberOfSharesHeld = (int)(opBalAmount / 100),
                        AllotmentCertificateNo = "-",
                        Remarks = "Opening Balance",
                        BalanceAmount = opBalAmount,
                        BalanceCertificateNo = "-"
                    };
                    runningBalance += opBalAmount;
                    report.Transactions.Add(dto);
                }
            }

            if (shareAccount != null && shareAccount.Transactions != null)
            {`;

if (targetRegex.test(content)) {
    content = content.replace(targetRegex, replaceStr);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Done');
} else {
    console.log('Pattern not found');
}
