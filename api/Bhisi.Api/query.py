import sqlite3
import datetime

conn = sqlite3.connect('app.db')
cursor = conn.cursor()
cursor.execute('''
    SELECT v.VoucherID, v.VoucherDate, v.BranchID, vd.LedgerID, vd.Amount, vd.DrCr
    FROM Vouchers v 
    JOIN VoucherDetails vd ON v.VoucherID = vd.VoucherID 
    ORDER BY v.VoucherID DESC 
    LIMIT 20
''')

rows = cursor.fetchall()
for row in rows:
    print(row)
