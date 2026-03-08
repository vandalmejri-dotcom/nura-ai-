async function run() {
    const r = await fetch('https://pipedapi.kavin.rocks/streams/P6FORpg0KVo', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok) { console.log('PIPED HTTP', r.status); return; }
    const json = await r.json();
    console.log(json.subtitles.length, "subtitles found");
    if (json.subtitles.length > 0) {
        console.log("Fetching first subtitle:", json.subtitles[0].url);
        const subRes = await fetch(json.subtitles[0].url);
        console.log("Sub:", await subRes.text().then(t => t.substring(0, 100)));
    }
}
run();
