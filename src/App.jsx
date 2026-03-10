import { useState, useCallback, useEffect } from "react";
import { SQL_SECTIONS, ALL_SECTIONS, buildSQL } from "./sql.js";
import { SECTION_ORDER, SECTION_META, runDiff, generateMarkdown, computeLineDiff } from "./diff.js";

// ─── Theme hook ───────────────────────────────────────────────────────────────
function useTheme() {
  const [theme, setTheme] = useState("dark");
  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);
  return [theme, () => setTheme(t => t === "dark" ? "light" : "dark")];
}

// ─── Small helpers ────────────────────────────────────────────────────────────
function Btn({ children, onClick, variant = "ghost", disabled, style = {} }) {
  const base = { padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, border: "none", transition: "all 0.15s", ...style };
  const variants = {
    primary: { background: "var(--amber)", color: "#000", fontWeight: 700 },
    ghost:   { background: "var(--bg3)", color: "var(--text2)", border: "1px solid var(--border)" },
    danger:  { background: "var(--red-bg)", color: "var(--red)", border: "1px solid var(--red-b)" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], opacity: disabled ? 0.4 : 1, cursor: disabled ? "not-allowed" : "pointer" }}>{children}</button>;
}

function Badge({ children, color = "var(--text3)", bg = "var(--bg3)" }) {
  return <span style={{ background: bg, color, fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 600, letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{children}</span>;
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{ background: copied ? "var(--green-bg)" : "var(--bg3)", border: `1px solid ${copied ? "var(--green-b)" : "var(--border)"}`, color: copied ? "var(--green)" : "var(--text3)", padding: "6px 12px", borderRadius: 7, fontSize: 11, fontWeight: 500, transition: "all 0.2s" }}>
      {copied ? "✓ Copied" : "Copy SQL"}
    </button>
  );
}

function Spinner() {
  return <span className="spin" style={{ display: "inline-block", width: 16, height: 16, border: "2px solid var(--border)", borderTopColor: "var(--amber)", borderRadius: "50%" }} />;
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 8 }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton" style={{ height: 14, width: "40%", marginBottom: 6 }} />
          <div className="skeleton" style={{ height: 10, width: "25%" }} />
        </div>
        <div className="skeleton" style={{ width: 60, height: 22, borderRadius: 20 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 8 }} />)}
      </div>
    </div>
  );
}

