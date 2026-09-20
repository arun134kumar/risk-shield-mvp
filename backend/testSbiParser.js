const SBIParser = require('./services/parsers/SBIParser');

const testText = `
Welcome:
John Doe
Account Number:
00000032900002796
IFSC Code:
SBIN0000230
Bank Name:
State Bank of India
Branch Name:
GUMLA
Statement From:
01-08-2026 to 31-08-2026
Brought Forward:
10,117.56 CR
Closing Balance:
22.66 CR
Debit Count: 59
Credit Count: 11
Total Debits: 30,069.90
Total Credits: 19,975.00

01/08/2026 01/08/2026
WDL TFR
UPI/DR/621307626337/Google
A/utib/playstoreg/UPI
0097695162091 AT 00230
GUMLA
- 30.00 - 10,087.56

03/08/2026 03/08/2026
DEP TFR
UPI/CR/508763385757/MAHTO
O/SBIN/9162384062/Paym
0097732162091 AT 00230
GUMLA
- - 200.00 314.46
`;

const result = SBIParser.parse(testText);
console.log(JSON.stringify(result, null, 2));
