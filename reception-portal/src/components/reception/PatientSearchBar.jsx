import { useRef, useEffect } from "react";
import { usePatientSearch } from "../../hooks/usePatientSearch";

/**
 * PatientSearchBar
 * Props:
 *   onSelect(patient) — called when user picks a result
 *   onRegisterNew()   — called when user clicks "Register new patient"
 */
const PatientSearchBar = ({ onSelect, onRegisterNew }) => {
  const { query, setQuery, results, loading, error, clear } = usePatientSearch();
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        !inputRef.current.contains(e.target)
      ) {
        clear();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [clear]);

  const handleSelect = (patient) => {
    onSelect(patient);
    clear();
    inputRef.current?.blur();
  };

  const showDropdown = query.trim().length >= 2;

  return (
    <div style={{ position: "relative" }}>
      <div style={styles.inputWrapper}>
        <svg style={styles.searchIcon} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="9" cy="9" r="6" />
          <path d="M15 15l-3-3" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          style={styles.input}
          type="text"
          placeholder="Search patient by name or phone…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        {loading && <span style={styles.spinner} className="spin" />}
        {query && (
          <button style={styles.clearBtn} onClick={clear} aria-label="Clear search">
            ✕
          </button>
        )}
      </div>

      {showDropdown && (
        <div ref={dropdownRef} style={styles.dropdown}>
          {error && <div style={styles.dropMsg}>Error: {error}</div>}

          {!loading && !error && results.length === 0 && (
            <div style={styles.dropMsg}>
              No patient found.{" "}
              <button style={styles.linkBtn} onClick={onRegisterNew}>
                Register new patient?
              </button>
            </div>
          )}

          {results.map((p) => (
            <button
              key={p.id}
              style={styles.resultRow}
              onClick={() => handleSelect(p)}
              onMouseOver={(e) => (e.currentTarget.style.background = "#f0f4ff")}
              onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={styles.resultName}>{p.name}</div>
              <div style={styles.resultMeta}>
                📞 {p.phone} &nbsp;·&nbsp; {p.age ? `${p.age}y` : ""}{" "}
                {p.gender || ""}
              </div>
            </button>
          ))}

          {results.length > 0 && (
            <div style={styles.dropFooter}>
              <button style={styles.linkBtn} onClick={onRegisterNew}>
                + Register new patient instead
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const styles = {
  inputWrapper: {
    display: "flex",
    alignItems: "center",
    background: "#fff",
    border: "1.5px solid #d1d5db",
    borderRadius: 10,
    padding: "0 12px",
    gap: 8,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  searchIcon: {
    width: 18,
    height: 18,
    color: "#9ca3af",
    flexShrink: 0,
  },
  input: {
    flex: 1,
    border: "none",
    outline: "none",
    fontSize: 15,
    padding: "12px 0",
    background: "transparent",
    color: "#111",
  },
  clearBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#9ca3af",
    fontSize: 13,
    padding: "4px",
  },
  spinner: {
    display: "inline-block",
    width: 14,
    height: 14,
    border: "2px solid #e5e7eb",
    borderTopColor: "#3b82f6",
    borderRadius: "50%",
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    right: 0,
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
    zIndex: 999,
    overflow: "hidden",
    maxHeight: 320,
    overflowY: "auto",
  },
  dropMsg: {
    padding: "14px 16px",
    fontSize: 14,
    color: "#6b7280",
  },
  resultRow: {
    display: "block",
    width: "100%",
    textAlign: "left",
    background: "transparent",
    border: "none",
    padding: "12px 16px",
    cursor: "pointer",
    transition: "background 0.1s",
    borderBottom: "1px solid #f3f4f6",
  },
  resultName: {
    fontWeight: 600,
    fontSize: 14,
    color: "#111827",
  },
  resultMeta: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  dropFooter: {
    padding: "10px 16px",
    borderTop: "1px solid #f3f4f6",
    background: "#fafafa",
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#2563eb",
    fontSize: 13,
    cursor: "pointer",
    padding: 0,
    textDecoration: "underline",
  },
};

export default PatientSearchBar;
