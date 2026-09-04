#r nuget: Microsoft.Data.Sqlite
using System;
using Microsoft.Data.Sqlite;

class Program
{
    static void Main()
    {
        using (var connection = new SqliteConnection("Data Source=bhisi.db"))
        {
            connection.Open();

            var command = connection.CreateCommand();
            command.CommandText = @"
            SELECT l.LedgerID, l.LedgerName, l.GroupID, g.GroupName, g.NatureOfGroup
            FROM Ledgers l
            JOIN AccountGroups g ON l.GroupID = g.GroupID
            WHERE l.LedgerName LIKE '%भाग%' OR l.LedgerName LIKE '%Share%';
            ";

            using (var reader = command.ExecuteReader())
            {
                while (reader.Read())
                {
                    Console.WriteLine($"LedgerID: {reader.GetInt32(0)}, LedgerName: {reader.GetString(1)}, GroupID: {reader.GetInt32(2)}, GroupName: {reader.GetString(3)}, Nature: {reader.GetString(4)}");
                }
            }
        }
    }
}
