"""Fill docs/deck/deck.template.html with evaluation numbers and export a PDF with headless Chrome.

Usage: python tools/build_deck.py --app-url https://<project>.web.app --repo-url https://github.com/<you>/second-opinion --team "A, B, C"
"""
import argparse
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--app-url", default="(add live URL)")
    ap.add_argument("--repo-url", default="(add GitHub URL)")
    ap.add_argument("--team", default="(add team names)")
    a = ap.parse_args()
    tpl = (ROOT / "docs" / "deck" / "deck.template.html").read_text(encoding="utf8")
    ev_path = ROOT / "web" / "public" / "eval-results.json"
    ev = json.loads(ev_path.read_text(encoding="utf8")) if ev_path.exists() else None
    vals = {
        "APP_URL": a.app_url,
        "REPO_URL": a.repo_url,
        "TEAM": a.team,
        "DET": f"{ev['detection_rate']:.0%}" if ev else "n/a",
        "FA": f"{ev['false_alarm_rate']:.0%}" if ev else "n/a",
        "MED": f"{ev['median_seconds_to_first_warning']}s" if ev and ev["median_seconds_to_first_warning"] is not None else "n/a",
        "N_SCAM": str(ev["scam_calls"]) if ev else "10",
        "N_GEN": str(ev["genuine_calls"]) if ev else "6",
        "MODEL": ev["model"] if ev else "gemini-3.5-flash-lite",
    }
    for k, v in vals.items():
        tpl = tpl.replace("{{" + k + "}}", v)
    html = ROOT / "docs" / "deck" / "deck.html"
    html.write_text(tpl, encoding="utf8")
    pdf = ROOT / "docs" / "deck" / "Second-Opinion-Deck.pdf"
    subprocess.run(
        [CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", f"--print-to-pdf={pdf}", html.as_uri()],
        check=True,
        timeout=120,
    )
    print("wrote", pdf)


if __name__ == "__main__":
    main()
