/**
 * Standardizes date parsing across the application.
 * Converts various date formats (DD/MM/YYYY, Excel serials, ISO) into a standard Date object.
 */
function parseDate(dateStr) {
    if (!dateStr) return null;
    
    // Check if it's already a Date object
    if (dateStr instanceof Date) return dateStr;
    
    // Check if it's a number (Excel serial date)
    // Excel dates are number of days since Jan 1, 1900
    if (typeof dateStr === 'number' || (!isNaN(dateStr) && dateStr.toString().trim() !== '' && !dateStr.toString().includes('/'))) {
        const num = Number(dateStr);
        // Excel serial date bug (leap year 1900) compensation
        // 25569 is Jan 1, 1970 relative to Jan 1, 1900
        if (num > 10000 && num < 100000) {
            const excelEpochMs = Date.UTC(1899, 11, 30);
            return new Date(excelEpochMs + num * 86400000);
        }
        return new Date(num);
    }
    
    const str = String(dateStr).trim();
    
    // Match DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (dmyMatch) {
        const day = parseInt(dmyMatch[1], 10);
        const month = parseInt(dmyMatch[2], 10) - 1; // 0-indexed month
        let year = parseInt(dmyMatch[3], 10);
        if (year < 100) year += 2000; // assume 20xx for 2 digit years
        
        // Extract optional time
        const timeMatch = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
        let hours = 0, minutes = 0, seconds = 0;
        if (timeMatch) {
            hours = parseInt(timeMatch[1], 10);
            minutes = parseInt(timeMatch[2], 10);
            seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
        }
        
        return new Date(year, month, day, hours, minutes, seconds);
    }
    
    // Match YYYY-MM-DD
    const ymdMatch = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
    if (ymdMatch) {
        return new Date(str); // JS handles ISO reasonably well
    }
    
    // Fallback
    const fallbackDate = new Date(str);
    if (!isNaN(fallbackDate.getTime())) return fallbackDate;
    
    return null;
}

/**
 * Returns an ISO string representation of the parsed date.
 */
function normalizeDate(dateStr) {
    const d = parseDate(dateStr);
    return d ? d.toISOString() : null;
}

module.exports = { parseDate, normalizeDate };
