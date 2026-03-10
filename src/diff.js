export const SECTION_ORDER = [
  "TABLE","COLUMN","RLS_POLICY","TRIGGER","FUNCTION",
  "INDEX","ENUM","FOREIGN_KEY","CHECK_CONSTRAINT","SEQUENCE",
  "EXTENSION","BUCKET","BUCKET_RLS"
];

export const SECTION_META = {
  TABLE:            { icon: "⬡", label: "Tables",            color: "#f59e0b" },
  COLUMN:           { icon: "≡", label: "Columns",           color: "#3b82f6" },
  RLS_POLICY:       { icon: "⚿", label: "RLS Policies",      color: "#ef4444" },
  TRIGGER:          { icon: "⚡", label: "Triggers",          color: "#f9a8d4" },
  FUNCTION:         { icon: "ƒ",  label: "Functions",         color: "#a78bfa" },
  INDEX:            { icon: "⌖", label: "Indexes",           color: "#67e8f9" },
  ENUM:             { icon: "≣", label: "Enums",             color: "#86efac" },
  FOREIGN_KEY:      { icon: "⇔", label: "Foreign Keys",      color: "#fdba74" },
  CHECK_CONSTRAINT: { icon: "✓", label: "Check Constraints", color: "#d9f99d" },
  SEQUENCE:         { icon: "#", label: "Sequences",         color: "#e9d5ff" },
  EXTENSION:        { icon: "⊕", label: "Extensions",        color: "#fecdd3" },
  BUCKET:           { icon: "◉", label: "Buckets",           color: "#bfdbfe" },
  BUCKET_RLS:       { icon: "⚿", label: "Bucket RLS",        color: "#fde68a" },
};

function parseDetail(s) {
  try { return typeof s === "string" ? JSON.parse(s) : s; } catch { return s; }
}
function normalizeStr(s) {
  if (typeof s !== "string") return s;
  return s.replace(/\r\n/g, "\n").trim();
}
function stripInlineComments(s) {
  return s.split("\n").map(line => {
    const trimmed = line.trimStart();
    if (trimmed.startsWith("--")) return "";
    const idx = line.indexOf("--");
    if (idx !== -1 && line.slice(0, idx).trim()) return line.slice(0, idx).trimEnd();
    return line;
  }).join("\n");
}
function normalizeDefinition(def) {
  return stripInlineComments(normalizeStr(def || "")).replace(/\s+/g, " ").trim();
}
function detailEqual(section, a, b) {
  const da = parseDetail(a), db = parseDetail(b);
  if (typeof da !== "object" || typeof db !== "object") return normalizeStr(String(a)) === normalizeStr(String(b));
  const allKeys = new Set([...Object.keys(da||{}), ...Object.keys(db||{})]);
  for (const k of allKeys) {
    if (section === "COLUMN" && k === "ordinal") continue;
    if (section === "BUCKET" && k === "created_at") continue;
    const va = da?.[k], vb = db?.[k];
    if (section === "FUNCTION" && k === "definition") {
      if (normalizeDefinition(va) !== normalizeDefinition(vb)) return false;
      continue;
    }
    if (normalizeStr(JSON.stringify(va)) !== normalizeStr(JSON.stringify(vb))) return false;
  }
  return true;
}
function getFieldDiffs(section, a, b) {
  const da = parseDetail(a), db = parseDetail(b);
  const diffs = [];
  const allKeys = new Set([...Object.keys(da||{}), ...Object.keys(db||{})]);
  for (const k of allKeys) {
    if (section === "COLUMN" && k === "ordinal") continue;
    if (section === "BUCKET" && k === "created_at") continue;
    const va = da?.[k], vb = db?.[k];
    if (section === "FUNCTION" && k === "definition") {
      if (normalizeDefinition(va) !== normalizeDefinition(vb)) diffs.push({ field: k, dev: va, prod: vb });
      continue;
    }
    if (normalizeStr(JSON.stringify(va)) !== normalizeStr(JSON.stringify(vb))) diffs.push({ field: k, dev: va, prod: vb });
  }
  return diffs;
}

