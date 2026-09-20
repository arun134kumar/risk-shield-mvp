const lines = [
    "-30.00-10,087.56",
    "--200.00314.46",
    "--8,000.0013,325.46",
    "- 30.00 - 10,087.56",
    "- - 200.00 314.46",
    "12345630.00-10,087.56", // hypothetcial cheque number
    "123456 - 200.00 314.46"
];

// Ref can be "-" or digits (cheque number). Wait, a cheque is usually digits. Let's capture the whole start until the first amount.
// Actually, it's always three fields: Debit, Credit, Balance. The Cheque/Ref is before Debit.
// Wait, the column order is: Date, Narration, Ref/Cheque, Debit, Credit, Balance.
// The amount line contains: [Ref] [Debit] [Credit] [Balance].
// Ref is either `-` or `some digits/string`.
// Debit is either `-` or `number`.
// Credit is either `-` or `number`.
// Balance is `number` with optional CR/PR/DR.

// Let's make a regex that extracts Debit, Credit, and Balance, working backwards from the end of the line!
// Balance is ALWAYS at the end.
// Credit is right before Balance.
// Debit is right before Credit.

// Balance: (\d{1,9}(?:,\d{3})*\.\d{2})(?:\s*CR)?$
// Credit: (-\s*|\d{1,9}(?:,\d{3})*\.\d{2}\s*)
// Debit: (-\s*|\d{1,9}(?:,\d{3})*\.\d{2}\s*)

// So working backwards:
const amountRegex = /(?:-\s*|(\d{1,9}(?:,\d{3})*\.\d{2})\s*)(?:-\s*|(\d{1,9}(?:,\d{3})*\.\d{2})\s*)(\d{1,9}(?:,\d{3})*\.\d{2})(?:\s*CR)?$/i;

lines.forEach(line => {
    const match = line.match(amountRegex);
    if (match) {
        console.log(`[PASS] ${line}`);
        console.log(`  Debit:  ${match[1] || 0}`);
        console.log(`  Credit: ${match[2] || 0}`);
        console.log(`  Bal:    ${match[3]}`);
    } else {
        console.log(`[FAIL] ${line}`);
    }
});
