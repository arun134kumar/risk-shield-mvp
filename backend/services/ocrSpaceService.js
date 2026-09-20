const axios = require('axios');
const FormData = require('form-data');
const { PDFDocument } = require('pdf-lib');

class OcrSpaceService {
    
    static async parseImageWithBatching(buffer, mimetype, originalName) {
        // If it's not a PDF, just use the normal single parser
        if (mimetype !== 'application/pdf' && !originalName.toLowerCase().endsWith('.pdf')) {
            const text = await this.parseImage(buffer, mimetype, originalName);
            return { text, requestsCount: 1 };
        }

        const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
        const totalPages = pdfDoc.getPageCount();
        let extractedText = '';
        let requestsCount = 0;
        
        console.log(`[RiskShield] OCR batching started. Total pages: ${totalPages}`);

        // Batch by 3 pages (OCR.space free limit)
        for (let i = 0; i < totalPages; i += 3) {
            const batchDoc = await PDFDocument.create();
            const endPage = Math.min(i + 3, totalPages);
            const indices = [];
            for (let j = i; j < endPage; j++) indices.push(j);
            
            const copiedPages = await batchDoc.copyPages(pdfDoc, indices);
            copiedPages.forEach((page) => batchDoc.addPage(page));
            
            let batchBuffer = await batchDoc.save();
            const batchSizeMb = batchBuffer.length / (1024 * 1024);
            
            // If the 3-page batch exceeds 1MB (OCR.space free limit), fallback to 1-page batch
            if (batchSizeMb > 1.0) {
                console.log(`[RiskShield] Batch size ${batchSizeMb.toFixed(2)}MB exceeds 1MB limit. Switching to 1-page chunks for this range.`);
                for (let j = i; j < endPage; j++) {
                    const singleDoc = await PDFDocument.create();
                    const [singlePage] = await singleDoc.copyPages(pdfDoc, [j]);
                    singleDoc.addPage(singlePage);
                    const singleBuffer = await singleDoc.save();
                    
                    if (singleBuffer.length / (1024 * 1024) > 1.0) {
                        throw new Error('This scanned page exceeds the free OCR API file-size limit.');
                    }
                    
                    console.log(`[RiskShield] Processing single page ${j+1}`);
                    const text = await this.parseImage(singleBuffer, mimetype, `page_${j+1}_${originalName}`);
                    extractedText += text + '\n';
                    requestsCount++;
                }
            } else {
                console.log(`[RiskShield] Processing batch pages ${i+1}-${endPage}`);
                const text = await this.parseImage(batchBuffer, mimetype, `batch_${i+1}_to_${endPage}_${originalName}`);
                extractedText += text + '\n';
                requestsCount++;
            }
        }

        return { text: extractedText.trim(), requestsCount };
    }

    static async parseImage(buffer, mimetype, originalName) {
        const apiKey = process.env.OCR_SPACE_API_KEY;
        
        if (!apiKey) {
            console.error('[RiskShield] OCR.space API key is missing.');
            throw new Error('OCR_API_KEY_INVALID');
        }

        // Check file size (5MB limit for free tier)
        if (buffer.length > 5 * 1024 * 1024) {
            console.error('[RiskShield] File exceeds OCR 5MB limit.');
            throw new Error('OCR_FILE_TOO_LARGE');
        }

        const formData = new FormData();
        // The third argument requires filename for buffer uploads in form-data
        formData.append('file', buffer, { filename: originalName || 'statement.pdf', contentType: mimetype });
        formData.append('language', 'eng');
        formData.append('isOverlayRequired', 'false');
        formData.append('isTable', 'true');
        formData.append('scale', 'true');
        formData.append('detectOrientation', 'true');
        formData.append('OCREngine', '2'); // Using Engine 2 which is better for tables/receipts

        try {
            console.log(`[RiskShield] Calling OCR.space API (Engine 2)...`);
            const response = await axios.post('https://api.ocr.space/parse/image', formData, {
                headers: {
                    ...formData.getHeaders(),
                    'apikey': apiKey
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            const data = response.data;

            if (data.IsErroredOnProcessing) {
                console.error(`[RiskShield] OCR.space returned error:`, data.ErrorMessage);
                // Check if it's a limit issue
                const errorStr = (typeof data.ErrorMessage === 'string' ? data.ErrorMessage : (data.ErrorMessage || []).join('')).toLowerCase();
                const errorDetails = (typeof data.ErrorDetails === 'string' ? data.ErrorDetails : '').toLowerCase();
                if (errorStr.includes('limit') || errorStr.includes('quota') || errorStr.includes('maximum') || errorDetails.includes('limit')) {
                    throw new Error('OCR_LIMIT_REACHED');
                }
                throw new Error('OCR_FAILED');
            }

            if (!data.ParsedResults || data.ParsedResults.length === 0) {
                throw new Error('OCR_NO_TEXT_FOUND');
            }

            let extractedText = '';
            for (const result of data.ParsedResults) {
                if (result.ParsedText) {
                    extractedText += result.ParsedText + '\n';
                }
            }

            return extractedText.trim();
        } catch (error) {
            if (error.response) {
                console.error(`[RiskShield] OCR.space API HTTP error:`, error.response.status, error.response.data);
            } else {
                console.error(`[RiskShield] OCR.space Error:`, error.message);
            }
            // Propagate the specific error if it's one of our known errors, else general failure
            if (error.message.startsWith('OCR_')) {
                throw error;
            }
            throw new Error('OCR_FAILED');
        }
    }
}

module.exports = OcrSpaceService;
