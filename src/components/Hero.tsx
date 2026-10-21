import { ArrowRight, MapPin, Sparkles, Ticket, TrainFront } from "lucide-react";

interface HeroProps {
  onStart: () => void;
  onHow: () => void;
  trainCount: number;
  stationCount: number;
}

export function Hero({ onStart, onHow, trainCount, stationCount }: HeroProps) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__texture" aria-hidden />
      <div className="container hero__inner">
        <div className="hero__copy">
          <div className="hero__eyebrow">
            <span className="hero__eyebrow-dot" aria-hidden />
            Bangladesh Railway · split-ticket finder
          </div>
          <h1 id="hero-title">
            The train is full.
            <br />
            <em>Your journey isn&apos;t.</em>
          </h1>
          <p className="hero__lede">
            Jajabor checks every station pair on your train, then stitches available seats into one
            trip. Sometimes the only way through is in pieces.
          </p>
          <div className="hero__actions">
            <button type="button" className="button button--amber" onClick={onStart}>
              Find my split <ArrowRight size={17} />
            </button>
            <button type="button" className="button button--ghost" onClick={onHow}>
              How it works
            </button>
          </div>
          <div className="hero__note">
            <Ticket size={14} />
            Demo works instantly. Live seats use your own railway session.
          </div>
        </div>

        <div className="hero__art" aria-hidden>
          <div className="art-card art-card--back">
            <div className="art-card__row">
              <span>DHAKA</span>
              <span className="art-dash" />
              <span>CHATTOGRAM</span>
            </div>
            <span className="art-card__small">SUBORNO EXPRESS · 701</span>
          </div>
          <div className="art-card art-card--front">
            <div className="art-card__head">
              <span>BOARDING PASS</span>
              <span className="art-card__number">734</span>
            </div>
            <div className="art-route">
              <div className="art-stop">
                <span className="art-stop__name">Saidpur</span>
                <span className="art-stop__time">04:19 pm</span>
              </div>
              <div className="art-route__line">
                <span className="art-route__dot" />
                <span className="art-route__track" />
                <TrainFront size={16} />
                <span className="art-route__track" />
                <span className="art-route__dot" />
              </div>
              <div className="art-stop art-stop--right">
                <span className="art-stop__name">Rajshahi</span>
                <span className="art-stop__time">09:30 pm</span>
              </div>
            </div>
            <div className="art-divider" />
            <div className="art-row">
              <span>Direct</span>
              <strong className="art-soldout">SOLD OUT</strong>
            </div>
            <div className="art-row art-row--split">
              <span>Split</span>
              <strong>
                2 tickets <span>·</span> 9 seats
              </strong>
            </div>
            <div className="art-stamp">
              <Sparkles size={12} /> SEAT FOUND
            </div>
            <div className="art-barcode" />
          </div>
          <div className="art-pin art-pin--one">
            <MapPin size={13} /> {stationCount} stations
          </div>
          <div className="art-pin art-pin--two">
            <TrainFront size={13} /> {trainCount} trains
          </div>
        </div>
      </div>
    </section>
  );
}
