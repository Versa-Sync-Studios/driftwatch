import { useState, useCallback, useEffect, useRef } from "react";
import { SQL_SECTIONS, ALL_SECTIONS, buildSQL } from "./sql.js";
import { SECTION_ORDER, SECTION_META, runDiff, generateMarkdown, computeLineDiff } from "./diff.js";

// ─── Theme hook ───────────────────────────────────────────────────────────────
function useTheme() {
  const [theme, setTheme] = useState("dark");
  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);
  return [theme, () => setTheme(t => t === "dark" ? "light" : "dark")];
}

// ─── Analytics helper ─────────────────────────────────────────────────────────
function trackEvent(name, params = {}) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", name, params);
  }
}

// ─── Small helpers ────────────────────────────────────────────────────────────
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
        <a href="https://github.com/Versa-Sync-Studios/driftwatch" target="_blank" rel="noopener"
          style={{ background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text2)", padding: "6px 12px", borderRadius: 7, fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}>
          ★ GitHub
        </a>
        <button onClick={toggleTheme} style={{ background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text2)", padding: "7px 10px", borderRadius: 7, fontSize: 14 }}>
          {theme === "dark" ? "☀" : "🌙"}
        </button>
      </div>
    </nav>
  );
}

// ─── Section selector ─────────────────────────────────────────────────────────
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

// ─── Landing sections (shown below the tool on input page) ───────────────────

const FEATURES = [
  { icon: "⬡", title: "14 Schema Sections", desc: "Tables, columns, RLS policies, triggers, functions, indexes, enums, foreign keys, check constraints, sequences, extensions, buckets, bucket RLS and Realtime publications.", color: "#f59e0b" },
  { icon: "⟳", title: "Realtime Coverage", desc: "The only browser-based tool that also diffs your Supabase Realtime publication tables — know exactly which tables have live subscriptions in each environment.", color: "#34d399" },
  { icon: "🔒", title: "100% In-Browser", desc: "Your schema data never leaves your machine. All diffing happens in JavaScript locally — no server, no storage, no accounts. Paste and go.", color: "#a78bfa" },
  { icon: "ƒ", title: "Smart Function Diff", desc: "Strips comment noise before comparing function definitions. Shows a clean line-by-line unified diff so you see only real logic changes.", color: "#67e8f9" },
  { icon: "⚿", title: "RLS Policy Audit", desc: "Surface misconfigured row-level security between environments before they become production incidents. Diff both table and storage policies.", color: "#ef4444" },
  { icon: "↓", title: "Markdown Report", desc: "One-click download of a full diff report as a .md file — share with your team, attach to PRs, or use as a migration checklist.", color: "#fbbf24" },
  { icon: "⌖", title: "Index Awareness", desc: "Know when performance-critical indexes exist in Dev but were never applied to Prod. Excludes primary keys to keep the signal clean.", color: "#fdba74" },
  { icon: "◉", title: "Storage Buckets", desc: "Compare bucket configurations including public access, file size limits, and allowed MIME types across environments.", color: "#bfdbfe" },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Select sections", desc: "Choose which parts of your schema to compare — or select all 14 sections for a full audit.", icon: "☑" },
  { step: "02", title: "Copy the SQL", desc: "A custom SQL snapshot query is generated for your selection. Copy it with one click.", icon: "⎘" },
  { step: "03", title: "Run in both projects", desc: "Open Supabase SQL Editor in Dev and Prod. Run the query in each, export results as JSON.", icon: "▶" },
  { step: "04", title: "Paste & diff", desc: "Paste both JSON outputs into Driftwatch. Hit Run Diff — results appear instantly in your browser.", icon: "⟳" },
];

const WHAT_WE_COVER = [
  { label: "Tables", icon: "⬡" }, { label: "Columns", icon: "≡" },
  { label: "RLS Policies", icon: "⚿" }, { label: "Triggers", icon: "⚡" },
  { label: "Functions", icon: "ƒ" }, { label: "Indexes", icon: "⌖" },
  { label: "Enums", icon: "≣" }, { label: "Foreign Keys", icon: "⇔" },
  { label: "Check Constraints", icon: "✓" }, { label: "Sequences", icon: "#" },
  { label: "Extensions", icon: "⊕" }, { label: "Buckets", icon: "◉" },
  { label: "Bucket RLS", icon: "⚿" }, { label: "Realtime", icon: "⟳" },
];

const STATS = [
  { value: "14", label: "Schema sections covered" },
  { value: "0", label: "Data sent to any server" },
  { value: "100%", label: "Free, forever" },
  { value: "~30s", label: "Time to run a full diff" },
];

