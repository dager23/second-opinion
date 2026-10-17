"""Bring recorded replays in line with the live app's behaviour:
- guardian alert step at the first Warning (deterministic action),
- cool-off hold at the moment a payment / OTP / remote-access request is actually heard,
- a FINAL complaint draft written from the full transcript (shipped prompt `final_report`), shown right after the call ends.

Usage: python tools/finalize_replays.py
"""
import json
import wave

from google import genai
from google.genai import types

from common import MODEL_FLASH, ROOT, load_key, shared

REPLAYS = ROOT / "web" / "public" / "replay"
CALLS = ROOT / "web" / "public" / "demo-calls"
RANK = {"calm": 0, "caution": 1, "warning": 2, "stop": 3}
SCHEMA = {
    "type": "object",
    "properties": {
        "category": {"type": "string"},
        "summary": {"type": "string"},
        "caller_claims": {"type": "string"},
        "timeline": {"type": "array", "items": {"type": "string"}},
        "quotes": {"type": "array", "items": {"type": "string"}},
        "money_requested": {"type": "string"},
    },
}


def audio_ms(call_id):
    with wave.open(str(CALLS / f"{call_id}.wav"), "rb") as w:
        return int(w.getnframes() / w.getframerate() * 1000)


def main():
    client = genai.Client(api_key=load_key())
    prompt = shared("prompts.json")["final_report"]
    for f in sorted(REPLAYS.glob("*.json")):
        ev = json.loads(f.read_text(encoding="utf8"))
        # drop anything a previous run of this script added, plus the old synthetic hold step
        ev = [e for e in ev if not e.get("final") and not (e.get("step", {}).get("tool") in ("request_cooloff_hold", "alert_guardian"))]
        alerts = [e for e in ev if e["type"] == "alert"]
        warn = next((e for e in alerts if RANK[e["alert"]["level"]] >= 2), None)
        if not warn:
            f.write_text(json.dumps(ev, indent=1, ensure_ascii=False), encoding="utf8")
            print(f.name, "no warning: unchanged")
            continue
        level, scam = "calm", "none"
        signals, actions = [], ["Guardian alerted"]
        for e in alerts:
            a = e["alert"]
            if RANK[a["level"]] > RANK[level]:
                level = a["level"]
            if a.get("scam_type") and a["scam_type"] != "none":
                scam = a["scam_type"]
            signals += a.get("signals", [])
        ev.append({"t": warn["t"] + 300, "type": "step", "final": True,
                   "step": {"tool": "alert_guardian", "detail": "Guardian’s phone alerted with a live summary"}})
        ask = next(((e, s) for e in alerts for s in e["alert"].get("signals", [])
                    if s["id"] in ("payment_request", "remote_access") and RANK[e["alert"]["level"]] >= 2), None)
        if ask:
            e, s = ask
            what = "money / an OTP" if s["id"] == "payment_request" else "remote access"
            ev.append({"t": e["t"] + 400, "type": "step", "final": True,
                       "step": {"tool": "request_cooloff_hold", "detail": f"Caller asked for {what}: “{s['quote']}”"}})
            actions.append("Cool-off hold requested (awaiting guardian approval)")
        transcript = "".join(e.get("text", "") for e in ev if e["type"] == "transcript")
        brief = "\n".join([
            f"Detected level: {level}. Scam type: {scam}.",
            "Signals heard so far: " + " | ".join(f"{s['id']}: \"{s['quote']}\"" for s in signals),
            "Actions already taken by the app: " + "; ".join(actions),
            f"Transcript:\n{transcript}",
        ])
        r = client.models.generate_content(
            model=MODEL_FLASH,
            contents=brief,
            config=types.GenerateContentConfig(system_instruction=prompt, response_mime_type="application/json", response_schema=SCHEMA),
        )
        rep = json.loads(r.text)
        rep["actions_taken"] = actions
        end = audio_ms(f.stem) + 1200  # after the audio ends, before the replay closes (+2.5 s)
        ev.append({"t": end, "type": "report", "final": True, "report": rep})
        ev.append({"t": end + 100, "type": "step", "final": True,
                   "step": {"tool": "draft_report", "detail": "Final complaint draft written from the full call"}})
        ev.sort(key=lambda e: e["t"])
        f.write_text(json.dumps(ev, indent=1, ensure_ascii=False), encoding="utf8")
        print(f.name, "| money:", rep.get("money_requested"), "| category:", rep.get("category"))


if __name__ == "__main__":
    main()
