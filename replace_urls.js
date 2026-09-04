const fs = require('fs');
const path = require('path');

const directory = path.join(__dirname, 'client', 'src');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk(directory);
let count = 0;
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes('http://localhost:5238')) {
        content = content.replace(/http:\/\/localhost:5238/g, '');
        fs.writeFileSync(file, content, 'utf8');
        count++;
        console.log(`Updated: ${file}`);
    }
});

console.log(`Replaced string in ${count} files.`);
