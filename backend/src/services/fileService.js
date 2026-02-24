const fs = require('fs');
const csv = require('csv-parser');
const xlsx = require('xlsx');

const parseCsv = (filePath) => {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => {
                // Remove BOM if present in keys
                const cleanData = {};
                Object.keys(data).forEach(key => {
                    const cleanKey = key.trim().replace(/^\ufeff/, '');
                    cleanData[cleanKey] = data[key];
                });
                results.push(cleanData);
            })
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
};

const parseExcel = (filePath) => {
    try {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        return Promise.resolve(xlsx.utils.sheet_to_json(sheet));
    } catch (error) {
        return Promise.reject(error);
    }
};

const parseFile = async (file) => {
    const filename = file.originalname.toLowerCase();
    const filePath = file.path;

    try {
        if (filename.endsWith('.csv') || filename.endsWith('.txt')) {
            return await parseCsv(filePath);
        } else if (filename.endsWith('.xlsx')) {
            return await parseExcel(filePath);
        } else if (filename.endsWith('.json')) {
            const content = fs.readFileSync(filePath, 'utf8');
            const json = JSON.parse(content);
            return Array.isArray(json) ? json : [json];
        } else {
            throw new Error('Unsupported file format');
        }
    } finally {
        // Cleanup temp file
        try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (e) { console.error("Error deleting temp file", e); }
    }
};

module.exports = { parseFile };
