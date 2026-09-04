param(
    [string]$server = ".",
    [string]$sourceDb = "SmartBanking",
    [string]$targetDb = "Test2"
)

$masterConnStr = "Server=$server;Database=master;Trusted_Connection=True;TrustServerCertificate=True;"
$targetConnStr = "Server=$server;Database=$targetDb;Trusted_Connection=True;TrustServerCertificate=True;"
$sourceConnStr = "Server=$server;Database=$sourceDb;Trusted_Connection=True;TrustServerCertificate=True;"

Add-Type -AssemblyName "System.Data"

function Execute-NonQuery ($connectionString, $query) {
    $conn = New-Object System.Data.SqlClient.SqlConnection($connectionString)
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = $query
    $cmd.CommandTimeout = 300
    try {
        $cmd.ExecuteNonQuery() | Out-Null
    } finally {
        $conn.Close()
    }
}

function Execute-Scalar ($connectionString, $query) {
    $conn = New-Object System.Data.SqlClient.SqlConnection($connectionString)
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = $query
    $cmd.CommandTimeout = 300
    try {
        return $cmd.ExecuteScalar()
    } finally {
        $conn.Close()
    }
}

function Get-DataTable ($connectionString, $query) {
    $conn = New-Object System.Data.SqlClient.SqlConnection($connectionString)
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = $query
    $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
    $dt = New-Object System.Data.DataTable
    $adapter.Fill($dt) | Out-Null
    $conn.Close()
    return $dt
}

Write-Host "Checking all tables and rows in $sourceDb..." -ForegroundColor Cyan
$query = @"
SELECT t.name AS TableName, i.rows AS [RowCount]
FROM sys.tables t
INNER JOIN sys.sysindexes i ON t.object_id = i.id AND i.indid < 2
ORDER BY i.rows DESC, t.name ASC
"@
$dt = Get-DataTable $sourceConnStr $query
foreach ($row in $dt) {
    if ($row["RowCount"] -gt 0) {
        Write-Host "  $($row['TableName']): $($row['RowCount']) rows"
    }
}
