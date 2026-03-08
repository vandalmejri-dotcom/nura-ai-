async function run() {
    const res = await fetch('https://www.youtube.com/watch?v=1AElONvi9WQ', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await res.text();
    const match = html.match(/"captionTracks":\s*(\[.*?\])/);
    if (match) {
        const tracks = JSON.parse(match[1]);
        console.log("BASE URL:", tracks[0].baseUrl);
        const xmlRes = await fetch(tracks[0].baseUrl);
        console.log("STATUS:", xmlRes.status, xmlRes.headers.get('content-type'));
        const xml = await xmlRes.text();
        console.log("TEXT LENGTH:", xml.length);
        console.log("FIRST 200:", xml.substring(0, 200));
    }
}
run();
