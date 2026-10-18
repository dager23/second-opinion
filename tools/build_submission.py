"""Fill the official AI Builder Cup submission template (PDF) with our content.

All slide text lives in CONTENT below (one source of truth). It is rendered into the template with real HTML layout
(headings, hanging-indent lists, tables, auto-fit) and also exported as an editable Markdown file, so the team can
paste it into the Google Slides version of the template instead if they prefer.

Usage:
  python tools/build_submission.py --template "D:/aibuildercup/Submission Template _ AI Builder Cup.pdf" \
      --video-url https://youtu.be/xxxx
Writes docs/submission/Victoris-Second-Opinion-Submission.pdf (<5 MB) and docs/submission/deck-content.md.
"""
import argparse
import html
import json
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "docs" / "submission" / "assets"
FONTS = Path("C:/Windows/Fonts")
APP_URL = "https://gen-lang-client-0095149296.web.app"
REPO_URL = "https://github.com/dager23/second-opinion"

TEAM = {"name": "Victoris", "leader": "Yash Shah", "members": "Pratyaksh, Krishna"}
PROBLEM = "Sustainability & Social Impact: Second Opinion, a live scam guardian that warns seniors (and every age group) before money moves."

# Body area below the slide title, above the bottom bar (template is 720 x 405 pt)
BODY = pymupdf.Rect(40, 90, 690, 392)

CSS = """
@font-face { font-family: sg; src: url(segoeui.ttf); }
@font-face { font-family: sg; src: url(seguisb.ttf); font-weight: bold; }
* { font-family: sg; color: #111111; }
body { font-size: 12pt; line-height: 1.32; }
h4 { font-size: 12.5pt; font-weight: bold; margin: 7pt 0 2pt 0; color: #0b3a8c; }
h4.first { margin-top: 0; }
p { margin: 0 0 5pt 0; }
ul, ol { margin: 0 0 4pt 0; padding-left: 16pt; }
li { margin: 0 0 2.5pt 0; }
b { font-weight: bold; }
.small { font-size: 9.5pt; color: #444444; }
table { border-collapse: collapse; width: 100%; }
td, th { font-size: 9.5pt; padding: 1.2pt 5pt; border-bottom: 0.5pt solid #dddddd; text-align: left; }
th { font-weight: bold; }
"""


def blocks_to_html(blocks):
    out, first = [], True
    for kind, val in blocks:
        if kind == "h":
            out.append(f'<h4 class="{"first" if first else ""}">{html.escape(val)}</h4>')
        elif kind == "p":
            out.append(f"<p>{val}</p>")  # may contain <b>
        elif kind == "ul":
            out.append("<ul>" + "".join(f"<li>{v}</li>" for v in val) + "</ul>")
        elif kind == "ol":
            out.append("<ol>" + "".join(f"<li>{v}</li>" for v in val) + "</ol>")
        elif kind == "html":
            out.append(val)
        first = False
    return "".join(out)


def blocks_to_md(blocks):
    strip = lambda s: s.replace("<b>", "**").replace("</b>", "**")
    out = []
    for kind, val in blocks:
        if kind == "h":
            out.append(f"\n**{val}**")
        elif kind == "p":
            out.append(strip(val))
        elif kind == "ul":
            out += [f"- {strip(v)}" for v in val]
        elif kind == "ol":
            out += [f"{i}. {strip(v)}" for i, v in enumerate(val, 1)]
    return "\n".join(out).strip()


