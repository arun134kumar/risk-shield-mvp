const fs = require('fs');
const text = fs.readFileSync('debug-raw-pdf.txt', 'utf8');

const accMatch = text.match(/Account Number[\s\S]{1,200}?\b(\d{11,18})\b[\s\S]{1,50}?\b(\d{11,18})\b/i);
console.log('Account 1 (CIF):', accMatch ? accMatch[1] : 'not found');
console.log('Account 2 (Acc):', accMatch ? accMatch[2] : 'not found');
