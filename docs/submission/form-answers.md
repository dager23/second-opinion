# Hack2skill form: paste-ready answers

**Challenge:** Sustainability & Social Impact

**Prototype link:** https://gen-lang-client-0095149296.web.app

**GitHub:** https://github.com/dager23/second-opinion

**Pitch deck PDF (filled official template, 1.5 MB):** `docs/submission/Victoris-Second-Opinion-Submission.pdf`

**Demo video (3-4 min):** add after upload (public YouTube / Drive link)

## Brief description (paste this)

Second Opinion is a live scam guardian for seniors that also extends to every age group. It listens alongside someone on a suspicious call (speakerphone or a shared Google Meet tab), recognises the coercion pattern behind scams like the fake-police "digital arrest", and warns them in English or Hindi before money moves. A family guardian is alerted on their own phone and can approve a cool-off hold, and the app drafts a ready-to-file complaint for India's 1930 / cybercrime.gov.in. A second tool, Scam Check, lets anyone upload a chat screenshot or audio recording, paste a message, or ask "is this a scam?" and get a verdict with quoted red flags and next steps. Teen and young-adult profiles reuse the same engine (sextortion, task/job scams).

How we use Google services:
- Gemini through Firebase AI Logic: gemini-3.8-flash runs the case agent (function calling: official advisory, guardian alert, cool-off hold, complaint draft), Scam Check (multimodal image/audio input with structured JSON) and Frame Check (video-call frame cues); gemini-3.5-flash-lite transcribes and classifies 8-second call-audio slices; gemini-3.8-live is an optional streaming mode; Gemini TTS renders the demo calls.
- Firebase: Hosting serves the deployed prototype; Anonymous Auth gives a login-free session; App Check (reCAPTCHA Enterprise) protects Gemini and Firestore.
- Cloud Firestore: realtime guardian sessions (risk level, signals with quotes, hold status, report). No raw audio or video is stored; security rules let only the session owner write and a guardian change only the hold status.
- Cloud Run: not used in this prototype, which is fully serverless on Firebase. Cloud Run + Agent Development Kit is our planned scale path for server-side multi-agent case handling and bank/telco integrations.

Evidence: 16 scripted calls (10 scam, 6 genuine) through the shipped classifier prompt gave 100% scam detection and 0% false alarms (scripted, indicative only).
