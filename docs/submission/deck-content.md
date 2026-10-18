# Second Opinion: slide content (team Victoris)

Editable copy of every slide's text, in template order. Paste into the Google Slides template if you prefer editing there.

## Slide 1: Team details
- Team name: Victoris
- Team leader name: Yash Shah (team: Pratyaksh, Krishna)
- Problem statement: Sustainability & Social Impact: Second Opinion, a live scam guardian that warns seniors (and every age group) before money moves.

## Brief about the idea
**Second Opinion is a live scam guardian for the people we love.** It listens alongside someone on a suspicious call (speakerphone or a shared Google Meet tab), recognises the coercion pattern behind scams such as the fake-police 'digital arrest', and warns them calmly in English or Hindi **before any money moves**.
It then alerts a family guardian on their own phone, requests a cool-off hold the moment money or an OTP is demanded, and writes a ready-to-file complaint for India's 1930 / cybercrime.gov.in. The same engine checks screenshots, voice notes, pasted messages or a plain question ('is this a scam?'), and extends from seniors to teens and young adults.

**Why it matters: scams persuade, they don't hack**
- Most losses are payments the victim authorises under pressure on a call, which transaction monitoring cannot see.
- Japan 2025: JPY 142.3B lost to special fraud (+98%); people 65+ bore 59.2% of losses.
- India 2024: INR 1,935 crore lost to 'digital arrest' scams across 1.23 lakh complaints.
- Australia 2025: people 65+ are 17.1% of the population but 26.5% of reported losses.
**Theme:** Sustainability &amp; Social Impact &nbsp;|&nbsp; **Category:** Social Good

## Opportunities
**How different is it from any of the other existing ideas?**
- Existing tools check transactions after the fact, filter spam numbers, or analyse one uploaded message. Second Opinion works **during the call** and reasons about the coercion pattern (authority + urgency + secrecy + payment request), not keywords, in English, Hindi and Hinglish.
- It **acts**: instant guardian alert, guardian-approved cool-off hold, full-call complaint draft, and it shows the exact quote behind every alert.

**How will it be able to solve the problem?**
- It interrupts the scam at the one moment it can still be stopped: on the call, before the victim authorises the transfer.
- A family member is pulled in within seconds, breaking the isolation scammers rely on; reporting is instant, feeding India's 1930 rapid-reporting system (which had helped save ~INR 8,189 crore by Dec 2025).

**USP of the proposed solution**
- Live, multilingual and explainable (quotes + official advisories); human-in-the-loop (the guardian approves); privacy-first (no audio stored).
- Safety actions never wait for an LLM, and **one engine serves every age group**: seniors today, teens (sextortion) and young adults (job / task scams) next.

## List of features offered by the solution
1. **Call Guard:** listens to speakerphone, a Google Meet tab or a demo call; live transcript; risk meter Calm / Caution / Warning / STOP.
2. **Signal timeline:** every scam signal with the exact quote and time (authority claim, urgency, secrecy, payment / OTP request, threat ...).
3. **Whisper warning** in English or Hindi and a one-tap 'Hang up &amp; call 1930' button; large, calm, senior-friendly UI.
4. **Deterministic safety actions:** instant guardian alert at Warning; cool-off hold as soon as money or an OTP is asked.
5. **Case agent** (Gemini function calling): official advisory, plain-language guardian summary, early complaint draft.
6. **Family guardian console** on a second phone (QR / pairing code): realtime alerts, approve or decline the hold.
7. **Final complaint draft** for 1930 / cybercrime.gov.in written from the full call: category, timeline, quotes, amount; copy / print.
8. **Scam Check:** chat screenshots, voice notes / call recordings, pasted text or a question; verdict, risk score, red flags, safe reply, follow-up chat.
9. **Frame Check:** video-call frames checked for staged-authority cues (uniform, fake warrant); cues only, never a deepfake verdict.
10. **All-ages profiles:** Senior (core), Adult, Young adult, Teen (beta) change tone and scam taxonomy; Hindi / English.
11. **Impact page:** sourced statistics and an avoidable-loss calculator; **Recorded replay** mode and a 16-call evaluation harness.

## Technologies to be used in the solution
**Google AI and Google Cloud**
- **Gemini via Firebase AI Logic:** gemini-3.8-flash (case agent with function calling, final report, Scam Check multimodal + structured JSON, Frame Check vision); gemini-3.5-flash-lite (8-second call-audio slices: transcript + scam signals); gemini-3.8-live (optional realtime streaming, beta); Gemini TTS (demo calls). Automatic fallback to gemini-3.6-flash / 3.5-flash on rate limits or timeouts.
- **Firebase:** Hosting (deployed prototype), Cloud Firestore (realtime guardian sessions), Anonymous Auth, App Check (reCAPTCHA Enterprise).
- **Scale path:** Cloud Run + Agent Development Kit for server-side multi-agent case handling; Agent Platform memory; Gemma 4 on-device.

