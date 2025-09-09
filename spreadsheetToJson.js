const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const API_KEY = process.env.GOOGLE_API_KEY;
const OUTPUT_FILE = 'spreadsheet.json';

if (!SHEET_ID || !API_KEY) {
    console.error('❌ Missing GOOGLE_SHEET_ID or GOOGLE_API_KEY in .env file');
    process.exit(1);
}

async function fetchSheetData(sheetId, apiKey) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?includeGridData=true&key=${apiKey}`;

    try {
        const res = await axios.get(url);
        const spreadsheet = res.data;

        const output = {};

        spreadsheet.sheets.forEach(sheet => {
            const sheetTitle = sheet.properties.title;
            const sheetData = {
                rows: [],
                charts: []
            };

            // Extract row data
            sheet.data.forEach(grid => {
                grid.rowData?.forEach(row => {
                    const rowValues = row.values?.map(cell => {
                        if (!cell) return null;

                        const formula = cell.userEnteredValue?.formulaValue;
                        const value = cell.formattedValue;

                        return formula
                            ? { formula, value }
                            : value || null;
                    }) || [];

                    sheetData.rows.push(rowValues);
                });
            });

            // Extract chart data
            if (sheet.charts && sheet.charts.length > 0) {
                sheet.charts.forEach(chart => {
                    // You can extract various properties of the chart here
                    // For simplicity, let's extract chartId and spec (chart type, data, options)
                    sheetData.charts.push({
                        chartId: chart.chartId,
                        spec: chart.spec
                    });
                });
            }

            output[sheetTitle] = sheetData;
        });

        fs.writeFileSync(path.resolve(__dirname, OUTPUT_FILE), JSON.stringify(output, null, 2), 'utf-8');
        console.log(`✅ Sheet data saved to ${OUTPUT_FILE}`);
    } catch (err) {
        console.error('❌ Error fetching sheet:', err.response?.data || err.message);
    }
}

fetchSheetData(SHEET_ID, API_KEY);
