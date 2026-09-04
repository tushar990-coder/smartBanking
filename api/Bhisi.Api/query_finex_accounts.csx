#r "nuget: Microsoft.Data.SqlClient"
using System;
using Microsoft.Data.SqlClient;

var mdfPath = @"d:\Bhisi Software\api\Bhisi.Api\Uploads\FinEx.mdf";
var connectionString = $@"Server=.\SQLEXPRESS01;AttachDbFilename={mdfPath};Database=FinExLegacy_TempDB;Trusted_Connection=True;Pooling=False;Encrypt=False;";

void PrintSchema(string tableName, SqlConnection conn) {
    Console.WriteLine("TABLE: " + tableName);
    using var cmd = new SqlCommand($"SELECT top 1 * FROM {tableName}", conn);
    try {
        using var reader = cmd.ExecuteReader();
        for (int i=0; i<reader.FieldCount; i++) Console.Write(reader.GetName(i) + ", ");
        Console.WriteLine("\n");
    } catch (Exception ex) {
        Console.WriteLine("Error: " + ex.Message);
    }
}

try {
    using var conn = new SqlConnection(connectionString);
    conn.Open();
    PrintSchema("KARZ_ROKHA", conn);
    PrintSchema("CUST_OPENING_BAL", conn);
} catch (Exception ex) {
    Console.WriteLine(ex.Message);
}
