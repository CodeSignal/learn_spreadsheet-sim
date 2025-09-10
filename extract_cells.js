const fs = require('fs');
const path = require('path');

// Function to convert column letter to index (A=0, B=1, C=2, etc.)
function columnLetterToIndex(letter) {
    return letter.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
}

// Function to parse cell reference (e.g., "C1" -> {column: 2, row: 0})
function parseCellReference(cellRef) {
    const match = cellRef.match(/^([A-Z]+)(\d+)$/i);
    if (!match) {
        throw new Error(`Invalid cell reference: ${cellRef}`);
    }
    
    const columnLetter = match[1].toUpperCase();
    const rowNumber = parseInt(match[2]);
    
    // Convert to 0-based indices
    const columnIndex = columnLetterToIndex(columnLetter);
    const rowIndex = rowNumber - 1; // Convert 1-based to 0-based
    
    return { column: columnIndex, row: rowIndex, original: cellRef };
}

// Function to get cell value from spreadsheet data
function getCellValue(sheetData, columnIndex, rowIndex) {
    if (!sheetData.rows || rowIndex >= sheetData.rows.length || rowIndex < 0) {
        return { exists: false, reason: 'Row out of bounds' };
    }
    
    const row = sheetData.rows[rowIndex];
    if (!row || columnIndex >= row.length || columnIndex < 0) {
        return { exists: false, reason: 'Column out of bounds' };
    }
    
    const cellValue = row[columnIndex];
    return { 
        exists: true, 
        value: cellValue,
        type: typeof cellValue === 'object' ? 'formula' : typeof cellValue,
        isEmpty: cellValue === null || cellValue === undefined || cellValue === ''
    };
}

// Function to format cell details for output
function formatCellDetails(cellRef, cellInfo, sheetName) {
    const { original } = cellRef;
    
    if (!cellInfo.exists) {
        return `${original}: [ERROR] ${cellInfo.reason}`;
    }
    
    if (cellInfo.isEmpty) {
        return `${original}: <empty>`;
    }
    
    if (cellInfo.type === 'formula' && cellInfo.value.formula) {
        return `${original}: ${cellInfo.value.formula} (evaluates to: ${cellInfo.value.value})`;
    }
    
    return `${original}: ${cellInfo.value}`;
}

// Main function
function extractCells() {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.error('Usage: node extract_cells.js <spreadsheet.json> <cell1> [cell2] [cell3] ...');
        console.error('Example: node extract_cells.js spreadsheet.json C1 C20 E40');
        process.exit(1);
    }
    
    const jsonFilePath = args[0];
    const cellReferences = args.slice(1);
    
    // Check if file exists
    if (!fs.existsSync(jsonFilePath)) {
        console.error(`❌ File not found: ${jsonFilePath}`);
        process.exit(1);
    }
    
    try {
        // Read and parse JSON file
        const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
        
        // Get the first sheet (or we could make this configurable)
        const sheetNames = Object.keys(jsonData);
        if (sheetNames.length === 0) {
            console.error('❌ No sheets found in the spreadsheet data');
            process.exit(1);
        }
        
        const sheetName = sheetNames[0]; // Use first sheet by default
        const sheetData = jsonData[sheetName];
        
        if (sheetNames.length > 1) {
            console.log(`📋 Using sheet: "${sheetName}" (${sheetNames.length} sheets available)`);
            console.log('');
        }
        
        // Process each cell reference
        cellReferences.forEach(cellRefString => {
            try {
                const cellRef = parseCellReference(cellRefString);
                const cellInfo = getCellValue(sheetData, cellRef.column, cellRef.row);
                const output = formatCellDetails(cellRef, cellInfo, sheetName);
                console.log(output);
            } catch (error) {
                console.log(`${cellRefString}: [ERROR] ${error.message}`);
            }
        });
        
    } catch (error) {
        console.error(`❌ Error reading JSON file: ${error.message}`);
        process.exit(1);
    }
}

// Run the script
extractCells();

module.exports = { parseCellReference, getCellValue, formatCellDetails };
