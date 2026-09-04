const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('../api/Bhisi.Api/app.db');
db.all('SELECT v.VoucherID, v.VoucherDate, vd.LedgerID, vd.Amount, vd.DrCr FROM Vouchers v JOIN VoucherDetails vd ON v.VoucherID = vd.VoucherID ORDER BY v.VoucherID DESC LIMIT 20', [], (err, rows) => {
    if (err) throw err;
    console.log(rows);
});
