async function run() {
    const res = await fetch('https://www.youtube.com/watch?v=P6FORpg0KVo', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await res.text();
    const match = html.match(/"captionTracks":\s*(\[.*?\])/);
    if (match) {
        const tracks = JSON.parse(match[1]);
        const url = tracks[0].baseUrl.replace(/\\u0026/g, '&') + '&fmt=json3';
        console.log("Fetching URL:", url.substring(0, 100));
        const xmlRes = await fetch(url);
        const json = await xmlRes.json();
        console.log("JSON response:", json.events ? json.events.length : 0);
        console.log("First event:", JSON.stringify(json.events[0]).substring(0, 200));
    }
}
run();
