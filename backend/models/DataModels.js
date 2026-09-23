class Case {
    constructor({ id, title, status, rootAccountId, createdAt, updatedAt, investigatorNotes, dataQuality, reportVersion }) {
        this.id = id;
        this.title = title || null;
        this.status = status || 'OPEN';
        this.rootAccountId = rootAccountId || null;
        this.createdAt = createdAt || new Date().toISOString();
        this.updatedAt = updatedAt || new Date().toISOString();
        this.investigatorNotes = investigatorNotes || '';
        this.dataQuality = dataQuality || 'UNKNOWN';
        this.reportVersion = reportVersion || '1.0';
    }
}

class Account {
    constructor({ id, maskedAccountNumber, accountNumberHash, holderName, bankName, branch, ifsc, accountType, statementIds, role, investigationPriority, evidenceQuality, findings, tabState }) {
        this.id = id;
        this.maskedAccountNumber = maskedAccountNumber || null;
        this.accountNumberHash = accountNumberHash || null;
        this.holderName = holderName || null;
        this.bankName = bankName || null;
        this.branch = branch || null;
        this.ifsc = ifsc || null;
        this.accountType = accountType || null;
        this.statementIds = statementIds || [];
        this.role = role || null; // e.g. ROOT, COUNTERPARTY
        this.investigationPriority = investigationPriority || 0;
        this.evidenceQuality = evidenceQuality || null;
        this.findings = findings || [];
        this.tabState = tabState || null;
    }
}

class Statement {
    constructor({ id, accountId, fileHash, filename, fileType, parserName, parserVersion, uploadedAt, periodStart, periodEnd, parsingStatus, transactionCount, openingBalance, closingBalance, reconciliationStatus, limitations }) {
        this.id = id;
        this.accountId = accountId || null;
        this.fileHash = fileHash || null;
        this.filename = filename || null;
        this.fileType = fileType || null;
        this.parserName = parserName || null;
        this.parserVersion = parserVersion || null;
        this.uploadedAt = uploadedAt || new Date().toISOString();
        this.periodStart = periodStart || null;
        this.periodEnd = periodEnd || null;
        this.parsingStatus = parsingStatus || 'UNKNOWN';
        this.transactionCount = transactionCount || 0;
        this.openingBalance = openingBalance !== undefined ? openingBalance : null;
        this.closingBalance = closingBalance !== undefined ? closingBalance : null;
        this.reconciliationStatus = reconciliationStatus || 'UNKNOWN';
        this.limitations = limitations || [];
    }
}

class Transaction {
    constructor({ id, statementId, sourceAccountId, counterpartyAccountId, date, valueDate, postDate, amount, debit, credit, direction, transactionType, paymentMode, referenceId, transactionReference, description, narration, sender, receiver, counterparty, bankCode, upiId, balance, balanceAfter, location, parserConfidence, ...legacyFields }) {
        this.id = id;
        this.statementId = statementId || null;
        this.sourceAccountId = sourceAccountId;
        this.counterpartyAccountId = counterpartyAccountId || null;
        this.date = date;
        this.valueDate = valueDate || null;
        this.postDate = postDate || null;
        this.amount = amount;
        this.debit = debit !== undefined ? debit : null;
        this.credit = credit !== undefined ? credit : null;
        this.direction = direction; // CREDIT or DEBIT
        this.transactionType = transactionType || null;
        this.paymentMode = paymentMode || null;
        this.referenceId = referenceId || null;
        this.transactionReference = transactionReference || null;
        this.description = description || null;
        this.narration = narration;
        this.sender = sender || null;
        this.receiver = receiver || null;
        this.counterparty = counterparty || null;
        this.bankCode = bankCode || null;
        this.upiId = upiId || null;
        this.balance = balance !== undefined ? balance : null;
        this.balanceAfter = balanceAfter !== undefined ? balanceAfter : null;
        this.location = location || null;
        this.parserConfidence = parserConfidence !== undefined ? parserConfidence : null;
        
        // Compatibility Layer for existing graph/risk engine and frontend components
        Object.assign(this, legacyFields);
        if (!this.timestamp) this.timestamp = this.date;
        if (!this.type) this.type = this.direction;
        if (!this.sourceAccount) this.sourceAccount = this.sourceAccountId;
        if (!this.destAccount) this.destAccount = this.counterpartyAccountId || 'Unknown Counterparty';
        if (!this.UTR) this.UTR = this.referenceId;
        if (!this.RRN) this.RRN = this.referenceId;
        if (!this.bank) this.bank = this.bankCode || 'UNKNOWN';
    }
}

class MoneyTrailEdge {
    constructor({ id, fromAccountId, toAccountId, transactionIds, totalAmount, firstSeen, lastSeen, relationType, evidenceIds }) {
        this.id = id;
        this.fromAccountId = fromAccountId;
        this.toAccountId = toAccountId;
        this.transactionIds = transactionIds || [];
        this.totalAmount = totalAmount || 0;
        this.firstSeen = firstSeen || null;
        this.lastSeen = lastSeen || null;
        this.relationType = relationType || 'TRANSFER';
        this.evidenceIds = evidenceIds || [];
    }
}

class Finding {
    constructor({ id, accountId, type, severity, priorityScore, title, explanation, supportingTransactionIds, supportingEdgeIds, supportingStatementIds, confidence, limitations }) {
        this.id = id;
        this.accountId = accountId;
        this.type = type;
        this.severity = severity || 'INFO';
        this.priorityScore = priorityScore || 0;
        this.title = title;
        this.explanation = explanation || null;
        this.supportingTransactionIds = supportingTransactionIds || [];
        this.supportingEdgeIds = supportingEdgeIds || [];
        this.supportingStatementIds = supportingStatementIds || [];
        this.confidence = confidence || null;
        this.limitations = limitations || [];
    }
}

module.exports = {
    Case,
    Account,
    Statement,
    Transaction,
    MoneyTrailEdge,
    Finding
};