function LandingSections({ toolRef }) {
  const scrollToTool = () => toolRef.current?.scrollIntoView({ behavior: "smooth" });

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 28px 100px" }}>

      {/* ── Stats bar ── */}
      <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: "var(--border)", borderRadius: 14, overflow: "hidden", marginBottom: 80, marginTop: 24 }}>
        {STATS.map(({ value, label }) => (
          <div key={label} style={{ background: "var(--bg2)", padding: "28px 20px", textAlign: "center" }}>
            <div style={{ fontSize: "clamp(26px,4vw,38px)", fontWeight: 800, color: "var(--amber)", letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 8, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── How it works ── */}
      <div style={{ marginBottom: 80 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, color: "var(--amber)", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>Simple workflow</div>
          <h2 style={{ fontSize: "clamp(22px,3.5vw,32px)", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>How it works</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))", gap: 12 }}>
          {HOW_IT_WORKS.map(({ step, title, desc, icon }) => (
            <div key={step} className="card-hover" style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, padding: "24px 20px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 12, right: 16, fontSize: 36, fontWeight: 900, color: "var(--border2)", lineHeight: 1, fontFamily: "'JetBrains Mono', monospace" }}>{step}</div>
              <div style={{ fontSize: 24, marginBottom: 14 }}>{icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>{title}</div>
              <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.7 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features grid ── */}
      <div style={{ marginBottom: 80 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, color: "var(--amber)", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>What's included</div>
          <h2 style={{ fontSize: "clamp(22px,3.5vw,32px)", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>Built for Supabase developers</h2>
          <p style={{ fontSize: 14, color: "var(--text2)", marginTop: 10, maxWidth: 480, margin: "10px auto 0" }}>
            Every section you'd want to compare between environments — nothing more, nothing less.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 12 }}>
          {FEATURES.map(({ icon, title, desc, color }) => (
            <div key={title} className="card-hover" style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, padding: "22px 20px" }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: "var(--bg3)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color, marginBottom: 14 }}>{icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 7 }}>{title}</div>
              <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.7 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Coverage pill grid ── */}
      <div style={{ marginBottom: 80 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: "var(--amber)", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>Full coverage</div>
          <h2 style={{ fontSize: "clamp(22px,3.5vw,32px)", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>14 schema sections</h2>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          {WHAT_WE_COVER.map(({ label, icon }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 7, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 30, padding: "8px 16px" }}>
              <span style={{ fontSize: 14, color: "var(--amber)" }}>{icon}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text2)" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Why not Supabase CLI ── */}
      <div style={{ marginBottom: 80 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, color: "var(--amber)", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>Why Driftwatch</div>
          <h2 style={{ fontSize: "clamp(22px,3.5vw,32px)", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>Vs existing tools</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { name: "Supabase CLI db diff", issues: ["Requires Docker + local setup", "High friction for quick checks", "Not accessible to non-engineers"], color: "var(--red)" },
            { name: "Flyway / Liquibase", issues: ["Enterprise complexity", "Migration-file based, not live DB", "Not Supabase-aware"], color: "var(--red)" },
            { name: "pgAdmin Schema Diff", issues: ["Desktop app, no browser access", "No Supabase-specific sections", "No RLS or storage support"], color: "var(--red)" },
            { name: "Driftwatch ✓", issues: ["Zero install, paste and go", "14 Supabase-specific sections", "100% in-browser, free forever"], color: "var(--green)", highlight: true },
          ].map(({ name, issues, color, highlight }) => (
            <div key={name} className="card-hover" style={{ background: highlight ? "var(--green-bg)" : "var(--bg2)", border: `1px solid ${highlight ? "var(--green-b)" : "var(--border)"}`, borderRadius: 14, padding: "20px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: highlight ? "var(--green)" : "var(--text)", marginBottom: 12 }}>{name}</div>
              {issues.map(issue => (
                <div key={issue} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                  <span style={{ color, fontSize: 12, flexShrink: 0, marginTop: 1 }}>{highlight ? "✓" : "✗"}</span>
                  <span style={{ fontSize: 12, color: highlight ? "var(--green)" : "var(--text2)", lineHeight: 1.5 }}>{issue}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="fade-up" style={{ background: "var(--bg2)", border: "1px solid var(--amber-b)", borderRadius: 20, padding: "48px 32px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center top, var(--amber-bg) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⌁</div>
          <h2 style={{ fontSize: "clamp(20px,3vw,28px)", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em", marginBottom: 10 }}>Ready to check your schema?</h2>
          <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 28, maxWidth: 400, margin: "0 auto 28px" }}>Takes about 30 seconds. No sign-up, no install, no data leaves your browser.</p>
          <button onClick={scrollToTool}
            style={{ background: "var(--amber)", color: "#000", border: "none", borderRadius: 10, padding: "13px 32px", fontSize: 14, fontWeight: 700, letterSpacing: "0.05em", cursor: "pointer", boxShadow: "0 0 30px rgba(245,158,11,0.3)" }}>
            RUN A DIFF NOW →
          </button>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ marginTop: 60, paddingTop: 32, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img src="/logo.png" alt="Driftwatch" style={{ width: 24, height: 24, objectFit: "contain" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)" }}>Driftwatch</span>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <a href="https://github.com/Versa-Sync-Studios/driftwatch" target="_blank" rel="noopener" style={{ fontSize: 12, color: "var(--text3)" }}>GitHub</a>
          <a href="https://supabase.com" target="_blank" rel="noopener" style={{ fontSize: 12, color: "var(--text3)" }}>Built for Supabase</a>
        </div>
        <div style={{ fontSize: 11, color: "var(--text3)" }}>Free forever · No server · No data collected</div>
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
  const toolRef = useRef(null);

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
    trackEvent("run_diff", { sections: selected.length });
    onRun(dev, prod, devText.length, prodText.length);
  };

  return (
    <>
      <div ref={toolRef} style={{ maxWidth: 920, margin: "0 auto", padding: "52px 28px 40px" }}>
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
            Compare tables, columns, RLS policies, triggers, functions, indexes, enums, Realtime and more between any two Supabase projects.
          </p>
        </div>

        {/* Step 1 */}
        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, marginBottom: 16 }} className="fade-up">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: "var(--amber-bg)", border: "1px solid var(--amber-b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "var(--amber)", fontWeight: 700 }}>1</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Choose what to compare</div>
            <Badge color="var(--amber2)" bg="var(--amber-bg)">{selected.length} selected</Badge>
          </div>
          <SectionSelector selected={selected} onChange={setSelected} />
        </div>

        {/* Step 2 */}
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

        {/* Step 3 & 4 */}
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

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "var(--text3)" }}>
          All processing happens in your browser · No data is sent to any server · Free forever
        </div>
      </div>

      {/* Landing sections below the tool */}
      <LandingSections toolRef={toolRef} />
    </>
  );
}

// ─── Item mini card ───────────────────────────────────────────────────────────
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
function ChangedDetail({ item }) {
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

  const tabs = [
    { key: "overview", label: "Overview" },
    ...(data.onlyDev.length > 0 ? [{ key: "onlyDev", label: `Dev only (${data.onlyDev.length})` }] : []),
    ...(data.onlyProd.length > 0 ? [{ key: "onlyProd", label: `Prod only (${data.onlyProd.length})` }] : []),
    ...(data.changed.length > 0 ? [{ key: "changed", label: `Changed (${data.changed.length})` }] : []),
    ...(data.synced.length > 0 ? [{ key: "synced", label: `In sync (${data.synced.length})` }] : []),
  ];

  return (
    <div className="card-hover fade-up" style={{ background: "var(--bg2)", border: `1px solid ${synced ? "var(--border)" : "var(--amber-b)"}`, borderRadius: 14, overflow: "hidden" }}>
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

      {tabs.length > 1 && (
        <div style={{ borderBottom: "1px solid var(--border)", padding: "0 20px", display: "flex", gap: 0, overflowX: "auto" }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: "10px 14px", background: "none", border: "none", borderBottom: `2px solid ${tab === t.key ? "var(--amber)" : "transparent"}`, color: tab === t.key ? "var(--amber2)" : "var(--text3)", fontSize: 12, fontWeight: tab === t.key ? 600 : 400, whiteSpace: "nowrap", transition: "all 0.15s" }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

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
          {tab === "onlyDev" && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6 }}>{data.onlyDev.map((r, i) => <ItemCard key={i} row={r} status="onlyDev" />)}</div>}
          {tab === "onlyProd" && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6 }}>{data.onlyProd.map((r, i) => <ItemCard key={i} row={r} status="onlyProd" />)}</div>}
          {tab === "changed" && <div>{data.changed.map((c, i) => <ChangedDetail key={i} item={c} />)}</div>}
          {tab === "synced" && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6 }}>{data.synced.map((r, i) => <ItemCard key={i} row={r} status="synced" />)}</div>}
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
    trackEvent("download_report");
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