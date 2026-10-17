"""Fill the official AI Builder Cup submission template (PDF) with our content.

Usage:
  python tools/build_submission.py --template "D:/aibuildercup/Submission Template _ AI Builder Cup.pdf" \
      --video-url https://youtu.be/xxxx
Writes docs/submission/Victoris-Second-Opinion-Submission.pdf (<5 MB).
"""
import argparse
import json
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "docs" / "submission" / "assets"
APP_URL = "https://gen-lang-client-0095149296.web.app"
REPO_URL = "https://github.com/dager23/second-opinion"

INK = (0.08, 0.13, 0.24)
BODY = pymupdf.Rect(28, 88, 692, 388)


def fit_text(doc, page, rect, text, size=11.5, min_size=6.5, color=INK, font="helv"):
    """insert_textbox inserts nothing when the text overflows, so step the font size down until it fits."""
    rect = pymupdf.Rect(rect)
    s = size
    while s >= min_size:
        if page.insert_textbox(rect, text, fontsize=s, fontname=font, color=color, align=0) >= 0:
            return s
        s -= 0.5
    raise RuntimeError(f"text does not fit on page {page.number + 1}")


def image(page, rect, name):
    page.insert_image(pymupdf.Rect(rect), filename=str(ASSETS / name), keep_proportion=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--template", required=True)
    ap.add_argument("--video-url", default="(add demo video link)")
    ap.add_argument("--out", default=str(ROOT / "docs" / "submission" / "Victoris-Second-Opinion-Submission.pdf"))
    a = ap.parse_args()

    ev = json.loads((ROOT / "web" / "public" / "eval-results.json").read_text(encoding="utf8"))
    doc = pymupdf.open(a.template)
    P = lambda n: doc[n - 1]  # 1-based template page

    # ---- Page 1: team details
    p = P(1)
    p.insert_text((200, 299), "Victoris", fontsize=13, fontname="helv", color=INK)
    p.insert_text((252, 321), "Yash Shah  (team: Pratyaksh, Krishna)", fontsize=13, fontname="helv", color=INK)
    fit_text(doc, p, pymupdf.Rect(262, 330, 705, 392), "Sustainability & Social Impact: Second Opinion, a live scam guardian that warns seniors (and every age group) before money moves.", 11.5)

    # ---- Page 3: brief about the idea
    fit_text(doc, P(3), BODY, (
        "Second Opinion is a live scam guardian for the people we love. It listens alongside someone on a suspicious call "
        "(speakerphone or a shared Google Meet tab), recognises the coercion pattern behind scams such as the fake-police "
        "'digital arrest', and warns them calmly in English or Hindi BEFORE any money moves.\n\n"
        "It then brings in a family guardian, requests a cool-off hold and drafts the cybercrime complaint (1930 / cybercrime.gov.in). "
        "The same engine also checks screenshots, voice notes, pasted messages or a plain question ('is this a scam?'), and extends "
        "from seniors to teens and young adults.\n\n"
        "Why it matters: most losses are payments the victim authorises under pressure on a call, which transaction monitoring cannot see.\n"
        "  - Japan 2025: JPY 142.3B lost to special fraud (+98%); people 65+ bore 59.2%.\n"
        "  - India 2024: INR 1,935 crore lost to 'digital arrest' scams (1.23 lakh complaints).\n"
        "  - Australia 2025: people 65+ are 17.1% of the population but 26.5% of reported losses.\n\n"
        "Theme: Sustainability & Social Impact   |   Category: Social Good"), 12)

    # ---- Page 4: opportunities
    fit_text(doc, P(4), pymupdf.Rect(60, 118, 692, 390), (
        "How different is it from existing ideas?\n"
        "  - Existing tools check transactions after the fact, filter spam, or analyse a single uploaded message. Second Opinion works DURING the call, "
        "reasoning about the coercion state (authority + urgency + secrecy + payment request), not keywords, in English / Hindi / Hinglish.\n"
        "  - It acts: guardian alert, guardian-approved cool-off hold, ready-to-file complaint draft. Every alert shows the exact quote that triggered it.\n\n"
        "How will it solve the problem?\n"
        "  - It interrupts the scam at the one moment it can be stopped: while the victim is on the call and before they authorise the transfer.\n"
        "  - A family member is pulled in within seconds, breaking the isolation scammers rely on. Reporting is instant (feeds India's 1930 'golden hour').\n\n"
        "USP\n"
        "  - Live, multilingual, explainable (quotes + official advisories), human-in-the-loop (guardian approves), privacy-first (no audio stored), "
        "and ONE engine for every age group: seniors today, teens (sextortion) and young adults (job/task scams) next."), 11.5)

    # ---- Page 5: features
    fit_text(doc, P(5), pymupdf.Rect(40, 100, 692, 390), (
        "1. Call Guard: listens to speakerphone, a Google Meet tab or a demo call; live transcript; risk meter (Calm / Caution / Warning / STOP).\n"
        "2. Signal timeline: each scam signal with the exact quote and timestamp (authority claim, urgency, secrecy, payment/OTP request, threat ...).\n"
        "3. Whisper warning in English or Hindi and a one-tap 'Hang up & call 1930' button; large, calm, senior-friendly UI.\n"
        "4. Case agent (Gemini function calling): checks the official advisory, alerts the guardian, requests a cool-off hold, drafts the complaint.\n"
        "5. Family guardian console on a second phone (QR / pairing code): realtime alerts, approve or decline the hold.\n"
        "6. Complaint draft for 1930 / cybercrime.gov.in: category, summary, timeline, quotes, amount requested; copy / print / PDF.\n"
        "7. Scam Check: upload chat screenshots or audio recordings, paste a message/link text, or ask a question; verdict, risk score, red flags, safe reply, follow-up chat.\n"
        "8. Frame Check: periodic video-call frame checked for staged authority cues (uniform, fake warrant) - cues only, never a deepfake verdict.\n"
        "9. All-ages profiles: Senior (core), Adult, Young adult, Teen (beta) change tone and scam taxonomy; Hindi / English interface.\n"
        "10. Impact page: sourced statistics and an avoidable-loss calculator (12% conservative to 94% lab ceiling).\n"
        "11. Recorded Replay mode and evaluation harness (16 scripted calls: 10 scam, 6 genuine)."), 11)

    # ---- Page 6: process flow
    image(P(6), (22, 86, 698, 392), "flow.png")
    # ---- Page 7: wireframe / mock (live UI)
    image(P(7), (60, 86, 660, 392), "01-guard-stop.png")
    # ---- Page 8: architecture
    image(P(8), (22, 86, 698, 392), "arch.png")

    # ---- Page 9: technologies
    fit_text(doc, P(9), pymupdf.Rect(40, 100, 692, 390), (
        "Google AI / Cloud\n"
        "  - Gemini via Firebase AI Logic: gemini-3.8-flash (case agent with function calling, Scam Check multimodal + structured JSON, Frame Check vision),\n"
        "    gemini-3.5-flash-lite (8-second audio slices: transcription + scam signals), gemini-3.8-live (optional realtime streaming, beta), Gemini TTS (demo audio).\n"
        "  - Firebase Hosting (deployed prototype), Cloud Firestore (realtime guardian sessions), Firebase Anonymous Auth, Firebase App Check (reCAPTCHA Enterprise).\n"
        "  - Scale path on Google Cloud: Cloud Run + Agent Development Kit for server-side multi-agent case handling; Agent Platform memory; Gemma 4 on-device.\n\n"
        "Application\n"
        "  - React 19, Vite, TypeScript, Tailwind CSS; Web Audio API (AudioWorklet, 16 kHz PCM), getDisplayMedia for Meet tab audio and video frames.\n"
        "  - Python tools (google-genai): TTS rendering of demo calls, recorded-replay builder, evaluation harness, deck/submission builder.\n\n"
        "Safety & privacy\n"
        "  - Curated official-advisory library (I4C, RBI, Sanchar Saathi); quotes for every signal; guardian approval; no raw audio or video stored;\n"
        "    Firestore rules: only the session owner writes, a guardian can change only the hold status."), 11)

    # ---- Page 10: cost
    fit_text(doc, P(10), pymupdf.Rect(40, 100, 692, 390), (
        "Prototype: USD 0. Firebase Spark plan (Hosting, Firestore, Auth, App Check) + Gemini API free tier.\n\n"
        "Production estimate (assumptions, not a quote): one protected 10-minute call is about 75 audio slices of 8 s "
        "(~860 input tokens and ~150 output tokens each) = ~65k input + ~11k output tokens.\n"
        "  - At Gemini 3.8 Flash intro prices (USD 0.75 / 3.75 per 1M tokens) that is about USD 0.09 per 10-minute call; Flash-Lite is cheaper.\n"
        "  - Case agent + report: a few extra calls, about USD 0.01 per escalated call.\n"
        "  - Firestore / Hosting: well under USD 0.01 per call at this scale.\n\n"
        "So protecting 10,000 calls a month costs roughly USD 1,000 or less, against average per-victim losses that are orders of magnitude higher "
        "(e.g. INR 1,935 crore across 1.23 lakh digital-arrest complaints is about INR 1.6 lakh per complaint).\n\n"
        "Scale costs fall further with on-device Gemma 4 for first-line detection and server calls only for escalations."), 11.5)

    # ---- Page 11: snapshots
    p = P(11)
    image(p, (24, 84, 244, 220), "01-guard-stop.png")
    image(p, (250, 84, 470, 220), "03-scam-check.png")
    image(p, (476, 84, 696, 220), "05-impact.png")
    image(p, (24, 226, 244, 362), "02-case-report.png")
    image(p, (250, 226, 470, 362), "06-impact-calc.png")
    p.insert_text((24, 378), "Live prototype: Call Guard (STOP + case agent + guardian), Scam Check verdict, Impact page. " + APP_URL, fontsize=8.5, fontname="helv", color=INK)

    # ---- Page 12: performance / benchmarking
    rows = ev["rows"]
    lines = [f"  {r['id']:<26} {r['kind']:<8} {r['level']:<8} {('%ss' % r['first_warning_s']) if r['first_warning_s'] is not None else '-'}" for r in rows]
    summary = (
        f"Evaluation ({ev['model']}), 16 scripted calls run through the SAME classifier prompt the app ships:\n"
        f"  - Scam calls detected (warning or stop): {ev['detection_rate']:.0%} of {ev['scam_calls']}   |   False alarms on genuine calls: {ev['false_alarm_rate']:.0%} of {ev['genuine_calls']}\n"
        f"  - Median estimated time to first warning: {ev['median_seconds_to_first_warning']} s (estimated from word counts at ~2.4 words/s)\n"
        "Measured on the deployed prototype:\n"
        "  - English digital-arrest demo call (audio): STOP with correct quotes at ~24 s; guardian alert + complaint draft within seconds after that.\n"
        "  - Scam Check (text, low thinking level): result in ~9 s; deployed on Firebase Hosting with App Check.\n"
        "Caveat: scripted, small-scale and indicative - not a field trial."
    )
    fit_text(doc, P(12), pymupdf.Rect(40, 92, 692, 188), summary, 10)
    col1 = "Call                       Type     Peak     First warning\n" + "\n".join(lines[:8])
    col2 = "Call                       Type     Peak     First warning\n" + "\n".join(lines[8:])
    fit_text(doc, P(12), pymupdf.Rect(40, 196, 360, 392), col1, 8.5, font="cour")
    fit_text(doc, P(12), pymupdf.Rect(366, 196, 700, 392), col2, 8.5, font="cour")

    # ---- Page 13: future development
    fit_text(doc, P(13), pymupdf.Rect(40, 100, 692, 390), (
        "From one grandparent's phone call to every age group\n"
        "  - Teen Shield: sextortion, gaming-currency and giveaway scams; non-judgmental tone; risk-only alerts to a trusted adult (never the teen's private content).\n"
        "  - Young adults & merchants: job/task scams, fake sellers, loan apps, fake payment screenshots and UPI collect-request traps.\n"
        "  - Bank & telco integration: a real cool-off hold API with banks, call-risk metadata from telcos, auto-reporting to Sanchar Saathi / 1930.\n"
        "  - On-device Gemma 4 (E2B/E4B): private offline detection, Android call-screening app, WhatsApp bot, Meet / WhatsApp Web extension.\n"
        "  - Production backend on Google Cloud: Cloud Run + ADK multi-agent case handling, Agent Platform memory for per-family patterns, observability.\n"
        "  - More JAPAC languages via Gemini Live translation (Tamil, Bengali, Bahasa, Japanese, Korean ...).\n"
        "  - Gemini Live streaming for sub-second reactions once turn-detection can be tuned for continuous call audio.\n\n"
        "Honest limits today: demo calls and speakerphone/Meet audio only (phones block call-audio capture); free-tier Gemini data may be used by Google to improve products, "
        "so a production version needs paid-tier or Vertex AI data controls and consent flows; evaluation is scripted, not field-tested."), 11)

    # ---- Page 14: links
    p = P(14)
    p.insert_text((90, 150), "GitHub Public Repository:", fontsize=12, fontname="helv", color=INK)
    p.insert_link({"kind": pymupdf.LINK_URI, "from": pymupdf.Rect(90, 156, 520, 172), "uri": REPO_URL})
    p.insert_text((90, 168), REPO_URL, fontsize=12, fontname="helv", color=(0.1, 0.3, 0.8))
    p.insert_text((90, 200), "Demo Video Link:", fontsize=12, fontname="helv", color=INK)
    p.insert_text((90, 218), a.video_url, fontsize=12, fontname="helv", color=(0.1, 0.3, 0.8))
    p.insert_text((90, 250), "Final Product Link:", fontsize=12, fontname="helv", color=INK)
    p.insert_link({"kind": pymupdf.LINK_URI, "from": pymupdf.Rect(90, 256, 520, 272), "uri": APP_URL})
    p.insert_text((90, 268), APP_URL, fontsize=12, fontname="helv", color=(0.1, 0.3, 0.8))

    # drop the template instruction slide (2) and the empty spare slide (15); keep order of the rest
    doc.delete_pages([14, 1])  # 0-based: page 15 and page 2
    doc.save(a.out, garbage=4, deflate=True)
    size = Path(a.out).stat().st_size / 1024 / 1024
    print(f"wrote {a.out} ({size:.2f} MB, {len(doc)} pages)")


if __name__ == "__main__":
    main()
