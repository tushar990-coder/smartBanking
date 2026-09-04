const fs = require('fs');

const appTsxPath = 'src/App.tsx';
const appContent = fs.readFileSync(appTsxPath, 'utf8');

const newAside = fs.readFileSync('new_aside3.txt', 'utf8');

const startTag = '<aside className="w-56 bg-white shadow-xl flex flex-col z-10 border-r border-gray-100 h-full print:hidden">';
const endTag = '</aside>';

const startIdx = appContent.indexOf(startTag);
const endIdx = appContent.indexOf(endTag, startIdx) + endTag.length;

if (startIdx === -1 || endIdx < endTag.length) {
    console.error('Could not find aside tags in App.tsx');
    process.exit(1);
}

const before = appContent.substring(0, startIdx);
const after = appContent.substring(endIdx);

const newAppContent = before + startTag + '\n        ' + newAside.trim() + '\n      ' + endTag + after;

fs.writeFileSync(appTsxPath, newAppContent);
console.log('App.tsx updated successfully');
