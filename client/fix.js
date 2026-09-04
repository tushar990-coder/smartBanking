const fs = require('fs');
let text = fs.readFileSync('new_aside2.txt', 'utf8');

// replace double Utilities
text = text.replace(
    '<div className="pt-2 pb-1 border-t border-gray-100 mt-1">\n            <p className="px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">युटिलिटीज (Utilities)</p>\n          </div>\n\n          <div className="pt-2 pb-1 border-t border-gray-100 mt-1">\n            <p className="px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">युटिलिटीज (Utilities)</p>\n          </div>',
    '<div className="pt-2 pb-1 border-t border-gray-100 mt-1">\n            <p className="px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">युटिलिटीज (Utilities)</p>\n          </div>'
);

text = text.replace(
    '<div className="pt-2 pb-1 border-t border-gray-100 mt-1">\n            <p className="px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">सेटिंग्ज (Settings)</p>\n          </div>\n\n          <div className="pt-2 pb-1 border-t border-gray-100 mt-1">\n            <p className="px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">सेटिंग्ज (Settings)</p>\n          </div>',
    '<div className="pt-2 pb-1 border-t border-gray-100 mt-1">\n            <p className="px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">सेटिंग्ज (Settings)</p>\n          </div>'
);

fs.writeFileSync('new_aside3.txt', text);
console.log('done');
