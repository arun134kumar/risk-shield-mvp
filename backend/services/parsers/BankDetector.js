class BankDetector {
    /**
     * Determines the bank format from the extracted PDF text.
     * @param {string} text 
     * @returns {string} Bank identifier like 'SBI', or 'UNKNOWN'
     */
    static detect(text) {
        if (!text) return 'UNKNOWN';
        
        const lowerText = text.toLowerCase();
        
        if (lowerText.includes('state bank of india') || lowerText.includes('sbin000')) {
            return 'SBI';
        }
        
        // Add more banks here in the future
        
        return 'UNKNOWN';
    }
}

module.exports = BankDetector;
