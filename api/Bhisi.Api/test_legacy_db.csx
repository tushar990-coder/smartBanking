#r "nuget: Microsoft.Data.SqlClient, 5.1.4"

using System;
using Microsoft.Data.SqlClient;
using System.Data;

string mdfPath = @"D:\Bhisi Software\api\Bhisi.Api\FinEx.mdf";
string connectionString = $@"Server=.\SQLEXPRESS01;AttachDbFilename={mdfPath};Database=FinExLegacyTemp;Trusted_Connection=True;MultipleActiveResultSets=true;Encrypt=False;";

try
{
    using (SqlConnection conn = new SqlConnection(connectionString))
    {
        conn.Open();
        Console.WriteLine("Connection successful!");

        // List tables
        DataTable schema = conn.GetSchema("Tables");
        Console.WriteLine("\nTables found:");
        foreach (DataRow row in schema.Rows)
        {
            string tablename = (string)row[2];
            Console.WriteLine(tablename);
        }
    }
}
catch (Exception ex)
{
    Console.WriteLine($"Error: {ex.Message}");
}
