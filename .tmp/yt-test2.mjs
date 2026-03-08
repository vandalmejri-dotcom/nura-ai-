async function run() {
    const res = await fetch('https://www.youtube.com/watch?v=P6FORpg0KVo', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await res.text();
    const match = html.match(/"captionTracks":\s*(\[.*?\])/);
    if (match) {
        const tracks = JSON.parse(match[1]);
        const url = tracks[0].baseUrl.replace(/\\u0026/g, '&');
        console.log("Fetching URL:", url.substring(0, 100));
        const xmlRes = await fetch(url);
        console.log("Status:", xmlRes.status);
        const xml = await xmlRes.text();
        console.log("XML:", xml.substring(0, 200));
    }
}
run();
