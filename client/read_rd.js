const xlsx = require('xlsx');

try {
  const workbook = xlsx.readFile('C:\\Users\\HP Laptop\\Downloads\\rd chart.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  console.log("=== RD Chart Data ===");
  data.forEach((row, idx) => {
    if (row.length > 0) {
      console.log(`Row ${idx + 1}: ${JSON.stringify(row)}`);
    }
  });
} catch (err) {
  console.error("Error reading file:", err);
}
