"""Build 'recorded' replay files for the demo calls (used when the live models are unavailable or quota is exhausted).

The transcript/alert/agent-step events are produced by running the call script through the SAME shipped prompts
(chunk classifier + case-agent report), then timed against the rendered audio file. The result is labelled 'Recorded replay' in the app.

Usage: python tools/make_replay.py [id ...]
"""
import json
import sys
import time
import wave

from google import genai
from google.genai import types

from common import MODEL_FLASH, MODEL_LITE, ROOT, calls, load_key, shared

RANK = {"calm": 0, "caution": 1, "warning": 2, "stop": 3}
OUT = ROOT / "web" / "public" / "replay"

ALERT_SCHEMA = {
    "type": "object",
    "properties": {
        "level": {"type": "string", "enum": list(RANK)},
        "scam_type": {"type": "string"},
        "signals": {"type": "array", "items": {"type": "object", "properties": {"id": {"type": "string"}, "quote": {"type": "string"}}}},
        "whisper_en": {"type": "string"},
        "whisper_hi": {"type": "string"},
    },
    "required": ["level", "signals"],
}
REPORT_SCHEMA = {
    "type": "object",
    "properties": {
        "category": {"type": "string"},
        "summary": {"type": "string"},
        "caller_claims": {"type": "string"},
        "timeline": {"type": "array", "items": {"type": "string"}},
        "quotes": {"type": "array", "items": {"type": "string"}},
        "money_requested": {"type": "string"},
        "guardian_summary": {"type": "string"},
    },
}


def gen(client, model, system, contents, schema):
    for attempt in range(6):
        try:
            r = client.models.generate_content(
                model=model,
                contents=contents,
                config=types.GenerateContentConfig(system_instruction=system, response_mime_type="application/json", response_schema=schema),
            )
            return json.loads(r.text)
        except Exception as e:  # noqa: BLE001
            print("  retry:", str(e)[:100])
            time.sleep(15 * (attempt + 1))
    raise RuntimeError("generation failed")


def wav_seconds(path):
    with wave.open(str(path), "rb") as w:
        return w.getnframes() / w.getframerate()


def main():
    ids = sys.argv[1:]
    client = genai.Client(api_key=load_key())
    prompts = shared("prompts.json")
    OUT.mkdir(parents=True, exist_ok=True)
    for c in calls():
        if not c.get("demo") or (ids and c["id"] not in ids):
            continue
        wav = ROOT / "web" / "public" / "demo-calls" / f"{c['id']}.wav"
        if not wav.exists():
            continue
        total = wav_seconds(wav)
        words = [len(t["t"].split()) for t in c["turns"]]
        allw = sum(words)
        events, summary, peak, t_acc, transcript = [], "", "calm", 0, ""
        agent_done = 0
        for turn, w in zip(c["turns"], words):
            start = t_acc / allw * total
            t_acc += w
            end = t_acc / allw * total
            speaker = "Caller" if turn["s"] == "caller" else "You"
            line = f"{speaker}: {turn['t']}\n"
            transcript += line
            events.append({"t": int(start * 1000), "type": "transcript", "text": line})
            if turn["s"] != "caller":
                summary += f" USER: {turn['t']}"
                continue
            res = gen(client, MODEL_LITE, prompts["chunk_classifier"] + "\nAlso write whisper_en and whisper_hi (calm, 1-2 sentences, Hindi in Devanagari) when level is warning or stop.",
                      f"Running summary of the call so far: {summary or '(start)'}\n\nTranscript of this part:\nCALLER: {turn['t']}", ALERT_SCHEMA)
            summary = (summary + f" CALLER: {turn['t']}")[-1500:]
            lvl = res.get("level", "calm")
            if RANK[lvl] > RANK[peak] and lvl != "calm":
                peak = lvl
                res.setdefault("scam_type", c["scam_type"])
                events.append({"t": int(end * 1000) + 600, "type": "alert", "alert": {
                    "level": lvl, "scam_type": res.get("scam_type", "none"), "signals": res.get("signals", []),
                    "whisper_en": res.get("whisper_en", ""), "whisper_hi": res.get("whisper_hi", "")}})
                if RANK[lvl] >= RANK["warning"] and agent_done == 0 and c["kind"] == "scam":
                    agent_done = 1
                    rep = gen(client, MODEL_FLASH, prompts["case_agent"] + "\nReturn the complaint draft fields plus a guardian_summary (one or two plain sentences for a worried family member).",
                              f"Level {lvl}, scam type {res.get('scam_type')}. Signals: {json.dumps(res.get('signals'))}\nTranscript:\n{transcript}", REPORT_SCHEMA)
                    base = int(end * 1000) + 1200
                    events.append({"t": base, "type": "step", "step": {"tool": "check_official_advisory", "detail": res.get("scam_type", "")}})
                    events.append({"t": base + 900, "type": "step", "step": {"tool": "notify_guardian", "detail": rep.get("guardian_summary", "")}})
                    events.append({"t": base + 1800, "type": "step", "step": {"tool": "request_cooloff_hold", "detail": "Caller requested a money transfer / OTP"}})
                    events.append({"t": base + 3000, "type": "step", "step": {"tool": "draft_report", "detail": "Complaint draft for 1930 / cybercrime.gov.in"}})
                    events.append({"t": base + 3200, "type": "report", "report": {
                        "category": rep.get("category", ""), "summary": rep.get("summary", ""), "caller_claims": rep.get("caller_claims", ""),
                        "timeline": rep.get("timeline", []), "quotes": rep.get("quotes", []), "money_requested": rep.get("money_requested", "none stated"),
                        "actions_taken": ["Guardian notified", "Cool-off hold requested (awaiting guardian approval)"]}})
            time.sleep(5)
        events.sort(key=lambda e: e["t"])
        (OUT / f"{c['id']}.json").write_text(json.dumps(events, indent=1, ensure_ascii=False), encoding="utf8")
        print("wrote replay", c["id"], len(events), "events")


if __name__ == "__main__":
    main()