function SkeletonResults() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {[0,1,2,3].map(i => <SkeletonCard key={i} />)}
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Nav({ theme, toggleTheme, onHome }) {
  return (
    <nav style={{ borderBottom: "1px solid var(--border)", padding: "14px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "var(--bg)", zIndex: 100, backdropFilter: "blur(8px)" }}>
      <div onClick={onHome} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
      <img src="/logo.png" alt="Driftwatch" style={{ width: 36, height: 36, objectFit: "contain" }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", letterSpacing: "-0.01em", lineHeight: 1 }}>Driftwatch</div>
          <div style={{ fontSize: 9, color: "var(--text3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Schema Diff</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <a href="https://github.com" target="_blank" rel="noopener" style={{ background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text2)", padding: "6px 12px", borderRadius: 7, fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}>
          ★ GitHub
        </a>
        <button onClick={toggleTheme} style={{ background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text2)", padding: "7px 10px", borderRadius: 7, fontSize: 14 }}>
          {theme === "dark" ? "☀" : "🌙"}
        </button>
      </div>
    </nav>
  );
}

// ─── Section selector (checkboxes) ───────────────────────────────────────────
function SectionSelector({ selected, onChange }) {
  const toggle = (key) => onChange(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  const allSelected = selected.length === ALL_SECTIONS.length;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", letterSpacing: "0.04em" }}>SELECT SECTIONS TO COMPARE</div>
        <button onClick={() => onChange(allSelected ? [] : [...ALL_SECTIONS])}
          style={{ fontSize: 11, color: "var(--amber)", background: "none", border: "none", fontWeight: 600, cursor: "pointer" }}>
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
        {ALL_SECTIONS.map(key => {
          const s = SQL_SECTIONS[key];
          const checked = selected.includes(key);
          return (
            <label key={key} style={{ display: "flex", alignItems: "center", gap: 10, background: checked ? "var(--amber-bg)" : "var(--bg3)", border: `1px solid ${checked ? "var(--amber-b)" : "var(--border)"}`, borderRadius: 8, padding: "9px 12px", cursor: "pointer", transition: "all 0.15s" }}>
              <input type="checkbox" checked={checked} onChange={() => toggle(key)} style={{ accentColor: "var(--amber)", width: 14, height: 14 }} />
              <span style={{ fontSize: 14, color: checked ? "var(--amber)" : "var(--text3)" }}>{s.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: checked ? "var(--amber2)" : "var(--text2)" }}>{s.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ─── Input page ───────────────────────────────────────────────────────────────
function InputPage({ onRun }) {
  const [selected, setSelected] = useState([...ALL_SECTIONS]);
  const [sqlOpen, setSqlOpen] = useState(false);
  const [devText, setDevText] = useState("");
  const [prodText, setProdText] = useState("");
  const [error, setError] = useState("");

  const sql = buildSQL(selected);
  const parseRows = t => { try { const p = JSON.parse(t); return Array.isArray(p) ? p.length : null; } catch { return null; } };
  const devRows = devText ? parseRows(devText) : null;
  const prodRows = prodText ? parseRows(prodText) : null;
  const canRun = devRows !== null && prodRows !== null && selected.length > 0;

  const handleRun = () => {
    setError("");
    let dev, prod;
    try { dev = JSON.parse(devText); } catch { setError("Dev JSON is invalid."); return; }
    try { prod = JSON.parse(prodText); } catch { setError("Prod JSON is invalid."); return; }
    if (!Array.isArray(dev) || dev.length === 0) { setError("Dev JSON is empty."); return; }
    if (!Array.isArray(prod) || prod.length === 0) { setError("Prod JSON is empty."); return; }
    onRun(dev, prod, devText.length, prodText.length);
  };

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "52px 28px 80px" }}>
      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: 52 }} className="fade-up">
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--amber-bg)", border: "1px solid var(--amber-b)", borderRadius: 20, padding: "5px 14px", marginBottom: 20 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--amber)", display: "inline-block", boxShadow: "0 0 8px var(--amber)" }} />
          <span style={{ fontSize: 11, color: "var(--amber2)", letterSpacing: "0.08em", fontWeight: 600 }}>FREE · IN-BROWSER · NO DATA SENT TO SERVER</span>
        </div>
        <h1 style={{ fontWeight: 800, fontSize: "clamp(30px,5vw,50px)", lineHeight: 1.1, color: "var(--text)", letterSpacing: "-0.03em", marginBottom: 16 }}>
          Catch schema drift<br />
          <span style={{ color: "var(--amber)" }}>before it hits prod</span>
        </h1>
        <p style={{ fontSize: 15, color: "var(--text2)", maxWidth: 480, margin: "0 auto", lineHeight: 1.7 }}>
          Compare tables, columns, RLS policies, triggers, functions, indexes, enums and more between any two Supabase projects.
        </p>
      </div>

      {/* Step 1 — Select sections */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, marginBottom: 16 }} className="fade-up">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: "var(--amber-bg)", border: "1px solid var(--amber-b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "var(--amber)", fontWeight: 700 }}>1</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Choose what to compare</div>
          <Badge color="var(--amber2)" bg="var(--amber-bg)">{selected.length} selected</Badge>
        </div>
        <SectionSelector selected={selected} onChange={setSelected} />
      </div>

      {/* Step 2 — SQL */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, marginBottom: 16, overflow: "hidden" }} className="fade-up">
        <div onClick={() => setSqlOpen(o => !o)} style={{ padding: "16px 24px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: "var(--amber-bg)", border: "1px solid var(--amber-b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "var(--amber)", fontWeight: 700 }}>2</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Run this SQL in both Dev and Prod</div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>Click to expand · Export results as JSON</div>
          </div>
          <CopyBtn text={sql} />
          <span style={{ color: "var(--text3)", fontSize: 13 }}>{sqlOpen ? "▲" : "▼"}</span>
        </div>
        <div style={{ background: "var(--amber-bg)", borderTop: "1px solid var(--amber-b)", padding: "10px 24px", display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span style={{ fontSize: 14, color: "var(--amber)", flexShrink: 0 }}>⚠</span>
          <div style={{ fontSize: 12, color: "var(--amber2)", lineHeight: 1.6 }}>
            <strong>Before running:</strong> set row limit to <strong>"No limit"</strong> in the SQL editor bottom bar — otherwise results get truncated.
          </div>
        </div>
        {sqlOpen && selected.length > 0 && (
          <pre style={{ padding: "16px 24px", fontSize: 10, color: "var(--text3)", overflowX: "auto", maxHeight: 260, lineHeight: 1.7, background: "var(--bg)", fontFamily: "'JetBrains Mono', monospace", borderTop: "1px solid var(--border)" }}>
            {sql}
          </pre>
        )}
        {selected.length === 0 && sqlOpen && (
          <div style={{ padding: "20px 24px", color: "var(--text3)", fontSize: 13, textAlign: "center" }}>Select at least one section above to generate SQL.</div>
        )}
      </div>

      {/* Step 3 — Paste JSON */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }} className="fade-up">
        {[
          { step: 3, label: "Dev JSON", color: "var(--blue)", val: devText, set: setDevText, rows: devRows },
          { step: 4, label: "Prod JSON", color: "var(--purple)", val: prodText, set: setProdText, rows: prodRows },
        ].map(({ step, label, color, val, set, rows }) => (
          <div key={step} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 26, height: 26, borderRadius: 6, background: "var(--amber-bg)", border: "1px solid var(--amber-b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "var(--amber)", fontWeight: 700 }}>{step}</div>
              <span style={{ fontSize: 13, color, fontWeight: 600 }}>{label}</span>
              {val && rows !== null && <Badge color="var(--green)" bg="var(--green-bg)">✓ {rows} rows</Badge>}
              {val && rows === null && <Badge color="var(--red)" bg="var(--red-bg)">✗ Invalid JSON</Badge>}
            </div>
            <textarea value={val} onChange={e => set(e.target.value)}
              placeholder='[{"section":"TABLE","schema":"public",...}]'
              style={{ width: "100%", height: 150, background: "var(--bg)", border: `1px solid ${val && rows === null ? "var(--red-b)" : "var(--border)"}`, borderRadius: 8, padding: 12, color: "var(--text2)", fontSize: 11, lineHeight: 1.5, transition: "border-color 0.2s" }}
            />
          </div>
        ))}
      </div>

      {error && <div style={{ background: "var(--red-bg)", border: "1px solid var(--red-b)", borderRadius: 8, padding: "12px 16px", marginBottom: 12, fontSize: 12, color: "var(--red)" }}>⚠ {error}</div>}

      <button onClick={handleRun} disabled={!canRun}
        style={{ width: "100%", padding: 16, background: canRun ? "var(--amber)" : "var(--bg3)", border: `1px solid ${canRun ? "var(--amber)" : "var(--border)"}`, borderRadius: 12, color: canRun ? "#000" : "var(--text3)", fontSize: 14, fontWeight: 700, letterSpacing: "0.06em", cursor: canRun ? "pointer" : "not-allowed", transition: "all 0.2s" }}
        className="fade-up">
        {canRun ? "RUN DIFF →" : selected.length === 0 ? "SELECT SECTIONS FIRST" : "PASTE JSON TO CONTINUE"}
      </button>

      <div style={{ textAlign: "center", marginTop: 32, fontSize: 11, color: "var(--text3)" }}>
        All processing happens in your browser · No data is sent to any server · Free forever
      </div>
    </div>
  );
}

// ─── Item mini card (for grid display) ───────────────────────────────────────
function ItemCard({ row, status }) {
  const label = row.sub_name && row.sub_name !== "null" ? row.sub_name : row.name;
  const sublabel = row.sub_name && row.sub_name !== "null" ? row.name : row.schema;
  const colors = {
    synced:   { border: "var(--border)", bg: "var(--bg3)", dot: "var(--green)", text: "var(--text2)" },
    onlyDev:  { border: "var(--blue-b)", bg: "var(--blue-bg)", dot: "var(--blue)", text: "var(--blue)" },
    onlyProd: { border: "#3b076440", bg: "var(--purple-bg)", dot: "var(--purple)", text: "var(--purple)" },
    changed:  { border: "var(--amber-b)", bg: "var(--amber-bg)", dot: "var(--amber)", text: "var(--amber2)" },
  };
  const c = colors[status] || colors.synced;
  return (
    <div className="card-hover" style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, flexShrink: 0, marginTop: 5 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: c.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "'JetBrains Mono', monospace" }}>{label}</div>
          <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sublabel}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Function diff ────────────────────────────────────────────────────────────
function FuncDiffView({ dev, prod }) {
  const lines = computeLineDiff(dev, prod);
  if (!lines.length) return <div style={{ fontSize: 11, color: "var(--text3)", fontStyle: "italic", padding: 12 }}>Only comment differences — logic is identical</div>;
  return (
    <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ padding: "6px 14px", background: "var(--bg3)", borderBottom: "1px solid var(--border)", display: "flex", gap: 16 }}>
        <span style={{ fontSize: 10, color: "var(--red)" }}>— removed</span>
        <span style={{ fontSize: 10, color: "var(--green)" }}>+ added</span>
        <span style={{ fontSize: 10, color: "var(--text3)" }}>context</span>
      </div>
      <div style={{ padding: "10px 14px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, maxHeight: 300, overflowY: "auto", lineHeight: 1.7 }}>
        {lines.map((line, i) => (
          <div key={i} style={{ color: line.type === "add" ? "var(--green)" : line.type === "remove" ? "var(--red)" : "var(--text3)", background: line.type === "add" ? "var(--green-bg)" : line.type === "remove" ? "var(--red-bg)" : "transparent", padding: "0 4px", borderRadius: 2, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {line.type === "add" ? "+ " : line.type === "remove" ? "- " : "  "}{line.text}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Changed item expanded ────────────────────────────────────────────────────
function ChangedDetail({ item, section }) {
  const [open, setOpen] = useState(false);
  const label = item.devRow.sub_name && item.devRow.sub_name !== "null" ? item.devRow.sub_name : item.devRow.name;
  return (
    <div style={{ border: "1px solid var(--amber-b)", borderRadius: 10, overflow: "hidden", marginBottom: 6 }}>
      <div onClick={() => setOpen(o => !o)} style={{ padding: "10px 14px", background: "var(--amber-bg)", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        <span style={{ fontSize: 11, color: "var(--amber2)", fontFamily: "'JetBrains Mono', monospace", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <Badge color="var(--amber2)" bg="var(--amber-b)">{item.fieldDiffs.length} field{item.fieldDiffs.length > 1 ? "s" : ""}</Badge>
        <span style={{ color: "var(--text3)", fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ padding: "14px", background: "var(--bg2)", borderTop: "1px solid var(--amber-b)" }}>
          {item.fieldDiffs.map((fd, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 8, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>{fd.field}</div>
              {fd.field === "definition" ? <FuncDiffView dev={fd.dev} prod={fd.prod} /> : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[{ label: "DEV", val: fd.dev, color: "var(--red)", bg: "var(--red-bg)", b: "var(--red-b)" },
                    { label: "PROD", val: fd.prod, color: "var(--green)", bg: "var(--green-bg)", b: "var(--green-b)" }
                  ].map(({ label, val, color, bg, b }) => (
                    <div key={label}>
                      <div style={{ fontSize: 10, color, marginBottom: 4, fontWeight: 600 }}>{label}</div>
                      <div style={{ background: bg, border: `1px solid ${b}`, borderRadius: 6, padding: "6px 10px", fontSize: 11, color, fontFamily: "'JetBrains Mono', monospace", wordBreak: "break-all" }}>{JSON.stringify(val)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section result card ──────────────────────────────────────────────────────
function SectionResultCard({ section, data }) {
  const [tab, setTab] = useState("overview");
  const meta = SECTION_META[section] || { icon: "•", label: section, color: "var(--text2)" };
  const total = data.onlyDev.length + data.onlyProd.length + data.changed.length;
  const synced = total === 0;
  const totalItems = data.onlyDev.length + data.onlyProd.length + data.changed.length + data.synced.length;

  // Auto-switch tab if section has issues
  const tabs = [
    { key: "overview", label: "Overview" },
    ...(data.onlyDev.length > 0 ? [{ key: "onlyDev", label: `Dev only (${data.onlyDev.length})` }] : []),
    ...(data.onlyProd.length > 0 ? [{ key: "onlyProd", label: `Prod only (${data.onlyProd.length})` }] : []),
    ...(data.changed.length > 0 ? [{ key: "changed", label: `Changed (${data.changed.length})` }] : []),
    ...(data.synced.length > 0 ? [{ key: "synced", label: `In sync (${data.synced.length})` }] : []),
  ];

  return (
    <div className="card-hover fade-up" style={{ background: "var(--bg2)", border: `1px solid ${synced ? "var(--border)" : "var(--amber-b)"}`, borderRadius: 14, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--bg3)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: meta.color, flexShrink: 0 }}>{meta.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{meta.label}</div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{totalItems} total items</div>
        </div>
        {synced ? (
          <Badge color="var(--green)" bg="var(--green-bg)">✓ IN SYNC</Badge>
        ) : (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {data.onlyDev.length > 0 && <Badge color="var(--blue)" bg="var(--blue-bg)">+{data.onlyDev.length} dev only</Badge>}
            {data.onlyProd.length > 0 && <Badge color="var(--purple)" bg="var(--purple-bg)">+{data.onlyProd.length} prod only</Badge>}
            {data.changed.length > 0 && <Badge color="var(--amber2)" bg="var(--amber-bg)">~{data.changed.length} changed</Badge>}
          </div>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", borderTop: "1px solid var(--border)", borderBottom: tabs.length > 1 ? "1px solid var(--border)" : "none" }}>
        {[
          { label: "In Sync", val: data.synced.length, color: "var(--green)" },
          { label: "Dev Only", val: data.onlyDev.length, color: "var(--blue)" },
          { label: "Prod Only", val: data.onlyProd.length, color: "var(--purple)" },
          { label: "Changed", val: data.changed.length, color: "var(--amber)" },
        ].map(({ label, val, color }, i) => (
          <div key={label} style={{ padding: "12px 16px", borderRight: i < 3 ? "1px solid var(--border)" : "none", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: val > 0 ? color : "var(--text3)" }}>{val}</div>
            <div style={{ fontSize: 10, color: "var(--text3)", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      {tabs.length > 1 && (
        <div style={{ borderBottom: "1px solid var(--border)", padding: "0 20px", display: "flex", gap: 0, overflowX: "auto" }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: "10px 14px", background: "none", border: "none", borderBottom: `2px solid ${tab === t.key ? "var(--amber)" : "transparent"}`, color: tab === t.key ? "var(--amber2)" : "var(--text3)", fontSize: 12, fontWeight: tab === t.key ? 600 : 400, whiteSpace: "nowrap", transition: "all 0.15s" }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {tabs.length > 1 && (
        <div style={{ padding: 16 }}>
          {tab === "overview" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6 }}>
              {data.onlyDev.map((r, i) => <ItemCard key={`d${i}`} row={r} status="onlyDev" />)}
              {data.onlyProd.map((r, i) => <ItemCard key={`p${i}`} row={r} status="onlyProd" />)}
              {data.changed.map((c, i) => <ItemCard key={`c${i}`} row={c.devRow} status="changed" />)}
              {data.synced.slice(0, 12).map((r, i) => <ItemCard key={`s${i}`} row={r} status="synced" />)}
              {data.synced.length > 12 && (
                <div style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--text3)" }}>
                  +{data.synced.length - 12} more in sync
                </div>
              )}
            </div>
          )}
          {tab === "onlyDev" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6 }}>
              {data.onlyDev.map((r, i) => <ItemCard key={i} row={r} status="onlyDev" />)}
            </div>
          )}
          {tab === "onlyProd" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6 }}>
              {data.onlyProd.map((r, i) => <ItemCard key={i} row={r} status="onlyProd" />)}
            </div>
          )}
          {tab === "changed" && (
            <div>
              {data.changed.map((c, i) => <ChangedDetail key={i} item={c} section={section} />)}
            </div>
          )}
          {tab === "synced" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6 }}>
              {data.synced.map((r, i) => <ItemCard key={i} row={r} status="synced" />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Results page ─────────────────────────────────────────────────────────────
function ResultsPage({ results, devData, prodData, devSize, prodSize, onReset, onDownload }) {
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 800); return () => clearTimeout(t); }, []);

  const total = SECTION_ORDER.reduce((s, k) => s + (results[k]?.onlyDev.length||0) + (results[k]?.onlyProd.length||0) + (results[k]?.changed.length||0), 0);
  const synced = total === 0;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 28px 80px" }}>
      {/* Verdict */}
      <div className="fade-up" style={{ background: synced ? "var(--green-bg)" : "var(--red-bg)", border: `1px solid ${synced ? "var(--green-b)" : "var(--red-b)"}`, borderRadius: 14, padding: "24px 28px", marginBottom: 24, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{ fontSize: 40 }}>{synced ? "✅" : "❌"}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: "clamp(17px,3vw,24px)", color: synced ? "var(--green)" : "var(--red)", letterSpacing: "-0.02em" }}>
            {synced ? "Dev and Prod are in sync" : `Out of sync — ${total} item${total > 1 ? "s" : ""} need attention`}
          </div>
          <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 6 }}>
            {devData.length} dev rows · {prodData.length} prod rows · {SECTION_ORDER.length} sections checked
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={onReset} style={{ background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text2)", padding: "9px 16px", borderRadius: 8, fontSize: 12, fontWeight: 500 }}>← New Diff</button>
          <button onClick={onDownload} style={{ background: "var(--amber)", border: "none", color: "#000", padding: "9px 20px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>↓ Download MD Report</button>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 24 }}>
        {[
          { label: "Sections", val: SECTION_ORDER.length, color: "var(--text2)" },
          { label: "Dev Only", val: SECTION_ORDER.reduce((s,k) => s+(results[k]?.onlyDev.length||0), 0), color: "var(--blue)" },
          { label: "Prod Only", val: SECTION_ORDER.reduce((s,k) => s+(results[k]?.onlyProd.length||0), 0), color: "var(--purple)" },
          { label: "Changed", val: SECTION_ORDER.reduce((s,k) => s+(results[k]?.changed.length||0), 0), color: "var(--amber)" },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ fontWeight: 800, fontSize: 28, color, lineHeight: 1 }}>{val}</div>
            <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Section cards */}
      {loading ? <SkeletonResults /> : (
        <div style={{ display: "grid", gap: 12 }}>
          {SECTION_ORDER.map(section => results[section] && (
            <SectionResultCard key={section} section={section} data={results[section]} />
          ))}
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: 40, fontSize: 11, color: "var(--text3)" }}>
        Driftwatch · All processing in-browser · No data sent to any server · Free forever
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [page, setPage] = useState("input");
  const [results, setResults] = useState(null);
  const [devData, setDevData] = useState([]);
  const [prodData, setProdData] = useState([]);
  const [devSize, setDevSize] = useState(0);
  const [prodSize, setProdSize] = useState(0);

  const handleRun = useCallback((dev, prod, ds, ps) => {
    setResults(runDiff(dev, prod));
    setDevData(dev); setProdData(prod);
    setDevSize(ds); setProdSize(ps);
    setPage("results");
    window.scrollTo(0, 0);
  }, []);

  const handleDownload = useCallback(() => {
    const md = generateMarkdown(results, devSize, prodSize);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `driftwatch-${new Date().toISOString().slice(0,10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [results, devSize, prodSize]);

  return (
    <>
      <Nav theme={theme} toggleTheme={toggleTheme} onHome={() => setPage("input")} />
      {page === "input" && <InputPage onRun={handleRun} />}
      {page === "results" && results && (
        <ResultsPage results={results} devData={devData} prodData={prodData} devSize={devSize} prodSize={prodSize} onReset={() => setPage("input")} onDownload={handleDownload} />
      )}
    </>
  );
}