def content(ev, video_url):
    rows = "".join(
        f"<tr><td>{r['id']}</td><td>{r['kind']}</td><td>{r['level']}</td><td>{'%ss' % r['first_warning_s'] if r['first_warning_s'] is not None else '-'}</td></tr>"
        for r in ev["rows"]
    )
    half = len(ev["rows"]) // 2
    head = "<tr><th>Call</th><th>Type</th><th>Peak</th><th>1st warning</th></tr>"
    rows_l = "".join(rows.split("</tr>")[i] + "</tr>" for i in range(half))
    rows_r = "".join(rows.split("</tr>")[i] + "</tr>" for i in range(half, len(ev["rows"])))
    eval_table = (
        '<table><tr><td style="border:0;padding:0;vertical-align:top;width:50%">'
        f"<table>{head}{rows_l}</table></td>"
        '<td style="border:0;padding:0 0 0 10pt;vertical-align:top">'
        f"<table>{head}{rows_r}</table></td></tr></table>"
    )
    return {
        3: ("Brief about the idea", [
            ("p", "<b>Second Opinion is a live scam guardian for the people we love.</b> It listens alongside someone on a suspicious call "
                  "(speakerphone or a shared Google Meet tab), recognises the coercion pattern behind scams such as the fake-police "
                  "'digital arrest', and warns them calmly in English or Hindi <b>before any money moves</b>."),
            ("p", "It then alerts a family guardian on their own phone, requests a cool-off hold the moment money or an OTP is demanded, and "
                  "writes a ready-to-file complaint for India's 1930 / cybercrime.gov.in. The same engine checks screenshots, voice notes, "
                  "pasted messages or a plain question ('is this a scam?'), and extends from seniors to teens and young adults."),
            ("h", "Why it matters: scams persuade, they don't hack"),
            ("ul", [
                "Most losses are payments the victim authorises under pressure on a call, which transaction monitoring cannot see.",
                "Japan 2025: JPY 142.3B lost to special fraud (+98%); people 65+ bore 59.2% of losses.",
                "India 2024: INR 1,935 crore lost to 'digital arrest' scams across 1.23 lakh complaints.",
                "Australia 2025: people 65+ are 17.1% of the population but 26.5% of reported losses.",
            ]),
            ("p", "<b>Theme:</b> Sustainability &amp; Social Impact &nbsp;|&nbsp; <b>Category:</b> Social Good"),
        ]),
        4: ("Opportunities", [
            ("h", "How different is it from any of the other existing ideas?"),
            ("ul", [
                "Existing tools check transactions after the fact, filter spam numbers, or analyse one uploaded message. Second Opinion works "
                "<b>during the call</b> and reasons about the coercion pattern (authority + urgency + secrecy + payment request), not keywords, "
                "in English, Hindi and Hinglish.",
                "It <b>acts</b>: instant guardian alert, guardian-approved cool-off hold, full-call complaint draft, and it shows the exact quote behind every alert.",
            ]),
            ("h", "How will it be able to solve the problem?"),
            ("ul", [
                "It interrupts the scam at the one moment it can still be stopped: on the call, before the victim authorises the transfer.",
                "A family member is pulled in within seconds, breaking the isolation scammers rely on; reporting is instant, feeding India's 1930 "
                "rapid-reporting system (which had helped save ~INR 8,189 crore by Dec 2025).",
            ]),
            ("h", "USP of the proposed solution"),
            ("ul", [
                "Live, multilingual and explainable (quotes + official advisories); human-in-the-loop (the guardian approves); privacy-first (no audio stored).",
                "Safety actions never wait for an LLM, and <b>one engine serves every age group</b>: seniors today, teens (sextortion) and young adults (job / task scams) next.",
            ]),
        ]),
        5: ("List of features offered by the solution", [
            ("ol", [
                "<b>Call Guard:</b> listens to speakerphone, a Google Meet tab or a demo call; live transcript; risk meter Calm / Caution / Warning / STOP.",
                "<b>Signal timeline:</b> every scam signal with the exact quote and time (authority claim, urgency, secrecy, payment / OTP request, threat ...).",
                "<b>Whisper warning</b> in English or Hindi and a one-tap 'Hang up &amp; call 1930' button; large, calm, senior-friendly UI.",
                "<b>Deterministic safety actions:</b> instant guardian alert at Warning; cool-off hold as soon as money or an OTP is asked.",
                "<b>Case agent</b> (Gemini function calling): official advisory, plain-language guardian summary, early complaint draft.",
                "<b>Family guardian console</b> on a second phone (QR / pairing code): realtime alerts, approve or decline the hold.",
                "<b>Final complaint draft</b> for 1930 / cybercrime.gov.in written from the full call: category, timeline, quotes, amount; copy / print.",
                "<b>Scam Check:</b> chat screenshots, voice notes / call recordings, pasted text or a question; verdict, risk score, red flags, safe reply, follow-up chat.",
                "<b>Frame Check:</b> video-call frames checked for staged-authority cues (uniform, fake warrant); cues only, never a deepfake verdict.",
                "<b>All-ages profiles:</b> Senior (core), Adult, Young adult, Teen (beta) change tone and scam taxonomy; Hindi / English.",
                "<b>Impact page:</b> sourced statistics and an avoidable-loss calculator; <b>Recorded replay</b> mode and a 16-call evaluation harness.",
            ]),
        ]),
        9: ("Technologies to be used in the solution", [
            ("h", "Google AI and Google Cloud"),
            ("ul", [
                "<b>Gemini via Firebase AI Logic:</b> gemini-3.8-flash (case agent with function calling, final report, Scam Check multimodal + structured JSON, "
                "Frame Check vision); gemini-3.5-flash-lite (8-second call-audio slices: transcript + scam signals); gemini-3.8-live (optional realtime "
                "streaming, beta); Gemini TTS (demo calls). Automatic fallback to gemini-3.6-flash / 3.5-flash on rate limits or timeouts.",
                "<b>Firebase:</b> Hosting (deployed prototype), Cloud Firestore (realtime guardian sessions), Anonymous Auth, App Check (reCAPTCHA Enterprise).",
                "<b>Scale path:</b> Cloud Run + Agent Development Kit for server-side multi-agent case handling; Agent Platform memory; Gemma 4 on-device.",
            ]),
            ("h", "Application"),
            ("ul", [
                "React 19, Vite, TypeScript, Tailwind CSS; Web Audio API (AudioWorklet, 16 kHz PCM); getDisplayMedia for Meet tab audio and video frames.",
                "Python tools (google-genai): demo-call TTS, recorded-replay builder, evaluation harness, submission builder.",
            ]),
            ("h", "Safety and privacy"),
            ("ul", [
                "Curated official-advisory library (I4C, RBI, Sanchar Saathi) with links; exact quotes for every signal; guardian approval; no raw audio or video stored.",
                "Firestore rules: only the session owner writes; a guardian can only approve or decline a pending hold.",
            ]),
        ]),
        10: ("Estimated implementation cost (optional)", [
            ("p", "<b>Prototype: USD 0.</b> Firebase Spark plan (Hosting, Firestore, Auth, App Check) and the Gemini API free tier."),
            ("h", "Production estimate (assumptions, not a quote)"),
            ("ul", [
                "One protected 10-minute call is ~75 audio slices of 8 s (~860 input and ~150 output tokens each), i.e. ~65k input + ~11k output tokens.",
                "At Gemini 3.8 Flash intro prices (USD 0.75 / 3.75 per 1M tokens) that is ~USD 0.09 per 10-minute call; Flash-Lite is cheaper.",
                "Case agent + final report: a few extra calls, ~USD 0.01 per escalated call. Firestore / Hosting: well under USD 0.01 per call.",
            ]),
            ("p", "Protecting 10,000 calls a month costs roughly USD 1,000 or less, against an average loss of ~INR 1.6 lakh per digital-arrest complaint "
                  "(INR 1,935 crore / 1.23 lakh complaints)."),
            ("p", "Costs fall further with on-device Gemma 4 for first-line detection and server calls only for escalations."),
        ]),
        12: ("Prototype Performance report/Benchmarking", [
            ("p", f"<b>Evaluation ({ev['model']}):</b> 16 scripted calls (English, Hindi, Hinglish, Japanese) through the same classifier prompt the app ships. "
                  f"Scam calls detected: <b>{ev['detection_rate']:.0%} of {ev['scam_calls']}</b>. False alarms on genuine calls: <b>{ev['false_alarm_rate']:.0%} of {ev['genuine_calls']}</b>. "
                  f"Median time to first warning: <b>~{ev['median_seconds_to_first_warning']:.0f} s</b> (estimated from speaking rate)."),
            ("p", "<b>Measured end-to-end on the live site</b> (62 s English digital-arrest call): STOP at ~24 s with exact quotes; guardian alerted instantly; "
                  "cool-off hold requested the moment the transfer was demanded; final complaint draft ~15 s after the call ended. "
                  "Scam Check: text ~9 s, a 28 s call recording ~40 s."),
            ("html", eval_table),
            ("p", '<span class="small">Scripted, small-scale and indicative, not a field trial. Full table: eval/results.md in the repository.</span>'),
        ]),
        13: ("Additional Details/Future Development (if any)", [
            ("h", "From one grandparent's phone call to every age group"),
            ("ul", [
                "<b>Teen Shield:</b> sextortion, gaming-currency and giveaway scams; non-judgmental tone; risk-only alerts to a trusted adult.",
                "<b>Young adults and merchants:</b> job / task scams, fake sellers, loan apps, fake payment screenshots, UPI collect-request traps.",
                "<b>Bank and telco integration:</b> a real cool-off hold API, call-risk metadata, auto-reporting to Sanchar Saathi / 1930.",
                "<b>On-device Gemma 4:</b> private offline detection, Android call screening, WhatsApp bot, Meet / WhatsApp Web extension.",
                "<b>Production backend:</b> Cloud Run + ADK multi-agent case handling, Agent Platform memory, observability.",
                "<b>More JAPAC languages</b> via Gemini Live translation; Live streaming for sub-second reactions on continuous call audio.",
            ]),
            ("h", "Honest limits today"),
            ("ul", [
                "Demo calls and speakerphone / Meet audio only.",
                "Free-tier Gemini data may be used to improve Google products: production needs paid-tier or Vertex AI data controls and consent flows.",
                "Evaluation has been tested on live calls, call recordings and Google Meet so far.",
            ]),
        ]),
    }


