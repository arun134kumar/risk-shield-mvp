class Case {
    constructor({ caseId, status, createdBy, createdAt, evidenceIds }) {
        this.caseId = caseId;
        this.status = status || 'OPEN';
        this.createdBy = createdBy;
        this.createdAt = createdAt || new Date().toISOString();
        this.evidenceIds = evidenceIds || [];
    }
}

class Account {
    constructor({ accountId, maskedNumber, bank, riskStatus, complaintStatus, complaintSource }) {
        this.accountId = accountId;
        this.maskedNumber = maskedNumber;
        this.bank = bank;
        this.riskStatus = riskStatus || 'NORMAL';
        this.complaintStatus = complaintStatus || 'NO_KNOWN_CASE';
        this.complaintSource = complaintSource || null;
    }
}

class Transaction {
    constructor({ id, caseId, sender, receiver, UTR, RRN, amount, timestamp, type, narration, bank, location, atmId }) {
        this.id = id;
        this.caseId = caseId;
        this.sender = sender;
        this.receiver = receiver;
        this.UTR = UTR || null;
        this.RRN = RRN || null;
        this.amount = amount;
        this.timestamp = timestamp;
        this.type = type;
        this.narration = narration;
        this.bank = bank;
        this.location = location || null;
        this.atmId = atmId || null;
    }
}

class ATM {
    constructor({ atmId, latitude, longitude, h3Cell, historicalCount, historicalAmount, baselineFeatures }) {
        this.atmId = atmId;
        this.latitude = latitude;
        this.longitude = longitude;
        this.h3Cell = h3Cell;
        this.historicalCount = historicalCount || 0;
        this.historicalAmount = historicalAmount || 0;
        this.baselineFeatures = baselineFeatures || {};
    }
}

class Evidence {
    constructor({ evidenceId, sha256, uploadedAt, uploadedBy }) {
        this.evidenceId = evidenceId;
        this.sha256 = sha256;
        this.uploadedAt = uploadedAt || new Date().toISOString();
        this.uploadedBy = uploadedBy;
    }
}

class AuditEvent {
    constructor({ eventId, userId, caseId, action, timestamp, objectId }) {
        this.eventId = eventId;
        this.userId = userId;
        this.caseId = caseId;
        this.action = action;
        this.timestamp = timestamp || new Date().toISOString();
        this.objectId = objectId || null;
    }
}

module.exports = {
    Case,
    Account,
    Transaction,
    ATM,
    Evidence,
    AuditEvent
};
