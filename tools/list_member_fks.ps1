$c = New-Object System.Data.SqlClient.SqlConnection('Server=.;Database=SmartBanking;Trusted_Connection=True;')
$c.Open()
$cmd = $c.CreateCommand()
$cmd.CommandText = @"
SELECT 
    OBJECT_NAME(fkc.parent_object_id) AS TableName, 
    COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS ColumnName,
    fk.name AS FKName
FROM sys.foreign_key_columns fkc
INNER JOIN sys.foreign_keys fk ON fkc.constraint_object_id = fk.object_id
WHERE fkc.referenced_object_id = OBJECT_ID('Members')
ORDER BY TableName, ColumnName
"@
$r = $cmd.ExecuteReader()
while($r.Read()) { 
    Write-Host ("$($r['TableName']).$($r['ColumnName'])  --> FK: $($r['FKName'])") 
}
$c.Close()
