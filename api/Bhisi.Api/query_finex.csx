#r "nuget: Microsoft.Data.SqlClient"
using System;
using Microsoft.Data.SqlClient;

var mdfPath = @"d:\Bhisi Software\api\Bhisi.Api\Uploads\FinEx.mdf";
var connectionString = $@"Server=.\SQLEXPRESS01;AttachDbFilename={mdfPath};Database=FinExLegacy_TempDB;Trusted_Connection=True;Pooling=False;Encrypt=False;";

try {
    using var conn = new SqlConnection(connectionString);
    conn.Open();
    using var cmd = new SqlCommand("SELECT top 5 * FROM YEAR_INFO", conn);
    using var reader = cmd.ExecuteReader();
    for (int i=0; i<reader.FieldCount; i++) Console.Write(reader.GetName(i) + "\t");
    Console.WriteLine();
    while (reader.Read()) {
        for (int i=0; i<reader.FieldCount; i++) Console.Write(reader[i] + "\t");
        Console.WriteLine();
    }
} catch (Exception ex) {
    Console.WriteLine(ex.Message);
}
