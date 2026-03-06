const fs = require('fs');
const pdfParse = require('pdf-parse');

console.log('pdfParse type:', typeof pdfParse);
if (typeof pdfParse === 'object') {
    console.log('Keys:', Object.keys(pdfParse));
    if (typeof pdfParse.default === 'function') {
        console.log('Default is a function!');
    }
}
