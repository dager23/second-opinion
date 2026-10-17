"""Run every scripted call through the SHIPPED chunk-classifier prompt, turn by turn, and report detection / false alarms.

Usage: python tools/run_eval.py [--model gemini-3.5-flash-lite]
Writes eval/results.md and web/public/eval-results.json
"""
import argparse
import json
import statistics
import time

from google import genai
from google.genai import types

from common import MODEL_LITE, ROOT, calls, load_key, shared

RANK = {"calm": 0, "caution": 1, "warning": 2, "stop": 3}
WORDS_PER_SEC = 2.4  # rough speaking rate used to estimate timing of each turn
JA_CHARS_PER_SEC = 7.0  # Japanese has no spaces: estimate from characters instead


def speak_seconds(text, lang):
    return len(text) / JA_CHARS_PER_SEC if lang == "ja" else len(text.split()) / WORDS_PER_SEC


def classify(client, model, prompt, summary, text):
    schema = {
        "type": "object",
        "properties": {
            "level": {"type": "string", "enum": list(RANK)},
            "scam_type": {"type": "string"},
            "signals": {"type": "array", "items": {"type": "object", "properties": {"id": {"type": "string"}, "quote": {"type": "string"}}}},
        },
        "required": ["level", "signals"],
    }
    for attempt in range(8):
        try:
            r = client.models.generate_content(
                model=model,
                contents=f"Running summary of the call so far: {summary or '(start of call)'}\n\nTranscript of this part of the call:\n{text}",
                config=types.GenerateContentConfig(
                    system_instruction=prompt, response_mime_type="application/json", response_schema=schema
                ),
            )
            return json.loads(r.text)
        except Exception as e:  # noqa: BLE001
            wait = 12 * (attempt + 1)
            print(f"   retry after error: {str(e)[:120]} (sleep {wait}s)")
            time.sleep(wait)
    raise RuntimeError("classification kept failing; aborting rather than recording a false result")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=MODEL_LITE)
    ap.add_argument("--delay", type=float, default=5, help="seconds between requests (free-tier friendly)")
    args = ap.parse_args()
    client = genai.Client(api_key=load_key())
    prompt = shared("prompts.json")["chunk_classifier"]

    rows = []
    for c in calls():
        t = 0.0
        summary = ""
        peak = "calm"
        first = None
        for turn in c["turns"]:
            t += speak_seconds(turn["t"], c["lang"])
            if turn["s"] != "caller":
                summary += f" USER: {turn['t']}"
                continue
            res = classify(client, args.model, prompt, summary, f"CALLER: {turn['t']}")
            summary = (summary + f" CALLER: {turn['t']}")[-1500:]
            lvl = res.get("level", "calm")
            if RANK[lvl] > RANK[peak]:
                peak = lvl
            if first is None and RANK[lvl] >= RANK["warning"]:
                first = round(t)
            time.sleep(args.delay)
        detected = RANK[peak] >= RANK["warning"]
        rows.append({"id": c["id"], "kind": c["kind"], "lang": c["lang"], "level": peak, "detected": detected, "first_warning_s": first})
        print(f"{c['id']:<28} {c['kind']:<8} peak={peak:<8} first_warning={first}")

    scam = [r for r in rows if r["kind"] == "scam"]
    gen = [r for r in rows if r["kind"] == "genuine"]
    det = sum(r["detected"] for r in scam) / max(1, len(scam))
    fa = sum(r["detected"] for r in gen) / max(1, len(gen))
    firsts = [r["first_warning_s"] for r in scam if r["first_warning_s"] is not None]
    med = statistics.median(firsts) if firsts else None
    out = {
        "model": args.model,
        "detection_rate": det,
        "false_alarm_rate": fa,
        "median_seconds_to_first_warning": med,
        "scam_calls": len(scam),
        "genuine_calls": len(gen),
        "rows": rows,
    }
    (ROOT / "web" / "public" / "eval-results.json").write_text(json.dumps(out, indent=1), encoding="utf8")
    md = [
        f"# Evaluation ({args.model})",
        "",
        f"- Scam calls detected (warning or stop): **{det:.0%}** of {len(scam)}",
        f"- False alarms on genuine calls: **{fa:.0%}** of {len(gen)}",
        f"- Median estimated seconds to first warning: **{med}**",
        "",
        "| Call | Type | Peak level | First warning (est. s) |",
        "|---|---|---|---|",
    ]
    md += [f"| {r['id']} | {r['kind']} | {r['level']} | {r['first_warning_s'] if r['first_warning_s'] is not None else '—'} |" for r in rows]
    md += ["", "Timing is estimated from word counts at ~2.4 words/s (Japanese: ~7 characters/s). Scripted calls, indicative only."]
    (ROOT / "eval" / "results.md").write_text("\n".join(md), encoding="utf8")
    print(f"\nDetection {det:.0%} | false alarms {fa:.0%} | median first warning {med}s")


if __name__ == "__main__":
    main()
