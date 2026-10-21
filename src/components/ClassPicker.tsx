import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { CLASS_BY_CODE, SEAT_CLASSES } from "../types";
import { useClickOutside } from "../lib/hooks";

interface ClassPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function ClassPicker({ value, onChange }: ClassPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), open);
  const selected = CLASS_BY_CODE[value] ?? SEAT_CLASSES[0];
  const groups = [
    { label: "Air conditioned", items: SEAT_CLASSES.filter((c) => c.ac) },
    { label: "Non-AC", items: SEAT_CLASSES.filter((c) => !c.ac) },
  ];

  return (
    <div className="class-picker" ref={ref}>
      <button
        type="button"
        id="class-picker"
        className={`class-picker__button ${open ? "is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={`class-swatch ${selected.ac ? "class-swatch--ac" : ""}`} aria-hidden />
        <span className="class-picker__value">
          <strong>{selected.label}</strong>
          <small>{selected.bn}</small>
        </span>
        <ChevronDown size={16} className="class-picker__chevron" />
      </button>

      {open && (
        <div className="class-menu" role="listbox" aria-label="Seat class">
          {groups.map((group) => (
            <div className="class-menu__group" key={group.label}>
              <div className="class-menu__label">{group.label}</div>
              {group.items.map((item) => {
                const active = item.code === value;
                return (
                  <button
                    type="button"
                    key={item.code}
                    role="option"
                    aria-selected={active}
                    className={`class-menu__option ${active ? "is-selected" : ""}`}
                    onClick={() => {
                      onChange(item.code);
                      setOpen(false);
                    }}
                  >
                    <span className="class-menu__names">
                      <strong>{item.label}</strong>
                      <small>{item.bn}</small>
                    </span>
                    {active ? (
                      <Check size={15} />
                    ) : (
                      <span className="class-menu__code">{item.code.replace(/_/g, " ")}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
