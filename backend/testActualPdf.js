const fs = require('fs');
const SBIParser = require('./services/parsers/SBIParser');

const text = fs.readFileSync('debug-raw-pdf.txt', 'utf8');
const result = SBIParser.parse(text);

console.log(JSON.stringify(result.accountInfo, null, 2));
console.log(JSON.stringify(result.statementSummary, null, 2));
console.log(JSON.stringify(result.validation, null, 2));
