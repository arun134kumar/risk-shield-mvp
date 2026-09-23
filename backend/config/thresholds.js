module.exports = {
    // Transaction-level Risk Thresholds
    TRANSACTION: {
        LOW: 0,
        MEDIUM: 30,
        HIGH: 60,
        CRITICAL: 80
    },
    // Case/Account-level Risk Thresholds
    CASE: {
        LOW: 0,
        MEDIUM: 40,
        HIGH: 70,
        CRITICAL: 90
    },
    // Signals configuration
    SIGNALS: {
        DECIMAL_PATTERN: 10,
        RAPID_TRANSFER: 20,
        SPLITTING: 25,
        AMOUNT_CLUSTER: 10,
        MULTI_SENDER: 15,
        TIME_WINDOW: 20,
        REPEATED_TXN: 10,
        CIRCULAR_FLOW: 30
    }
};
