const fs = require('fs');
async function testUpload() {
    const formData = new FormData();
    formData.append('file', new Blob(["History of Rome: Founded 27 BC, fell 476 AD."], { type: 'text/plain' }), 'test.txt');

    try {
        const res = await fetch('http://localhost:8080/api/upload', {
            method: 'POST',
            body: formData
        });
        const text = await res.text();
        console.log("Status:", res.status);
        console.log("Response:", text);
    } catch (e) {
        console.error("Fetch error:", e);
    }
}
testUpload();
