# Sing Along

A karaoke teleprompter for Meta Display glasses: play a song from your own library and the synced lyrics float in front of you, line by line, at the right moment. Songs are plain MP3/WAV files paired with standard `.lrc` timed-lyrics files — drop your own purchased music in `songs/`, grab the matching LRC from [lrclib.net](https://lrclib.net), and sing.

---

## What it does

- **Synced lyrics display.** Parses LRC timestamps and highlights the current line (big, white) with neighbors dimmed above and below — readable at a glance on the lens.
- **Bring-your-own music.** Audio + lyrics are local files listed in `songs.json`; the `songs/` folder is gitignored so purchased media never leaves your machine. A public-domain demo track ("Row, Row, Row Your Boat", synthesized) ships with the repo so it runs out of the box.
- **Live sync nudge.** If an LRC is timed slightly off, nudge the offset ±0.3 s while the song plays. The offset is remembered per song.
- **Line jumping.** Skip back to restart a verse, or ahead to the chorus — the audio seeks with you.

## Controls

| Where | Input | Result |
| --- | --- | --- |
| Home | ▲ ▼ | Pick a song |
| Home | Enter | Open it and start singing |
| Sing | Enter | Play / pause (replay when ended) |
| Sing | ▲ ▼ | Jump to previous / next lyric line |
| Sing (playing) | ◀ ▶ | Nudge sync offset −/+ 0.3 s |
| Sing (paused) | ◀ | Back to song list |
| Sing (paused) | ▶ | Resume |

## Adding your own songs

1. Copy the audio file into `songs/` (MP3, WAV — anything the browser plays).
2. Download the matching synced lyrics from [lrclib.net](https://lrclib.net) and save it next to the audio as a `.lrc` file.
3. Add an entry to `songs.json`:

```json
{ "id": "my-song", "title": "My Song", "artist": "Artist", "audio": "songs/my-song.mp3", "lrc": "songs/my-song.lrc" }
```

## Running locally

The app is a single static HTML/CSS/JS bundle — no build step.

```bash
npx serve -l 4242 singalong
# then open http://localhost:4242
```

### Regenerating screenshots

> 🛠️ **Developer tooling only.** The app itself has zero Chrome dependency — it's vanilla HTML/CSS/JS that runs in the Ray-Ban Meta Display's built-in browser. The block below is just the local recipe used on a Mac to refresh the PNGs in `screenshots/`.

The app reads `?state=home` and `?state=sing&song=<id>` on load:

```bash
npx serve -l 4342 singalong &
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for STATE in "home" "sing&song=row-your-boat"; do
  NAME=$(echo "$STATE" | cut -d'&' -f1)
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --window-size=600,600 --virtual-time-budget=3000 \
    --screenshot="singalong/screenshots/$NAME.png" \
    "http://localhost:4342/?state=$STATE"
done
```

## Files

```
singalong/
├── index.html      # home picker + sing screen
├── styles.css      # 600×600 black HUD; amber accent, centered lyrics
├── app.js          # LRC parser, rAF sync loop, D-pad state machine
├── songs.json      # song registry (title, artist, audio, lrc)
├── songs/          # your media (gitignored) + public-domain demo track
└── favicon.svg     # amber double note on black
```

---

<sub>Made by Gautier de Lataillade at [L+R](https://www.levinriegner.com).</sub>
