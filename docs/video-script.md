# Demo video script: screen recording only (target ~3:20; rules: 3–4 minutes)

No Meet call or second phone needed. Record the live site in Chrome (https://gen-lang-client-0095149296.web.app) with your own voice-over.

**Before recording**
- Chrome window maximised, zoom 100%, notifications muted, system sound ON (the demo call and the whisper are audible).
- Open two tabs: Tab A = the app (Call Guard). Tab B stays empty for the guardian view.
- Do one dry run of Step 2 first, so you know the timing (the call is ~62 s, the final report arrives ~15 s after it ends).
- If **Analyse live** ever shows "Gemini is busy", use **⏺ Recorded replay** instead and say "this is a recorded run".
- Record with OBS, Xbox Game Bar (Win+Alt+R) or Loom. Export 1080p, upload to YouTube as **Unlisted** or **Public**.

| Time | Screen | What to do / say |
|---|---|---|
| 0:00–0:20 | **Impact** page (top) | "Japan lost ¥142 billion to special fraud in 2025; people over 65 bore 59% of it. India lost ₹1,935 crore to 'digital arrest' scams in 2024. Most of this money is sent by the victims themselves, under pressure, during a call. Banks watch transactions. Nobody listens to the call." |
| 0:20–0:35 | **Call Guard** page | "Second Opinion is a live scam guardian. It listens alongside someone on a suspicious call (speakerphone or a Google Meet tab) and warns them before money moves. Let's play a real-style digital-arrest call." Select **Digital arrest: fake CBI officer (English)**, click **▶ Analyse live**. |
| 0:35–1:40 | Call Guard while the call plays | Let the call audio play. Point at: the live transcript; **What it heard**, each signal with the exact quote ("claims to be police", "threat of arrest", "isolation: don't tell anyone", "payment / OTP request"); the meter going **Warning → STOP**; the calm whisper. "Every alert shows the exact words that triggered it. Safety actions don't wait for the AI: the guardian is alerted at Warning, and the moment money is demanded a cool-off hold is requested." |
| 1:40–2:00 | Case agent + complaint draft (scroll down) | After the call ends: "When the call ends, a Gemini agent writes the complaint draft for India's 1930 helpline from the full call: the amount, the method, a timeline and five exact quotes. Nothing is filed automatically." |
| 2:00–2:20 | **Tab B**: open the "open guardian view" link | "This is what the family member sees on their phone: the alert, what was heard, and the hold request." Click **Approve hold**. Switch back to Tab A: the hold shows **approved**. |
| 2:20–2:35 | Call Guard: **Genuine bank callback** → **⏺ Recorded replay** | "A genuine bank call triggers nothing. We test genuine calls too: across 16 scripted calls, 10 of 10 scams were caught with 0 false alarms." |
| 2:35–3:05 | **Scam Check** | Click **Digital-arrest WhatsApp** → **Check it**: verdict, red flags with quotes, what to do, safe reply. "You can also upload a chat screenshot or a voice note, or just ask a question." Switch the profile to **Teen (beta)**, click **Teen DM (sextortion)** → **Check it**: "Same engine, a supportive tone for a teenager: it's not your fault, don't pay, tell a trusted adult." |
| 3:05–3:20 | **About** page or the architecture slide of the deck | "Built on Gemini through Firebase AI Logic (Flash for the agent and Scam Check, Flash-Lite for live audio), with Firestore for the guardian link, Firebase Hosting and App Check. No raw audio is stored. Next: teens, bank and telco integration, and on-device Gemma." End on the live URL. |

**Tips**
- Speak slowly; let the STOP moment and the whisper breathe for a second.
- If the Scam Check takes long, cut the waiting in editing (keep the result on screen ≥ 3 s).
- Keep the final cut between 3:00 and 4:00.
