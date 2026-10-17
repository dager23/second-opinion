const items = [
  {
    phase: 'Today (prototype)',
    title: 'Seniors: live call guard + guardian loop',
    body: 'Digital arrest, fake bank/KYC and relative-in-trouble scams in English and Hindi, with guardian alerts, a cool-off hold request and a ready complaint draft.',
  },
  {
    phase: 'Next',
    title: 'Teen Shield',
    body: 'Sextortion, gaming-currency and giveaway scams, fake friend requests. Non-judgmental tone, and risk-only alerts to a trusted adult that never expose the teen’s private content.',
  },
  {
    phase: 'Next',
    title: 'Young adults & workers',
    body: 'Task/job scams, fake sellers, investment apps and loan-app harassment, checked from screenshots and voice notes before money moves.',
  },
  {
    phase: 'Next',
    title: 'Small merchants',
    body: 'Fake payment screenshots and UPI collect-request traps at the counter.',
  },
  {
    phase: 'Scale',
    title: 'Bank & telco integration',
    body: 'A real cool-off API with banks, telco call-metadata risk scores, auto-reporting to Sanchar Saathi and the 1930 helpline.',
  },
  {
    phase: 'Scale',
    title: 'On-device with Gemma 4',
    body: 'Private, offline detection on the phone using Gemma 4 E2B/E4B, an Android call-screening app, a WhatsApp bot and a Meet / WhatsApp Web extension.',
  },
  {
    phase: 'Scale',
    title: 'Production backend on Google Cloud',
    body: 'Cloud Run + Agent Development Kit multi-agent case handling, Agent Platform memory for per-family patterns, more JAPAC languages via Gemini Live Translate.',
  },
]

export default function Roadmap() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-extrabold">From one grandparent’s phone call to every age group</h1>
      <p className="max-w-3xl text-ink/80">
        The core engine is a coercion-state detector, not a list of known scam phrases. That is why it extends from fake police to romance, job and
        sextortion scams by changing the audience profile and the guardian relationship.
      </p>
      <ol className="grid gap-3 md:grid-cols-2">
        {items.map((i) => (
          <li key={i.title} className="card p-4">
            <span className="chip">{i.phase}</span>
            <h2 className="mt-2 text-lg font-bold">{i.title}</h2>
            <p className="text-sm text-ink/80">{i.body}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
