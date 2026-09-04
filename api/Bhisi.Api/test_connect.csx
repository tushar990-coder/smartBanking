using System;
using System.Data.SqlClient;

var mdfPath = @"D:\Bhisi Software\api\Bhisi.Api\Uploads\FinEx.mdf";
var connectionString = $@"Server=.\SQLEXPRESS01;AttachDbFilename={mdfPath};Trusted_Connection=True;Pooling=False;MultipleActiveResultSets=true;Encrypt=False;";

try {
    using (var conn1 = new SqlConnection(connectionString)) {
        conn1.Open();
        Console.WriteLine("Connection 1 Opened");
    }
    
    using (var conn2 = new SqlConnection(connectionString)) {
        conn2.Open();
        Console.WriteLine("Connection 2 Opened");
    }
} catch (Exception ex) {
    Console.WriteLine("Error: " + ex.Message);
}