export function runDiff(devData, prodData) {
  const devMap = {}, prodMap = {};
  const triggerDev = {}, triggerProd = {};
  for (const row of devData) {
    if (row.section === "TRIGGER") {
      const tk = `${row.schema}__${row.name}__${row.sub_name}`;
      if (!triggerDev[tk]) triggerDev[tk] = { events: new Set(), row };
      triggerDev[tk].events.add(parseDetail(row.detail)?.event);
    } else {
      devMap[`${row.section}__${row.schema}__${row.name}__${row.sub_name}`] = row;
    }
  }
  for (const row of prodData) {
    if (row.section === "TRIGGER") {
      const tk = `${row.schema}__${row.name}__${row.sub_name}`;
      if (!triggerProd[tk]) triggerProd[tk] = { events: new Set(), row };
      triggerProd[tk].events.add(parseDetail(row.detail)?.event);
    } else {
      prodMap[`${row.section}__${row.schema}__${row.name}__${row.sub_name}`] = row;
    }
  }
  const results = {};
  for (const s of SECTION_ORDER) results[s] = { onlyDev: [], onlyProd: [], changed: [], synced: [] };
  const allKeys = new Set([...Object.keys(devMap), ...Object.keys(prodMap)]);
  for (const key of allKeys) {
    const dRow = devMap[key], pRow = prodMap[key];
    const section = (dRow||pRow).section;
    if (!results[section]) results[section] = { onlyDev:[], onlyProd:[], changed:[], synced:[] };
    if (dRow && !pRow) results[section].onlyDev.push(dRow);
    else if (!dRow && pRow) results[section].onlyProd.push(pRow);
    else if (!detailEqual(section, dRow.detail, pRow.detail)) {
      results[section].changed.push({ key, devRow: dRow, prodRow: pRow, fieldDiffs: getFieldDiffs(section, dRow.detail, pRow.detail) });
    } else {
      results[section].synced.push(dRow);
    }
  }
  const allTkeys = new Set([...Object.keys(triggerDev), ...Object.keys(triggerProd)]);
  for (const tk of allTkeys) {
    const de = triggerDev[tk], pe = triggerProd[tk];
    if (de && !pe) results["TRIGGER"].onlyDev.push(de.row);
    else if (!de && pe) results["TRIGGER"].onlyProd.push(pe.row);
    else {
      const devEvts = [...de.events].sort().join(",");
      const prodEvts = [...pe.events].sort().join(",");
      if (devEvts !== prodEvts) results["TRIGGER"].changed.push({ key: tk, devRow: de.row, prodRow: pe.row, fieldDiffs: [{ field: "events", dev: [...de.events].sort(), prod: [...pe.events].sort() }] });
      else results["TRIGGER"].synced.push(de.row);
    }
  }
  return results;
}

export function generateMarkdown(results, devSize, prodSize) {
  const now = new Date().toISOString().slice(0,19).replace("T"," ");
  let md = `# Driftwatch — Schema Diff Report\n\n**Generated:** ${now} | **Dev:** ${devSize} bytes | **Prod:** ${prodSize} bytes\n\n## Summary\n\n| Section | Only in Dev | Only in Prod | Changed |\n|---|---|---|---|\n`;
  let total = 0;
  for (const s of SECTION_ORDER) {
    const r = results[s]; if (!r) continue;
    const t = r.onlyDev.length + r.onlyProd.length + r.changed.length;
    if (t > 0) { md += `| ${s} | ${r.onlyDev.length} | ${r.onlyProd.length} | ${r.changed.length} |\n`; total += t; }
  }
  for (const s of SECTION_ORDER) {
    const r = results[s];
    if (!r || (r.onlyDev.length + r.onlyProd.length + r.changed.length === 0)) continue;
    md += `\n## ${s}\n`;
    if (r.onlyDev.length) { md += `\n### Only in Dev\n`; r.onlyDev.forEach(row => { md += `- \`${row.schema}.${row.name}${row.sub_name?`.${row.sub_name}`:""}\`\n`; }); }
    if (r.onlyProd.length) { md += `\n### Only in Prod\n`; r.onlyProd.forEach(row => { md += `- \`${row.schema}.${row.name}${row.sub_name?`.${row.sub_name}`:""}\`\n`; }); }
    if (r.changed.length) {
      md += `\n### Changed\n`;
      r.changed.forEach(c => {
        md += `\n**${c.devRow.schema}.${c.devRow.name}${c.devRow.sub_name?`.${c.devRow.sub_name}`:""}\`**\n`;
        c.fieldDiffs.forEach(fd => { md += `- \`${fd.field}\`: \`${JSON.stringify(fd.dev)}\` → \`${JSON.stringify(fd.prod)}\`\n`; });
      });
    }
  }
  md += `\n---\n\n## ${total === 0 ? "✅ DEV AND PROD ARE IN SYNC" : `❌ OUT OF SYNC — ${total} items need attention`}\n`;
  return md;
}

export function computeLineDiff(devStr, prodStr) {
  const devLines = (devStr||"").replace(/\r\n/g,"\n").split("\n");
  const prodLines = (prodStr||"").replace(/\r\n/g,"\n").split("\n");
  const result = [];
  const devSet = new Set(devLines);
  let di = 0, pi = 0;
  while (di < devLines.length || pi < prodLines.length) {
    if (di < devLines.length && pi < prodLines.length && devLines[di] === prodLines[pi]) {
      result.push({ type: "same", text: devLines[di] }); di++; pi++;
    } else if (pi < prodLines.length && !devSet.has(prodLines[pi])) {
      result.push({ type: "add", text: prodLines[pi] }); pi++;
    } else if (di < devLines.length) {
      result.push({ type: "remove", text: devLines[di] }); di++;
    } else { pi++; }
  }
  // Only keep changed lines + 1 context line around them
  return result.filter((l, i) => {
    if (l.type !== "same") return true;
    const prev = result[i-1], next = result[i+1];
    return prev?.type !== "same" || next?.type !== "same";
  });
}
