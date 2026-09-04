#r "nuget: Microsoft.Data.Sqlite, 7.0.10"
using System;
using Microsoft.Data.Sqlite;

var connectionStringBuilder = new SqliteConnectionStringBuilder();
connectionStringBuilder.DataSource = "bhisi.db";
using var connection = new SqliteConnection(connectionStringBuilder.ConnectionString);
connection.Open();

var command = connection.CreateCommand();
command.CommandText = @"
    SELECT s.SavingAccountID, s.AccountNo, m.FirstName || ' ' || m.LastName as Name, s.OpeningBalance, s.LedgerID, s.CreatedOn
    FROM SavingAccountMasters s
    JOIN Members m ON s.MemberID = m.MemberID
    ORDER BY s.SavingAccountID DESC
    LIMIT 10
";

using var reader = command.ExecuteReader();
Console.WriteLine("--- Last 10 Imported Saving Accounts ---");
while (reader.Read())
{
    var createdStr = reader.IsDBNull(5) ? "" : reader.GetString(5);
    Console.WriteLine($"AccNo: {reader.GetString(1)} | Name: {reader.GetString(2)} | Balance: {reader.GetDecimal(3)} | LedgerID: {reader.GetInt32(4)} | Created: {createdStr}");
}

// Get count of recent ones (say, today's date roughly)
var cmd2 = connection.CreateCommand();
cmd2.CommandText = "SELECT COUNT(*) FROM SavingAccountMasters WHERE CreatedOn >= date('now')";
var count = cmd2.ExecuteScalar();
Console.WriteLine($"\nTotal Imported Today: {count}");

// Check member opening balances
var cmd3 = connection.CreateCommand();
cmd3.CommandText = "SELECT COUNT(*) FROM MemberOpeningBalances WHERE CreatedOn >= date('now')";
var mobCount = cmd3.ExecuteScalar();
Console.WriteLine($"Total Member Opening Balances added Today: {mobCount}");
