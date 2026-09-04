const { execSync } = require('child_process');
const fs = require('fs');

let programCs = fs.readFileSync('Program.cs', 'utf8');
const originalProgramCs = programCs;

programCs = programCs.replace('app.Run();', 'Bhisi.Api.TestPutDb.Run().Wait();\n//app.Run();');
fs.writeFileSync('Program.cs', programCs);

try {
    const output = execSync('dotnet run', { encoding: 'utf8' });
    console.log(output);
} catch (e) {
    console.error(e.stdout);
    console.error(e.stderr);
} finally {
    fs.writeFileSync('Program.cs', originalProgramCs);
}