def font_args(bold=False):
    return {"fontname": "sgb" if bold else "sg", "fontfile": str(FONTS / ("seguisb.ttf" if bold else "segoeui.ttf"))}


def image(page, rect, name):
    page.insert_image(pymupdf.Rect(rect), filename=str(ASSETS / name), keep_proportion=True)


def put_html(page, rect, body_html, arch):
    spare, scale = page.insert_htmlbox(pymupdf.Rect(rect), body_html, css=CSS, archive=arch, scale_low=0)
    if spare < 0:
        raise RuntimeError(f"content does not fit on page {page.number + 1}")
    return scale


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--template", required=True)
    ap.add_argument("--video-url", default="(add demo video link)")
    ap.add_argument("--out", default=str(ROOT / "docs" / "submission" / "Victoris-Second-Opinion-Submission.pdf"))
    a = ap.parse_args()

    ev = json.loads((ROOT / "web" / "public" / "eval-results.json").read_text(encoding="utf8"))
    doc = pymupdf.open(a.template)
    arch = pymupdf.Archive(str(FONTS))
    P = lambda n: doc[n - 1]  # 1-based template page numbers
    C = content(ev, a.video_url)

    # ---- Page 1: team details (values set in the same size as the template labels)
    p = P(1)
    p.insert_text((200, 300), TEAM["name"], fontsize=17, **font_args(bold=True))
    p.insert_text((254, 321.5), f"{TEAM['leader']}  (team: {TEAM['members']})", fontsize=17, **font_args())
    put_html(p, (263, 330.5, 700, 398), f'<p style="font-size:13pt;line-height:1.25">{html.escape(PROBLEM)}</p>', arch)

    # ---- Text slides
    for n, (_, blocks) in C.items():
        page = P(n)
        rect = BODY
        if n == 4:
            # the template's three question bullets become our section headings: blank them out to avoid double text
            page.draw_rect(pymupdf.Rect(30, 94, 700, 148), color=None, fill=(1, 1, 1), overlay=True)
            rect = pymupdf.Rect(40, 94, 690, 392)
        put_html(page, rect, blocks_to_html(blocks), arch)

    # ---- Diagrams and UI
    image(P(6), (22, 86, 698, 392), "flow.png")
    image(P(7), (60, 86, 660, 392), "01-guard-stop.png")
    image(P(8), (22, 86, 698, 392), "arch.png")

    # ---- Page 11: snapshots (2 x 3 grid)
    p = P(11)
    image(p, (24, 84, 244, 220), "01-guard-stop.png")
    image(p, (250, 84, 470, 220), "03-scam-check.png")
    image(p, (476, 84, 696, 220), "05-impact.png")
    image(p, (24, 226, 244, 362), "02-case-report.png")
    image(p, (250, 226, 470, 362), "06-impact-calc.png")
    if (ASSETS / "07-guardian.png").exists():
        image(p, (476, 226, 696, 362), "07-guardian.png")
    put_html(p, (24, 366, 700, 392),
             f'<p class="small">Call Guard at STOP · final complaint draft · Scam Check verdict · Impact page · guardian phone view &nbsp;|&nbsp; {APP_URL}</p>', arch)

    # ---- Page 14: links placed on the same line as the template's own labels
    p = P(14)
    links = [(111, REPO_URL), (128, a.video_url), (145, APP_URL)]
    link_font = pymupdf.Font(fontfile=str(FONTS / "segoeui.ttf"))
    for y, url in links:
        # long links (e.g. Google Drive) shrink to fit the line instead of running off the slide
        size = min(13.0, (700 - 262) / max(1.0, link_font.text_length(url, fontsize=1)))
        p.insert_text((262, y), url, fontsize=size, color=(0.05, 0.25, 0.75), **font_args())
        if url.startswith("http"):
            p.insert_link({"kind": pymupdf.LINK_URI, "from": pymupdf.Rect(262, y - 13, 700, y + 3), "uri": url})

    doc.delete_pages([14, 1])  # 0-based: drop the template's instruction slide (2) and the empty spare slide (15)
    doc.save(a.out, garbage=4, deflate=True)
    size = Path(a.out).stat().st_size / 1024 / 1024
    print(f"wrote {a.out} ({size:.2f} MB, {len(doc)} pages)")

    # ---- Editable copy of all slide text
    md = ["# Second Opinion: slide content (team Victoris)", "",
          "Editable copy of every slide's text, in template order. Paste into the Google Slides template if you prefer editing there.", "",
          "## Slide 1: Team details",
          f"- Team name: {TEAM['name']}", f"- Team leader name: {TEAM['leader']} (team: {TEAM['members']})", f"- Problem statement: {PROBLEM}"]
    for n, (title, blocks) in C.items():
        md += ["", f"## {title}", blocks_to_md([b for b in blocks if b[0] != 'html'])]
        if n == 12:
            md += ["", "| Call | Type | Peak | 1st warning |", "|---|---|---|---|"]
            md += [f"| {r['id']} | {r['kind']} | {r['level']} | {('%ss' % r['first_warning_s']) if r['first_warning_s'] is not None else '-'} |" for r in ev["rows"]]
    md += ["", "## Images", "- Process flow: docs/submission/assets/flow.png", "- Wireframe / UI: docs/submission/assets/01-guard-stop.png",
           "- Architecture: docs/submission/assets/arch.png", "- Snapshots: docs/submission/assets/*.png",
           "", "## Provide links to your:", f"- GitHub Public Repository: {REPO_URL}", f"- Demo Video Link: {a.video_url}", f"- Final Product Link: {APP_URL}"]
    (ROOT / "docs" / "submission" / "deck-content.md").write_text("\n".join(md) + "\n", encoding="utf8")
    print("wrote docs/submission/deck-content.md")


if __name__ == "__main__":
    main()
