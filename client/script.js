const fs = require("fs");
const lines = fs.readFileSync("aside_lines.txt", "utf8").split("\n");

const getBlock = (startText, endTextOrCondition, offset = 0) => {
    const startIdx = lines.findIndex(l => l.includes(startText));
    if (startIdx === -1) return "";
    
    let endIdx = startIdx;
    if (typeof endTextOrCondition === "function") {
        endIdx = endTextOrCondition(startIdx);
    } else {
        const relIdx = lines.slice(startIdx + 1).findIndex(l => l.includes(endTextOrCondition));
        if (relIdx !== -1) endIdx = startIdx + 1 + relIdx;
    }
    
    return lines.slice(startIdx, endIdx + 1 + offset).join("\n");
}

const getComplexBlock = (btnMatch) => {
    const startIdx = lines.findIndex(l => l.includes(btnMatch));
    let btnStart = startIdx - 1; 
    let endIdx = lines.slice(btnStart).findIndex(l => l.includes(")}"));
    if (endIdx === -1) return "";
    return lines.slice(btnStart, btnStart + endIdx + 1).join("\n");
}

const dashboard = getBlock("setActiveTab('dashboard')", l => l + 9);
const member360 = getBlock("handleNavigate('member-360')", l => l + 9);
const voucher = getBlock("setActiveTab('voucher')", l => l + 9);

const members = getComplexBlock("setActiveTab('members')");
const saving = getComplexBlock("setActiveTab('saving')");
const fd = getComplexBlock("setActiveTab('fd')");
const pigmy = getComplexBlock("setActiveTab('pigmy')");
const rd = getComplexBlock("setActiveTab('rd')");
const investment = getComplexBlock("setActiveTab('investment')");
const assets = getComplexBlock("setActiveTab('assets')");
const loan = getComplexBlock("setActiveTab('loan')");

const npa = lines.slice(lines.findIndex(l => l.includes("setActiveTab('npa-dashboard')")) - 1, lines.findIndex(l => l.includes("setActiveTab('npa-dashboard')")) + 9).join("\n");
const calc = lines.slice(lines.findIndex(l => l.includes("setActiveTab('interest-calculator')")) - 1, lines.findIndex(l => l.includes("setActiveTab('interest-calculator')")) + 9).join("\n");

const reportsHeader = lines.slice(lines.findIndex(l => l.includes("अहवाल (Reports)") ) - 1, lines.findIndex(l => l.includes("अहवाल (Reports)") ) + 2).join("\n");
const reports = lines.slice(lines.findIndex(l => l.includes("setActiveTab('reports')")) - 1, lines.findIndex(l => l.includes("setActiveTab('reports')")) + 9).join("\n");

const settingsHeader = lines.slice(lines.findIndex(l => l.includes("सेटिंग्ज (Settings)") ) - 1, lines.findIndex(l => l.includes("सेटिंग्ज (Settings)") ) + 2).join("\n");
const settings = lines.slice(lines.findIndex(l => l.includes("setActiveTab('settings')")) - 1, lines.findIndex(l => l.includes("setActiveTab('settings')")) + 9).join("\n");

const logo = lines.slice(0, 5).join("\n");

const newAside = [
    logo,
    dashboard,
    member360,
    members,
    loan,
    saving,
    fd,
    rd,
    pigmy,
    voucher,
    investment,
    assets,
    npa,
    "          <div className=\"pt-2 pb-1 border-t border-gray-100 mt-1\">\n            <p className=\"px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider\">युटिलिटीज (Utilities)</p>\n          </div>",
    calc,
    reportsHeader,
    reports,
    settingsHeader,
    settings,
    "        </div>"
].join("\n\n");

fs.writeFileSync("new_aside.txt", newAside);
console.log("done");
