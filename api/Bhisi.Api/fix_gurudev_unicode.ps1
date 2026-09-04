$connStr = "Server=.;Database=SmartBanking_Gurudev;Trusted_Connection=True;TrustServerCertificate=True"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()

# 1. Update Branches
$cmd1 = $conn.CreateCommand()
$cmd1.CommandText = "UPDATE Branches SET BranchName = @bname WHERE BranchCode = 'MAIN'"
$cmd1.Parameters.Add("@bname", [System.Data.SqlDbType]::NVarChar).Value = "मुख्य शाखा"
$cmd1.ExecuteNonQuery()

# 2. Update SansthaDetails
$cmd2 = $conn.CreateCommand()
$cmd2.CommandText = "UPDATE SansthaDetails SET SansthaName = @sname, Address = @addr, District = @dist WHERE SansthaID > 0"
$cmd2.Parameters.Add("@sname", [System.Data.SqlDbType]::NVarChar).Value = "गुरुदेव कर्मचारी सहकारी संस्था"
$cmd2.Parameters.Add("@addr", [System.Data.SqlDbType]::NVarChar).Value = "मुख्य शाखा, सांगली"
$cmd2.Parameters.Add("@dist", [System.Data.SqlDbType]::NVarChar).Value = "सांगली"
$cmd2.ExecuteNonQuery()

$conn.Close()
Write-Host "Unicode strings updated successfully in SmartBanking_Gurudev!" -ForegroundColor Green
