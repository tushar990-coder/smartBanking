#r "nuget: Microsoft.Data.SqlClient, 5.1.1"
using Microsoft.Data.SqlClient;
using System.Data;
using System.Collections.Generic;

var masterConnStr = @"Server=.\SQLEXPRESS01;Database=master;Trusted_Connection=True;Encrypt=False;";
var masterConn = new SqlConnection(masterConnStr);
masterConn.Open();

string dbName = null;
using (var cmd = new SqlCommand("SELECT TOP 1 name FROM sys.databases WHERE name LIKE 'FinExLegacyTemp_%'", masterConn))
{
    dbName = (string)cmd.ExecuteScalar();
}

if (dbName == null) {
    Console.WriteLine("No attached FinEx database found.");
    return;
}

Console.WriteLine($"Found DB: {dbName}");

var connStr = $@"Server=.\SQLEXPRESS01;Database={dbName};Trusted_Connection=True;Encrypt=False;";
var conn = new SqlConnection(connStr);
conn.Open();

void PrintTableTop1(string tableName)
{
    Console.WriteLine($"\n--- {tableName} ---");
    try {
        var cmd = new SqlCommand($"SELECT TOP 1 * FROM {tableName}", conn);
        using var reader = cmd.ExecuteReader();
        if(reader.Read()) {
            for(int i=0; i<reader.FieldCount; i++) {
                Console.WriteLine($"{reader.GetName(i)}: {reader.GetValue(i)}");
            }
        }
    } catch (Exception ex) {
        Console.WriteLine($"Error querying {tableName}: {ex.Message}");
    }
}

PrintTableTop1("CUSTOMERS");
PrintTableTop1("LEDGER");
PrintTableTop1("LEDGER_GROUP");
PrintTableTop1("CUST_TYPE_MASTER");
PrintTableTop1("SAVING_ACCOUNT");
PrintTableTop1("SAVING_ACC_SETTING");
PrintTableTop1("MEMBER_THEV_CR");
PrintTableTop1("LOAN_DEMAND");
PrintTableTop1("MEMBER_VARGANI_THEV");
