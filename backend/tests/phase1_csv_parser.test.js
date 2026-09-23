const StatementParser = require('../services/StatementParser');

describe('Phase 1: CSV/XLSX Parity Regression (T14)', () => {
    test('should normalize CSV tabular statement to generic transaction schema', () => {
        const rows = [
            {
                Date: '01/08/2026',
                Description: 'UPI/DR/621307626337/Google A/utib/playstoreg/UPI',
                Debit: '30.00',
                Credit: '',
                Balance: '10087.56'
            },
            {
                Date: '03/08/2026',
                Description: 'UPI/CR/508763385757/MAHTO O/SBIN/9162384062/Paym',
                Debit: '',
                Credit: '200.00',
                Balance: '314.46'
            }
        ];

        const normalized = StatementParser.normalizeExcelRows(rows);

        expect(normalized.length).toBe(2);
        
        const tx1 = normalized[0];
        expect(tx1.type).toBe('DEBIT');
        expect(tx1.amount).toBe(30);
        expect(tx1.balance).toBe(10087.56);
        expect(tx1.receiver).toBe('Google A'); // Guessed counterparty
        
        const tx2 = normalized[1];
        expect(tx2.type).toBe('CREDIT');
        expect(tx2.amount).toBe(200);
        expect(tx2.balance).toBe(314.46);
        expect(tx2.sender).toBe('MAHTO O'); // Guessed counterparty
    });
});
