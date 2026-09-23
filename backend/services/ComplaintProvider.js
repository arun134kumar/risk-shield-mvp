class ComplaintProvider {
    /**
     * Checks if an account has known complaints in an external authorized database.
     * This is a mock/synthetic provider for the MVP and offline demo.
     * 
     * @param {string} accountIdentifier - The account number, UPI ID, or phone number to check
     * @returns {object} Status and details of the complaint
     */
    static async checkStatus(accountIdentifier) {
        if (!accountIdentifier || accountIdentifier === 'Uploaded Account' || accountIdentifier === 'Unknown Counterparty') {
            return { status: 'SOURCE_UNAVAILABLE', message: 'Invalid or unknown identifier for lookup' };
        }

        const identifierLower = accountIdentifier.toLowerCase();

        // Synthetic rules for demo purposes
        if (identifierLower.includes('suspicious') || identifierLower.includes('fraud')) {
            return {
                status: 'KNOWN_CASE',
                message: 'Linked to a known case in the connected authorized source.',
                caseId: 'NCRP-' + Math.floor(Math.random() * 100000),
                severity: 'HIGH'
            };
        }

        // Default response for others
        return {
            status: 'NO_KNOWN_CASE',
            message: 'No known complaint found in connected data.'
        };
    }
}

module.exports = ComplaintProvider;
