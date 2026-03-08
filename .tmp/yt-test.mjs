import { YoutubeTranscript } from 'youtube-transcript';
YoutubeTranscript.fetchTranscript('P6FORpg0KVo').then(t => console.log(t.length)).catch(console.error);
