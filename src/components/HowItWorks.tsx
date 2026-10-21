import {
  ArrowRight,
  CircleHelp,
  Clock3,
  Grid3X3,
  Route,
  Sparkles,
  TicketCheck,
} from "lucide-react";

export function WhySplit() {
  return (
    <section className="why section" id="why">
      <div className="container why__inner">
        <div className="why__copy">
          <span className="eyebrow eyebrow--dark">Why split</span>
          <h2>A full train isn&apos;t always full.</h2>
          <p>
            Railway seats are sold segment by segment. The direct Dhaka → Rajshahi seat may be gone
            while the same train has space from Dhaka → Santahar and another seat from Santahar →
            Rajshahi. Jajabor finds those overlaps and shows you how to put them together.
          </p>
          <p className="why__small">
            You might pay a little more, change seats, or take a short hop without a reserved
            ticket. Every option is laid out before you decide.
          </p>
        </div>

        <div className="why__diagram" aria-label="Example split journey diagram">
          <div className="diagram-card">
            <div className="diagram-card__head">
              <span className="diagram-kicker">Titumir Express · 734</span>
              <span className="diagram-badge">Saidpur → Rajshahi</span>
            </div>
            <div className="diagram-route">
              <span className="diagram-stop is-muted">Chilahati</span>
              <span className="diagram-stop is-board">Saidpur</span>
              <span className="diagram-stop">Santahar</span>
              <span className="diagram-stop is-alight">Rajshahi</span>
            </div>
            <div className="diagram-ticket diagram-ticket--one">
              <span className="diagram-ticket__label">Ticket 1</span>
              <span>Chilahati → Santahar</span>
              <span className="diagram-ticket__seats">9 seats</span>
            </div>
            <div className="diagram-ticket diagram-ticket--two">
              <span className="diagram-ticket__label">Ticket 2</span>
              <span>Santahar → Rajshahi</span>
              <span className="diagram-ticket__seats">14 seats</span>
            </div>
            <div className="diagram-note">
              <Sparkles size={14} />
              You board at Saidpur and get off at Rajshahi. The first ticket just starts earlier.
            </div>
          </div>
          <div className="diagram-shadow" aria-hidden />
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    icon: Route,
    number: "01",
    title: "Load the real timetable",
    body: "Every stop on your train comes from the railway's route data — not a guess, not an AI hallucination. You can edit the stop list if you know better.",
  },
  {
    icon: Grid3X3,
    number: "02",
    title: "Check every useful pair",
    body: "Jajabor asks for seat counts from stops before you board to stops after you alight. The result is a grid of what is actually available around your trip.",
  },
  {
    icon: TicketCheck,
    number: "03",
    title: "Stitch seats into a journey",
    body: "The route finder combines tickets, allows a small number of unticketed hops, and ranks the result by fewest changes, most seats, and lowest fare.",
  },
];

export function HowItWorks() {
  return (
    <section className="how section" id="how">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="eyebrow eyebrow--dark">How it works</span>
            <h2>Three steps. One seat.</h2>
          </div>
          <p>
            Jajabor is a companion to the official e-ticket site. It reads the same timetable and,
            when you connect a session, asks the same booking API — then does the tedious
            combination hunting for you.
          </p>
        </div>

        <div className="step-grid">
          {STEPS.map((step, index) => (
            <article className="step-card" key={step.number} style={{ animationDelay: `${index * 80}ms` }}>
              <div className="step-card__top">
                <span className="step-card__number">{step.number}</span>
                <span className="step-card__icon">
                  <step.icon size={22} />
                </span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>

        <div className="how-note">
          <Clock3 size={18} />
          <div>
            <strong>A careful scan takes a couple of minutes.</strong>
            <span>
              The railway API asks for a politeness pause between requests. Jajabor shows progress,
              lets you stop any time, and keeps partial results.
            </span>
          </div>
          <a href="#search" className="text-link">
            Start a scan <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </section>
  );
}

const FAQS = [
  {
    q: "Is Jajabor an official Bangladesh Railway service?",
    a: "No. It is an unofficial, open-source companion. It is not affiliated with Bangladesh Railway or Shohoz. Always complete your booking on the official e-ticket site.",
  },
  {
    q: "Do I need an account?",
    a: "Yes. Live seat counts need an active railway session. You log in on the official site, then connect that session to Jajabor — it never asks for your password or OTP. The token stays in your browser and is sent only to your proxy and the railway API.",
  },
  {
    q: "What is a no-ticket hop?",
    a: "A stretch of the journey where Jajabor could not find a reserved seat. You would need to arrange that leg yourself, for example with a local service or an onboard ticket. Set the allowance to 0 if you only want fully covered journeys.",
  },
  {
    q: "Why would a ticket start before my station?",
    a: "Because that seat may be free from an earlier stop. You still board where you are — the ticket simply covers more distance than you travel. Jajabor ranks these options after itineraries that start exactly where you board.",
  },
  {
    q: "Does Jajabor buy tickets for me?",
    a: "No. It finds and ranks combinations, then links each ticket to the official search page. You choose, pay, and complete the booking yourself.",
  },
  {
    q: "How fresh is the availability?",
    a: "Seat counts are requested live during a scan and cached for a short time to avoid hammering the railway. Timetable and station data are bundled with the app. Availability can change while you book.",
  },
  {
    q: "Is my session token safe?",
    a: "The token is kept in browser storage (session storage by default). It is sent to the Jajabor proxy you run or configure, which forwards it to the railway API. The proxy does not log it. Do not paste your token into a proxy you do not trust.",
  },
];

export function FAQ() {
  return (
    <section className="faq section" id="faq">
      <div className="container faq__inner">
        <div className="faq__intro">
          <span className="eyebrow eyebrow--dark">Good to know</span>
          <h2>Questions, answered.</h2>
          <p>
            The short version: Jajabor finds combinations; you book on the official site. Live
            seats use your own railway session.
          </p>
          <a
            className="text-link"
            href="https://eticket.railway.gov.bd/"
            target="_blank"
            rel="noreferrer"
          >
            Open the official e-ticket site <ArrowRight size={14} />
          </a>
        </div>
        <div className="faq__list">
          {FAQS.map((item) => (
            <details className="faq-item" key={item.q}>
              <summary>
                <CircleHelp size={16} />
                <span>{item.q}</span>
                <span className="faq-item__plus" aria-hidden />
              </summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
