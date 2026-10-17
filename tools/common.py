"""Shared helpers for the local tools. The API key is read from D:\\aibuildercup\\.env (outside the repo)."""
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
SHARED = ROOT / "shared"
ENV_PATH = ROOT.parent / ".env"


def load_key() -> str:
    load_dotenv(ENV_PATH)
    key = os.getenv("Gemini_key") or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not key:
        sys.exit(f"No Gemini_key found in {ENV_PATH}")
    return key


def shared(name: str):
    return json.loads((SHARED / name).read_text(encoding="utf8"))


def calls():
    return json.loads((ROOT / "eval" / "scripts" / "calls.json").read_text(encoding="utf8"))


MODEL_FLASH = os.getenv("MODEL_FLASH", "gemini-3.8-flash")
MODEL_LITE = os.getenv("MODEL_LITE", "gemini-3.5-flash-lite")
MODEL_TTS = os.getenv("MODEL_TTS", "gemini-3.8-flash-tts")
