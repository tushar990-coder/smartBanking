#r "nuget: Microsoft.Data.SqlClient"
using System;
using Microsoft.Data.SqlClient;
using System;

var connStr = @"Server=.\SQLEXPRESS01;AttachDbFilename=d:\Bhisi Software\api\Bhisi.Api\Uploads\FinEx_48b1ada3.mdf;Trusted_Connection=True;Pooling=False;Encrypt=False;";

using (var conn = new SqlConnection(connStr))
{
    conn.Open();
    var cmd = new SqlCommand("SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME IN ('TRANS', 'TRANS_DETAILS')", conn);
    using (var reader = cmd.ExecuteReader())
    {
        while (reader.Read())
        {
            Console.WriteLine($"{reader["TABLE_NAME"]} - {reader["COLUMN_NAME"]}");
        }
    }
}
