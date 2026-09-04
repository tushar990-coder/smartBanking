cd "d:\Bhisi Software\api\Bhisi.Api"
dotnet new console -n TestApp -f net8.0
cd TestApp
dotnet add package Microsoft.EntityFrameworkCore.Sqlite

Set-Content -Path Program.cs -Value @"
using System;
using Microsoft.Data.Sqlite;

class Program
{
    static void Main()
    {
        using var connection = new SqliteConnection("Data Source=../app.db");
        connection.Open();
        var command = connection.CreateCommand();
        command.CommandText = "SELECT v.VoucherID, v.VoucherDate, vd.LedgerID, vd.Amount, vd.DrCr FROM Vouchers v JOIN VoucherDetails vd ON v.VoucherID = vd.VoucherID ORDER BY v.VoucherID DESC LIMIT 20";
        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            Console.WriteLine($"VoucherID: {reader.GetInt32(0)}, Date: {reader.GetString(1)}, LedgerID: {reader.GetInt32(2)}, Amount: {reader.GetDecimal(3)}, DrCr: {reader.GetString(4)}");
        }
    }
}
"@

dotnet run
