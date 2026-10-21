import { ArrowUpRight, Github, TrainFront } from "lucide-react";
import { BrandMark } from "./Header";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div className="site-footer__brand">
          <div className="site-footer__logo">
            <BrandMark size={40} />
            <div>
              <span className="site-footer__name">jajabor</span>
              <span className="site-footer__bn">যাযাবর · wanderer</span>
            </div>
          </div>
          <p>
            Split tickets, full journey. An unofficial companion for Bangladesh Railway e-tickets.
          </p>
          <a
            className="footer-github"
            href="https://github.com/hello2himel/jajabor"
            target="_blank"
            rel="noreferrer"
          >
            <Github size={16} /> hello2himel/jajabor <ArrowUpRight size={13} />
          </a>
        </div>

        <div className="site-footer__col">
          <h3>Explore</h3>
          <a href="#why">Why split ticketing</a>
          <a href="#how">How the scan works</a>
          <a href="#faq">FAQ</a>
          <a href="https://eticket.railway.gov.bd/" target="_blank" rel="noreferrer">
            Official e-ticket site
          </a>
        </div>

        <div className="site-footer__col">
          <h3>Project</h3>
          <a
            href="https://github.com/TonmoyNaimur/split-ticket-finder"
            target="_blank"
            rel="noreferrer"
          >
            Original extension
          </a>
          <a
            href="https://github.com/hello2himel/jajabor#live-mode"
            target="_blank"
            rel="noreferrer"
          >
            Run live mode
          </a>
          <a
            href="https://github.com/hello2himel/jajabor#disclaimer"
            target="_blank"
            rel="noreferrer"
          >
            Disclaimer
          </a>
        </div>

        <div className="site-footer__col site-footer__col--wide">
          <h3>The fine print</h3>
          <p>
            Not affiliated with Bangladesh Railway or Shohoz. Availability can change the moment
            you look away. Demo seats are simulated; live seats are checked with your own session.
            Timetable snapshot: October 2026.
          </p>
          <div className="site-footer__meta">
            <span>
              <TrainFront size={13} /> Built for the long way round
            </span>
            <span>Inspired by TonmoyNaimur&apos;s split-ticket-finder</span>
          </div>
        </div>
      </div>
      <div className="container site-footer__bottom">
        <span>Built by hello2himel · open source, MIT</span>
        <span>No tickets are bought or sold here.</span>
      </div>
    </footer>
  );
}
