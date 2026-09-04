$query = "SELECT v.VoucherID, v.VoucherDate, vd.LedgerID, vd.Amount, vd.DrCr FROM Vouchers v JOIN VoucherDetails vd ON v.VoucherID = vd.VoucherID ORDER BY v.VoucherID DESC LIMIT 20;"

Add-Type -Path "C:\Program Files\dotnet\shared\Microsoft.NETCore.App\8.0.0\Microsoft.Data.Sqlite.dll" -ErrorAction Ignore
# Wait, just use sqlite3.exe if it's there. 

# If sqlite3 isn't available, we can just write a quick C# script and compile it with csc.exe.
