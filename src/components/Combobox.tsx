import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { useClickOutside } from "../lib/hooks";

interface ComboboxProps {
  id: string;
  value: string;
  displayValue: string;
  placeholder: string;
  options: string[];
  labelFor: (value: string) => string;
  metaFor?: (value: string) => string;
  onInput: (text: string) => void;
  onSelect: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  noResults?: string;
}

export function Combobox({
  id,
  value,
  displayValue,
  placeholder,
  options,
  labelFor,
  metaFor,
  onInput,
  onSelect,
  disabled,
  invalid,
  noResults = "No matches. Keep typing to use your own spelling.",
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const rootRef = useClickOutside<HTMLDivElement>(() => setOpen(false), open);
  const listId = useId();

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options.slice(0, 80);
    return options
      .filter((option) => {
        const label = labelFor(option).toLowerCase();
        const meta = (metaFor?.(option) || "").toLowerCase();
        return label.includes(needle) || option.toLowerCase().includes(needle) || meta.includes(needle);
      })
      .slice(0, 80);
  }, [query, options, labelFor, metaFor]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const node = document.getElementById(`${listId}-${active}`);
    node?.scrollIntoView({ block: "nearest" });
  }, [active, listId, open]);

  function openMenu() {
    if (disabled) return;
    setOpen(true);
    setQuery(displayValue);
    window.requestAnimationFrame(() => {
      inputRef.current?.select();
    });
  }

  function choose(option: string) {
    onSelect(option);
    setOpen(false);
    setQuery("");
    setActive(0);
    inputRef.current?.blur();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) openMenu();
      setActive((current) => Math.min(filtered.length - 1, current + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => Math.max(0, current - 1));
    } else if (event.key === "Enter") {
      if (open && filtered[active]) {
        event.preventDefault();
        choose(filtered[active]);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className={`combo ${open ? "combo--open" : ""} ${invalid ? "combo--invalid" : ""}`} ref={rootRef}>
      <div className="combo__input-wrap">
        <Search size={15} className="combo__icon" aria-hidden />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[active] ? `${listId}-${active}` : undefined}
          className="combo__input"
          value={open ? query : displayValue}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            setQuery(event.target.value);
            onInput(event.target.value);
            setOpen(true);
          }}
          onFocus={openMenu}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 120);
          }}
        />
        <button
          type="button"
          className="combo__chevron"
          aria-label={open ? "Close suggestions" : "Show suggestions"}
          tabIndex={-1}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => (open ? setOpen(false) : openMenu())}
        >
          <ChevronDown size={15} />
        </button>
      </div>

      {open && (
        <div className="combo__menu" id={listId} role="listbox" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="combo__empty">{noResults}</div>
          ) : (
            filtered.map((option, index) => {
              const selected = option === value;
              return (
                <button
                  type="button"
                  key={option}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={selected}
                  className={`combo__option ${index === active ? "is-active" : ""} ${
                    selected ? "is-selected" : ""
                  }`}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(option)}
                >
                  <span className="combo__option-main">
                    <span className="combo__option-label">{labelFor(option)}</span>
                    {metaFor && <span className="combo__option-meta">{metaFor(option)}</span>}
                  </span>
                  {selected && <Check size={15} className="combo__check" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