**Application**
- React 19, Vite, TypeScript, Tailwind CSS; Web Audio API (AudioWorklet, 16 kHz PCM); getDisplayMedia for Meet tab audio and video frames.
- Python tools (google-genai): demo-call TTS, recorded-replay builder, evaluation harness, submission builder.

**Safety and privacy**
- Curated official-advisory library (I4C, RBI, Sanchar Saathi) with links; exact quotes for every signal; guardian approval; no raw audio or video stored.
- Firestore rules: only the session owner writes; a guardian can only approve or decline a pending hold.

## Estimated implementation cost (optional)
**Prototype: USD 0.** Firebase Spark plan (Hosting, Firestore, Auth, App Check) and the Gemini API free tier.

**Production estimate (assumptions, not a quote)**
- One protected 10-minute call is ~75 audio slices of 8 s (~860 input and ~150 output tokens each), i.e. ~65k input + ~11k output tokens.
- At Gemini 3.8 Flash intro prices (USD 0.75 / 3.75 per 1M tokens) that is ~USD 0.09 per 10-minute call; Flash-Lite is cheaper.
- Case agent + final report: a few extra calls, ~USD 0.01 per escalated call. Firestore / Hosting: well under USD 0.01 per call.
Protecting 10,000 calls a month costs roughly USD 1,000 or less, against an average loss of ~INR 1.6 lakh per digital-arrest complaint (INR 1,935 crore / 1.23 lakh complaints).
Costs fall further with on-device Gemma 4 for first-line detection and server calls only for escalations.

## Prototype Performance report/Benchmarking
**Evaluation (gemini-3.5-flash-lite):** 16 scripted calls (English, Hindi, Hinglish, Japanese) through the same classifier prompt the app ships. Scam calls detected: **100% of 10**. False alarms on genuine calls: **0% of 6**. Median time to first warning: **~10 s** (estimated from speaking rate).
**Measured end-to-end on the live site** (62 s English digital-arrest call): STOP at ~24 s with exact quotes; guardian alerted instantly; cool-off hold requested the moment the transfer was demanded; final complaint draft ~15 s after the call ended. Scam Check: text ~9 s, a 28 s call recording ~40 s.
<span class="small">Scripted, small-scale and indicative, not a field trial. Full table: eval/results.md in the repository.</span>

| Call | Type | Peak | 1st warning |
|---|---|---|---|
| digital-arrest-en | scam | stop | 24s |
| digital-arrest-hi | scam | stop | 20s |
| digital-arrest-hinglish | scam | stop | 10s |
| bank-kyc-otp | scam | stop | 10s |
| relative-in-trouble | scam | stop | 8s |
| tax-refund | scam | stop | 22s |
| investment-guaranteed | scam | stop | 24s |
| courier-customs | scam | stop | 8s |
| jp-fake-police | scam | stop | 6s |
| jp-oreore | scam | stop | 5s |
| genuine-bank-callback | genuine | calm | - |
| genuine-doctor | genuine | calm | - |
| genuine-grandson | genuine | calm | - |
| genuine-delivery | genuine | calm | - |
| genuine-insurance-renewal | genuine | calm | - |
| genuine-electricity | genuine | calm | - |

## Additional Details/Future Development (if any)
**From one grandparent's phone call to every age group**
- **Teen Shield:** sextortion, gaming-currency and giveaway scams; non-judgmental tone; risk-only alerts to a trusted adult.
- **Young adults and merchants:** job / task scams, fake sellers, loan apps, fake payment screenshots, UPI collect-request traps.
- **Bank and telco integration:** a real cool-off hold API, call-risk metadata, auto-reporting to Sanchar Saathi / 1930.
- **On-device Gemma 4:** private offline detection, Android call screening, WhatsApp bot, Meet / WhatsApp Web extension.
- **Production backend:** Cloud Run + ADK multi-agent case handling, Agent Platform memory, observability.
- **More JAPAC languages** via Gemini Live translation; Live streaming for sub-second reactions on continuous call audio.

**Honest limits today**
- Demo calls and speakerphone / Meet audio only (phones block third-party call-audio capture).
- Free-tier Gemini data may be used to improve Google products: production needs paid-tier or Vertex AI data controls and consent flows.
- Evaluation is scripted, not field-tested.

## Images
- Process flow: docs/submission/assets/flow.png
- Wireframe / UI: docs/submission/assets/01-guard-stop.png
- Architecture: docs/submission/assets/arch.png
- Snapshots: docs/submission/assets/*.png

## Provide links to your:
- GitHub Public Repository: https://github.com/dager23/second-opinion
- Demo Video Link: https://drive.google.com/file/d/1D-IQgBF9WVEWGHinmJoNLaRQkHzXMmcA/view?usp=sharing
- Final Product Link: https://gen-lang-client-0095149296.web.app
