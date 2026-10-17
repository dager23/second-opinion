# Setup and submission checklist (do in this order)

## A. Firebase (free Spark plan, no billing needed)
1. https://console.firebase.google.com → open your project (the one in `D:\aibuildercup\.env` → `Project_ID`) or **Add project → pick the existing Google Cloud project**. Stay on **Spark**.
2. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable.**
3. **Build → Firestore Database → Create database** (production mode, region `asia-south1` or nearest).
4. **Build → AI Logic → Get started → choose "Gemini Developer API"** (enable the API when asked; it can create an API key restricted to this project).
5. **Project settings → Your apps → Web (</>) → register app "second-opinion"** → copy the `firebaseConfig` values into `web/.env.local` (copy from `web/.env.local.example`).
6. **App Check → Apps → your web app → reCAPTCHA v3**: register a site at https://www.google.com/recaptcha/admin (v3, add domains `localhost` and `<project>.web.app`), paste the secret key in Firebase, and put the *site key* in `VITE_RECAPTCHA_SITE_KEY`. (Leave enforcement OFF until the final test; Firebase AI Logic enforces App Check from 2 Nov.)
7. For local dev with App Check on: run the app once, copy the debug token from the browser console, add it under App Check → Manage debug tokens.

## B. Deploy
```bash
firebase login
cd D:\aibuildercup\second-opinion
firebase use <project-id>
cd web && npm run build && cd ..
firebase deploy --only firestore:rules,hosting
```
Live URL: `https://<project-id>.web.app`

## C. Test (10 min)
1. Open the live URL in Chrome. Pick **Digital arrest (English)** → **Play live**. Expect Warning/STOP within ~25 s, whisper audio, case-agent steps, guardian pairing code.
2. Open the guardian link on your phone. Approve the hold.
3. Open **Genuine bank callback** → stays Calm.
4. Join a Google Meet from a second device, **Listen to a Google Meet tab**, tick *Also share tab audio*.
5. **Scam Check**: try the 4 sample buttons, then upload a real screenshot and an audio file.
6. If Live fails (error banner), the app falls back to chunked mode by itself; **Replay** works without any model calls.
7. Turn App Check **enforcement ON** for AI Logic + Firestore and re-test in an incognito window.

## D. Submission package
- [ ] Live URL works logged out, in incognito, on a phone
- [ ] Public GitHub repo: `git remote add origin ... && git push -u origin main` (check `git ls-files | grep env` shows nothing)
- [ ] Deck PDF: `python tools/build_deck.py --app-url <url> --repo-url <repo> --team "<names>"` → `docs/deck/Second-Opinion-Deck.pdf`
- [ ] Demo video under 3:00 (see `docs/video-script.md`), public on YouTube/Vimeo/Drive
- [ ] Category: Social Good (theme: Sustainability & Social Impact)
- [ ] Submit on the Hack2skill dashboard before the deadline (18 Oct, timezone not stated: submit early)
