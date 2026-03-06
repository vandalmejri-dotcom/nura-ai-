async function testLink() {
    try {
        const res = await fetch('http://localhost:8080/api/link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: 'Hello this is a test paragraph for the link endpoint.' })
        });
        const data = await res.json();
        console.log("Link endpoint response:", data);
    } catch (e) {
        console.error("Link endpoint error:", e);
    }
}
testLink();
