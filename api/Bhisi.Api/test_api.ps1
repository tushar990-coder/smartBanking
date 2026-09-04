$endpoints = @('/api/LoanAccounts', '/api/Members', '/api/LoanRates', '/api/Branches')

foreach ($ep in $endpoints) {
    try {
        $res = Invoke-RestMethod -Uri "http://localhost:5242$ep" -Method Get
        Write-Host "SUCCESS: $ep -> $(($res | Measure-Object).Count) records" -ForegroundColor Green
    } catch {
        Write-Host "ERROR: $ep -> $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            Write-Host "Error Details: $($reader.ReadToEnd())" -ForegroundColor Red
        }
    }
}
