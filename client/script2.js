const fs = require('fs');
const text = fs.readFileSync('aside_lines.txt', 'utf8');

const parts = text.split('<button ');
const header = parts[0];

const getPart = (keyword) => {
    const match = parts.find(p => p.includes(`setActiveTab('${keyword}')`) || p.includes(`handleNavigate('${keyword}')`));
    if(!match) return '';
    return '<button ' + match;
}

const dashboard = getPart('dashboard');
const member360 = getPart('member-360');
const members = getPart('members');
const loan = getPart('loan');
const saving = getPart('saving');
const fd = getPart('fd');
const rd = getPart('rd');
const pigmy = getPart('pigmy');
const voucher = getPart('voucher');
const investment = getPart('investment');
const assets = getPart('assets');
const npa = getPart('npa-dashboard');
const calc = getPart('interest-calculator');

const reportsIdx = parts.findIndex(p => p.includes(`setActiveTab('reports')`));
const reportsStr = '<div className="pt-2 pb-1 border-t border-gray-100 mt-1">\n            <p className="px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">अहवाल (Reports)</p>\n          </div>\n\n          <button ' + parts[reportsIdx];

const settingsIdx = parts.findIndex(p => p.includes(`setActiveTab('settings')`));
const settingsStr = '<div className="pt-2 pb-1 border-t border-gray-100 mt-1">\n            <p className="px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">सेटिंग्ज (Settings)</p>\n          </div>\n\n          <button ' + parts[settingsIdx];

const utilitiesHeader = '<div className="pt-2 pb-1 border-t border-gray-100 mt-1">\n            <p className="px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">युटिलिटीज (Utilities)</p>\n          </div>';

const newAside = [
    header.trim(),
    dashboard.trim(),
    member360.trim(),
    members.trim(),
    loan.trim(),
    saving.trim(),
    fd.trim(),
    rd.trim(),
    pigmy.trim(),
    voucher.trim(),
    investment.trim(),
    assets.trim(),
    npa.trim(),
    utilitiesHeader.trim(),
    calc.trim(),
    reportsStr.trim(),
    settingsStr.trim(),
].join('\n\n          ');

fs.writeFileSync('new_aside2.txt', newAside);
console.log('done');
