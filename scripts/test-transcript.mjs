import { YoutubeTranscript } from "youtube-transcript";

// any video where you can see captions exist on YouTube — swap in one of yours
const id = process.argv[2] || "kJQjXAVEWt0";

try {
  const t = await YoutubeTranscript.fetchTranscript(id);
  console.log("SUCCESS —", t.length, "segments. First one:", t[0]);
} catch (e) {
  console.error("FAILED:", e.message);
}
