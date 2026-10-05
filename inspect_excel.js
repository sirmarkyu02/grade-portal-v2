const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'Grades', '11 ASSH & STEM - Gen Math.xlsx');
const workbook = xlsx.readFile(filePath, { cellFormula: true });

function examineSheet(sheetName, cellsToPrint) {
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
        console.log("Sheet not found!");
        return;
    }
    
    cellsToPrint.forEach(cellAddr => {
        const cell = sheet[cellAddr];
        if (cell) {
            console.log(`${cellAddr}: Value=${cell.v}, Formula=${cell.f ? '=' + cell.f : 'N/A'}`);
        } else {
            console.log(`${cellAddr}: Empty`);
        }
    });
}

examineSheet('Term 1', ['BG44', 'BG45', 'BF44', 'BE44', 'BD44', 'BC44', 'BB44', 'BA44', 'AZ44', 'AY44', 'AX44', 'AW44', 'AV44', 'AU44', 'AT44', 'AS44', 'AR44', 'AQ44', 'AP44']);
