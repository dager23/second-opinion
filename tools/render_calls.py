"""Render demo-call WAVs (multi-speaker Gemini TTS) and the whisper clips.

Usage: python tools/render_calls.py [--only digital-arrest-en] [--whispers]
Outputs: web/public/demo-calls/<id>.wav, manifest.json, web/public/whispers/{en,hi}/<id>.wav
"""
import argparse
import json
import time
import wave

from google import genai
from google.genai import types

from common import MODEL_TTS, ROOT, calls, load_key

OUT = ROOT / "web" / "public" / "demo-calls"
WHISPERS = ROOT / "web" / "public" / "whispers"

VOICES = {"caller": "Charon", "user": "Aoede"}


def save_wav(path, pcm: bytes, rate=24000):
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)


def tts(client, text, speakers=None, voice=None, model=None):
    contents = text
    if speakers:
        cfg = types.SpeechConfig(
            multi_speaker_voice_config=types.MultiSpeakerVoiceConfig(
                speaker_voice_configs=[
                    types.SpeakerVoiceConfig(
                        speaker=name,
                        voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=v)),
                    )
                    for name, v in speakers.items()
                ]
            )
        )
    else:
        cfg = types.SpeechConfig(
            voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice or "Kore"))
        )
    for attempt in range(1):  # free tier is ~10 requests/day/model: never burn quota on retries
        try:
            r = client.models.generate_content(
                model=model or MODEL_TTS,
                contents=contents,
                config=types.GenerateContentConfig(response_modalities=["AUDIO"], speech_config=cfg),
            )
            return r.candidates[0].content.parts[0].inline_data.data
        except Exception as e:  # noqa: BLE001
            wait = 10 * (attempt + 1)
            print(f"   TTS retry: {str(e)[:140]} (sleep {wait}s)")
            time.sleep(wait)
    raise RuntimeError("TTS failed (see message above)")


def render_call(client, c):
    parts = [
        types.Part(
            text=t["t"],
            speech_metadata=types.SpeechMetadata(
                speaker="Caller" if t["s"] == "caller" else "Elder",
                style="authoritative, pressuring, fast" if t["s"] == "caller" else "elderly, worried, slow",
            ),
        )
        for t in c["turns"]
    ]
    pcm = tts(client, [types.Content(role="user", parts=parts)], speakers={"Caller": VOICES["caller"], "Elder": VOICES["user"]})
    save_wav(OUT / f"{c['id']}.wav", pcm)


WHISPER_LINES = {
    "stop": {
        "en": "Please stop. This is very likely a scam. Real police never arrest anyone on a video call. Hang up now, and call your family.",
        "hi": "कृपया रुकिए। यह लगभग निश्चित रूप से धोखाधड़ी है। असली पुलिस वीडियो कॉल पर गिरफ्तारी नहीं करती। कॉल काटिए और अपने परिवार को फोन कीजिए।",
    },
    "warning": {
        "en": "Careful. This sounds like a scam. Do not share any code or send money. Hang up and call your family.",
        "hi": "सावधान। यह धोखाधड़ी लग रही है। कोई कोड न बताएँ और पैसे न भेजें। कॉल काटिए और परिवार को फोन कीजिए।",
    },
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only")
    ap.add_argument("--whispers", action="store_true")
    args = ap.parse_args()
    client = genai.Client(api_key=load_key())
    OUT.mkdir(parents=True, exist_ok=True)

    manifest = []
    for c in calls():
        if not c.get("demo"):
            continue
        target = OUT / f"{c['id']}.wav"
        if (not args.only or args.only == c["id"]) and not target.exists():
            print("rendering", c["id"])
            render_call(client, c)
            time.sleep(3)
        if target.exists():
            replay = OUT.parent / "replay" / f"{c['id']}.json"
            manifest.append(
                {
                    "id": c["id"],
                    "title": c["title"],
                    "lang": c["lang"],
                    "kind": c["kind"],
                    "audio": f"/demo-calls/{c['id']}.wav",
                    **({"replay": f"/replay/{c['id']}.json"} if replay.exists() else {}),
                }
            )
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False), encoding="utf8")
    print("manifest:", [m["id"] for m in manifest])

    if args.whispers:
        for lvl, langs in WHISPER_LINES.items():
            for lang, text in langs.items():
                p = WHISPERS / lang / f"{lvl}.wav"
                if p.exists():
                    continue
                print("whisper", lang, lvl)
                save_wav(p, tts(client, text, voice="Kore", model="gemini-3.1-flash-tts-preview"))
                time.sleep(3)


if __name__ == "__main__":
    main()
