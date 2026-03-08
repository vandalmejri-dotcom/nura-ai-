import yt from 'youtube-ext';
yt.videoInfo('P6FORpg0KVo').then(info => {
    const caps = info.captionTracks;
    if (caps && caps.length) {
        console.log("Caps found: ", caps.length);
        const url = caps[0].url || caps[0].baseUrl;
        console.log("URL:", url);
    } else {
        console.log("No caps found");
    }
}).catch(console.error);
