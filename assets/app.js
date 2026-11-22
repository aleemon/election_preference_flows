let DATA, STATES, SEATS;
const SVGNS = "http://www.w3.org/2000/svg";
const ST_ORDER = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
const ST_NAME = { NSW: "New South Wales", VIC: "Victoria", QLD: "Queensland", WA: "Western Australia", SA: "South Australia", TAS: "Tasmania", ACT: "Australian Capital Territory", NT: "Northern Territory" };
let current = 0, curState = "AUS", view = "flows", seatYear = 2025, seatState = "ALL", seatQuery = "";
const hidden = { tl: new Set(["coal2pp"]), sk: new Set(), vs: new Set() };   // series switched off
let skPin = null;                                                            // pinned party in the national sankey

const fmt = n => n.toLocaleString("en-AU");
const pct = (a, b, d = 1) => (b ? (100 * a / b).toFixed(d) : "0.0") + "%";
const col = g => `var(--p-${g})`;
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const SHORT = {
  "Australian Labor Party": "Labor", "Liberal Party of Australia": "Liberal", "Liberal Party": "Liberal", "Country Party": "Country",
  "National Party of Australia": "National", "National Country Party": "National Country", "Liberal National Coalition": "Coalition",
  "Liberal National coalition": "Coalition", "Australian Democrats": "Democrats", "Australian Greens": "Greens", "Democratic Labor Party": "DLP",
  "United Australia Party": "United Australia", "Nationalist Party": "Nationalist", "Australian Labor Party (NSW)": "Lang Labor (NSW)",
  "Australian Labor Party (Non-Communist)": "Lang Labor (Non-Communist)", "Pauline Hanson's One Nation": "One Nation",
  "Others (incl. independents)": "Others incl. independents"
};
const short = n => SHORT[n] || n;
function govSide(e) { const g = e.govt; if (g.startsWith("Labor")) return "labor"; if (g === "Protectionist") return "prot"; return "liberal"; }
function rightLabel(e) { return e.year >= 1949 ? "Coalition" : "Non-Labor"; }

/* ---------- tooltip + toast ---------- */
const tip = document.getElementById("tip");
function showTip(html, ev) { tip.innerHTML = html; tip.style.opacity = 1; moveTip(ev); }
function moveTip(ev) { const pad = 14; let x = ev.clientX + pad, y = ev.clientY + pad; const r = tip.getBoundingClientRect(); if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - pad; if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - pad; tip.style.left = x + "px"; tip.style.top = y + "px"; }
function hideTip() { tip.style.opacity = 0; }
function toast(msg) { const t = document.getElementById("toast"); t.textContent = msg; t.style.opacity = 1; clearTimeout(t._h); t._h = setTimeout(() => t.style.opacity = 0, 2600); }

/* ---------- export: PNG + CSV ---------- */
function saveFile(filename, data) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: filename.endsWith(".csv") ? "text/csv;charset=utf-8" : "application/octet-stream" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("Downloaded " + filename);
}
const csvCell = v => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const toCSV = rows => rows.map(r => r.map(csvCell).join(",")).join("\n") + "\n";
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const STYLE_PROPS = ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-opacity", "stroke-dasharray", "opacity", "font-family", "font-size", "font-weight", "letter-spacing", "text-transform", "text-anchor", "display", "visibility"];
function svgToPngBlob(svg, title, subtitle) {
  const vb = svg.viewBox.baseVal; const W = vb && vb.width ? vb.width : svg.clientWidth, H = vb && vb.height ? vb.height : svg.clientHeight;
  const clone = svg.cloneNode(true);
  const src = [svg, ...svg.querySelectorAll("*")], dst = [clone, ...clone.querySelectorAll("*")];
  src.forEach((s, i) => { const cs = getComputedStyle(s); dst[i].setAttribute("style", STYLE_PROPS.map(p => `${p}:${cs.getPropertyValue(p)}`).join(";")); dst[i].removeAttribute("class"); });
  const head = 64, foot = 26, outer = document.createElementNS(SVGNS, "svg");
  outer.setAttribute("xmlns", SVGNS); outer.setAttribute("width", W); outer.setAttribute("height", H + head + foot); outer.setAttribute("viewBox", `0 0 ${W} ${H + head + foot}`);
  const font = getComputedStyle(document.body).fontFamily;
  outer.innerHTML = `<rect width="100%" height="100%" fill="${cssVar("--card")}"/>
    <text x="16" y="28" style="font:700 20px ${cssVar("--display").replace(/"/g, "'")};fill:${cssVar("--ink")}">${esc(title)}</text>
    <text x="16" y="50" style="font:400 13px ${font.replace(/"/g, "'")};fill:${cssVar("--ink-2")}">${esc(subtitle || "")}</text>
    <text x="16" y="${H + head + 18}" style="font:400 11px ${font.replace(/"/g, "'")};fill:${cssVar("--ink-3")}">Preference Flows in Australian Federal Politics · Sources: AEC; Psephos (Adam Carr)</text>`;
  clone.setAttribute("x", 0); clone.setAttribute("y", head); clone.setAttribute("width", W); clone.setAttribute("height", H); clone.removeAttribute("style");
  outer.appendChild(clone);
  const xml = new XMLSerializer().serializeToString(outer);
  return new Promise((res, rej) => {
    const img = new Image(); const scale = 2;
    img.onload = () => { const c = document.createElement("canvas"); c.width = W * scale; c.height = (H + head + foot) * scale; const ctx = c.getContext("2d"); ctx.scale(scale, scale); ctx.drawImage(img, 0, 0); c.toBlob(b => b ? res(b) : rej(new Error("png")), "image/png"); };
    img.onerror = rej; img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  });
}
function tableToPngBlob(rows, title, subtitle, opts = {}) {
  const scale = 2, padX = 10, rowH = 26, head = 64, foot = 26, f = cssVar("--body"), mono = cssVar("--mono");
  const c = document.createElement("canvas"), ctx = c.getContext("2d");
  const fontFor = (r, ci) => (r === 0 ? `600 12px ${f}` : (ci > 0 ? `400 13px ${mono}` : `400 13px ${f}`));
  const widths = rows[0].map((_, ci) => Math.max(...rows.map((r, ri) => { ctx.font = fontFor(ri, ci); return ctx.measureText(String(r[ci] ?? "")).width; })) + padX * 2 + (ci === 0 && opts.swatches ? 18 : 0));
  const W = Math.max(480, widths.reduce((a, b) => a + b, 0) + 32), H = head + rows.length * rowH + foot;
  c.width = W * scale; c.height = H * scale; ctx.scale(scale, scale);
  ctx.fillStyle = cssVar("--card"); ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = cssVar("--ink"); ctx.font = `700 20px ${cssVar("--display")}`; ctx.fillText(title, 16, 28);
  ctx.fillStyle = cssVar("--ink-2"); ctx.font = `400 13px ${f}`; ctx.fillText(subtitle || "", 16, 50);
  rows.forEach((r, ri) => {
    const y = head + ri * rowH; let x = 16;
    ctx.strokeStyle = ri === 0 ? cssVar("--rule-strong") : cssVar("--rule"); ctx.beginPath(); ctx.moveTo(16, y + rowH); ctx.lineTo(W - 16, y + rowH); ctx.stroke();
    r.forEach((v, ci) => {
      ctx.font = fontFor(ri, ci); ctx.fillStyle = ri === 0 ? cssVar("--ink-3") : cssVar("--ink");
      let tx = x + padX;
      if (ci === 0 && opts.swatches && ri > 0 && opts.swatches[ri - 1]) { ctx.fillStyle = opts.swatches[ri - 1]; ctx.fillRect(tx, y + 8, 11, 11); tx += 18; ctx.fillStyle = cssVar("--ink"); }
      if (ci > 0) { ctx.textAlign = "right"; ctx.fillText(String(v ?? ""), x + widths[ci] - padX, y + 17); ctx.textAlign = "left"; }
      else ctx.fillText(String(v ?? ""), tx, y + 17);
      x += widths[ci];
    });
  });
  ctx.fillStyle = cssVar("--ink-3"); ctx.font = `400 11px ${f}`; ctx.fillText("Preference Flows in Australian Federal Politics · Sources: AEC; Psephos (Adam Carr)", 16, H - 9);
  return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error("png")), "image/png"));
}
// mount an export bar; spec = { name, title, subtitle, png: () => Promise<Blob>, csv: () => rows }
function mountExport(host, spec) {
  host.innerHTML = `<span class="xbar" role="group" aria-label="Export ${esc(spec.title)}"><button type="button" data-x="png" aria-label="Download ${esc(spec.title)} as PNG">PNG</button><button type="button" data-x="csv" aria-label="Download ${esc(spec.title)} as CSV">CSV</button></span>`;
  host.querySelector('[data-x="png"]').onclick = async ev => { ev.stopPropagation(); try { const s = typeof spec.title === "function" ? spec.title() : spec.title; await saveFile(spec.name + ".png", await spec.png()); } catch (e) { toast("Couldn't render the image"); } };
  host.querySelector('[data-x="csv"]').onclick = ev => { ev.stopPropagation(); saveFile(spec.name + ".csv", toCSV(spec.csv())); };
}
const resolvedColor = g => cssVar("--p-" + g);

/* ---------- chips ---------- */
function mountChips(host, items, set, onChange, opts = {}) {
  host.innerHTML = items.map(it => `<button type="button" class="chip ${it.kind || ""}" data-k="${esc(it.key)}" aria-pressed="${!set.has(it.key)}"><span class="sw" style="${it.kind === "dash" ? "border-color" : "background"}:${it.color}"></span>${esc(it.label)}</button>`).join("") + (opts.hint ? `<span class="hint">${esc(opts.hint)}</span>` : "");
  host.querySelectorAll(".chip").forEach(b => b.onclick = () => {
    const k = b.dataset.k;
    if (set.has(k)) set.delete(k); else { if (opts.min && items.length - set.size <= opts.min) { toast("At least one series has to stay on"); return; } set.add(k); }
    b.setAttribute("aria-pressed", !set.has(k)); onChange();
  });
}

/* ---------- party grouping ---------- */
function partyGroup(name, year) {
  const n = String(name).toLowerCase();
  if (year >= 2013 && n.includes("united australia")) return "palmer";
  if (n.includes("lang labor")) return "lang";
  if (n.includes("democratic lab") || n.includes("anti-communist") || n.includes("queensland labor")) return "dlp";
  if (n.includes("labor") || n.includes("labour")) return "labor";
  if (n === "protectionist") return "prot";
  if (["free trade", "anti-socialist", "nationalist", "united australia party", "liberal–country"].includes(n) || n.startsWith("nationalist")) return "liberal";
  if (n.includes("liberal national") || n === "liberal" || n.includes("country liberal")) return "coalition";
  if (n.includes("national") || n.includes("country party") || n.includes("farmers") || n.includes("primary producers")) return "country";
  if (n.includes("greens")) return "greens";
  if (n.includes("one nation")) return "on";
  if (n.includes("palmer") || n.includes("trumpet")) return "palmer";
  if (n.includes("family first") || n.includes("christian") || n.includes("call to australia")) return "christian";
  if (n.includes("xenophon") || n.includes("centre alliance")) return "xen";
  if (n.includes("katter")) return "kap";
  if (n === "independent" || n.includes("non affiliated")) return "ind";
  if (n === "democrats" || n.includes("australian democrats")) return "dems";
  return "minor";
}
const SHORT_P = { "Australian Labor Party": "Labor", "Liberal National Party of Queensland": "LNP", "Liberal National Party": "LNP", "The Nationals": "Nationals", "The Greens": "Greens", "Pauline Hanson's One Nation": "One Nation", "Katter's Australian Party (KAP)": "Katter's Australian Party", "Country Liberals (NT)": "Country Liberal", "Country Liberal Party (NT)": "Country Liberal", "CLP - The Territory Party": "Country Liberal", "Australian Democrats": "Democrats", "Democratic Labor Party": "DLP", "Communist Party": "Communist" };
const pShort = n => SHORT_P[n] || n;
const titleCase = s => String(s).toLowerCase().replace(/(^|[\s\-'])([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase()).replace(/\bMc([a-z])/g, (m, a) => "Mc" + a.toUpperCase());

/* ---------- timeline ---------- */
function tlSeries() {
  return DATA.map(e => {
    const tot = e.parties.reduce((s, p) => s + p.votes, 0);
    const lab = e.parties.filter(p => p.group === "labor").reduce((s, p) => s + p.votes, 0);
    const nl = e.parties.filter(p => ["liberal", "country", "coalition", "prot"].includes(p.group)).reduce((s, p) => s + p.votes, 0);
    const t = e.tpp ? 100 * e.tpp.alp / (e.tpp.alp + e.tpp.coal) : null;
    return { e, alp2pp: t, coal2pp: t == null ? null : 100 - t, alpfp: 100 * lab / tot, nlfp: 100 * nl / tot, est: e.tpp && e.tpp.source === "estimate" };
  });
}
const TL_ITEMS = [
  { key: "alp2pp", label: "Labor 2PP", color: "var(--p-labor)", kind: "line" },
  { key: "coal2pp", label: "Coalition / non-Labor 2PP", color: "var(--p-coalition)", kind: "line" },
  { key: "alpfp", label: "Labor first preferences", color: "var(--p-labor)", kind: "dash" },
  { key: "nlfp", label: "Non-Labor first preferences", color: "var(--p-coalition)", kind: "dash" }
];
function drawTimeline() {
  const svg = document.getElementById("timeline");
  svg.innerHTML = "";
  const W = 1080, H = 300, L = 44, R = 12, T = 18, chartB = 214, n = DATA.length;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const step = (W - L - R) / n, x = i => L + step * (i + .5);
  const ymin = 20, ymax = 70, y = v => T + (ymax - v) / (ymax - ymin) * (chartB - T);
  const sel = el("rect", { id: "tl-sel", y: T - 8, width: step, height: H - T, fill: "var(--accent-soft)", rx: 3 }, svg);
  for (let v = 20; v <= 70; v += 10) {
    el("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: v === 50 ? "var(--rule-strong)" : "var(--rule)", "stroke-width": 1, "stroke-dasharray": v === 50 ? "" : "2 3" }, svg);
    const t = el("text", { x: L - 8, y: y(v) + 4, "text-anchor": "end", "font-size": 11, fill: "var(--ink-3)", "font-family": "var(--mono)" }, svg); t.textContent = v + "%";
  }
  const firstPref = DATA.findIndex(e => e.system === "pref");
  el("line", { x1: x(firstPref) - step / 2, x2: x(firstPref) - step / 2, y1: T, y2: chartB, stroke: "var(--rule-strong)", "stroke-dasharray": "3 3" }, svg);
  const zt = el("text", { x: (x(0) + x(firstPref - 1)) / 2, y: T + 12, "text-anchor": "middle", "font-size": 11, fill: "var(--ink-3)" }, svg); zt.textContent = "First past the post";
  const S = tlSeries();
  const line = (key, color, dash, dots) => {
    if (hidden.tl.has(key)) return;
    const segs = []; let cur = [];
    S.forEach((s, i) => { if (s[key] == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push([x(i), y(s[key]), s]); });
    if (cur.length) segs.push(cur);
    for (const sg of segs) el("path", { d: "M" + sg.map(p => p[0] + "," + p[1]).join("L"), fill: "none", stroke: color, "stroke-width": dash ? 1.6 : 2.2, "stroke-dasharray": dash ? "5 4" : "", "stroke-linejoin": "round" }, svg);
    if (dots) for (const sg of segs) for (const p of sg) el("circle", { cx: p[0], cy: p[1], r: 4, fill: p[2].est ? "var(--card)" : color, stroke: p[2].est ? color : "var(--card)", "stroke-width": 2 }, svg);
  };
  line("alpfp", "var(--p-labor)", true, false); line("nlfp", "var(--p-coalition)", true, false);
  line("coal2pp", "var(--p-coalition)", false, true); line("alp2pp", "var(--p-labor)", false, true);
  DATA.forEach((e, i) => {
    const g = el("g", { class: "yr", tabindex: 0, role: "button", "aria-label": `${e.year} election` }, svg);
    el("rect", { class: "hit", x: x(i) - step / 2, y: T - 8, width: step, height: H - T, fill: "transparent", rx: 3 }, g);
    el("rect", { x: x(i) - step / 2 + 1.5, y: chartB + 12, width: step - 3, height: 14, rx: 2, fill: col(govSide(e)) }, g);
    const t = el("text", { x: x(i), y: chartB + 44, "text-anchor": "end", "font-size": 11, fill: "var(--ink-2)", "font-family": "var(--mono)", transform: `rotate(-60 ${x(i)} ${chartB + 44})` }, g); t.textContent = e.year;
    g.addEventListener("click", () => select(i));
    g.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); select(i); } });
    g.addEventListener("mousemove", ev => {
      const s = S[i];
      const rows = [s.alp2pp != null ? `Labor 2PP <span class="num">${s.alp2pp.toFixed(2)}%${s.est ? " (estimate)" : ""}</span>` : (e.system === "fptp" ? "First past the post" : "No national 2PP"),
        `Labor primary <span class="num">${s.alpfp.toFixed(1)}%</span>`, `Non-Labor primary <span class="num">${s.nlfp.toFixed(1)}%</span>`];
      showTip(`<b>${e.year}</b> · ${esc(e.pm)} (${esc(e.govt)})<br>${rows.join("<br>")}`, ev);
    });
    g.addEventListener("mouseleave", hideTip);
  });
  svg._x = x; svg._step = step;
  moveSel();
}
function moveSel() { const svg = document.getElementById("timeline"); const r = document.getElementById("tl-sel"); if (r && svg._x) r.setAttribute("x", svg._x(current) - svg._step / 2); }

/* ---------- national / state sankey ---------- */
function orderNodes(nodes) {
  const rank = n => n[1] === "labor" ? -2 : ["liberal", "country", "coalition"].includes(n[1]) ? 2 + (n[1] === "country" ? .5 : 0) : 1 - n[4] / n[2];
  return [...nodes].sort((a, b) => rank(a) - rank(b));
}
function drawSankey(e, host, flowNodes) {
  host.innerHTML = "";
  const nodes = orderNodes(flowNodes).filter(n => !hidden.sk.has(n[0])).map(n => ({ name: n[0], g: n[1], v: n[2], c: n[3], a: n[4] }));
  if (!nodes.length) { host.innerHTML = `<div class="empty-note"><p>All parties are switched off. Turn one back on above.</p></div>`; return null; }
  const total = nodes.reduce((s, n) => s + n.v, 0);
  const alpT = nodes.reduce((s, n) => s + n.a, 0), coT = nodes.reduce((s, n) => s + n.c, 0);
  const W = 960, padTop = 34, nodeGap = 8, nodeW = 14, lx = 250, rx = W - 250;
  const H = Math.max(460, 140 + nodes.length * 40);
  const k = (H - padTop - 10 - nodeGap * (nodes.length - 1)) / total;
  const svg = el("svg", { id: "sankey", class: "chart-svg", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Sankey diagram of preference flows, ${e.year}` });
  host.appendChild(svg);
  const hL = el("text", { x: lx + nodeW, y: 14, class: "colhead", "text-anchor": "end" }, svg); hL.textContent = "First preferences";
  const hR = el("text", { x: rx, y: 14, class: "colhead" }, svg); hR.textContent = "Two-party preferred";
  let yy = padTop;
  nodes.forEach(n => { n.y0 = yy; n.h = Math.max(n.v * k, 1); yy += n.h + nodeGap; });
  const present = [alpT > 0 ? "a" : null, coT > 0 ? "c" : null].filter(Boolean);
  const rgap = present.length === 2 ? 40 : 0, rk = (H - padTop - 10 - rgap) / Math.max(1, alpT + coT);
  const right = { a: { name: "Labor", g: "labor", v: alpT, y0: padTop }, c: { name: rightLabel(e), g: "coalition", v: coT } };
  right.a.h = alpT * rk; right.c.y0 = padTop + right.a.h + rgap; right.c.h = coT * rk;
  right.a.inY = right.a.y0; right.c.inY = right.c.y0;
  const links = [];
  nodes.forEach(n => { let y = n.y0; for (const [key, val] of [["a", n.a], ["c", n.c]]) { if (val <= 0) continue; const R = right[key]; links.push({ src: n, dst: R, val, y0: y, y1: y + val * k, r0: R.inY, r1: R.inY + val * rk }); y += val * k; R.inY += val * rk; } });
  const gLinks = el("g", {}, svg);
  const applyPin = () => { svg.classList.toggle("hovering", !!skPin); links.forEach(l => l.el.classList.toggle("on", !!skPin && l.src.name === skPin)); };
  links.forEach(l => {
    const x0 = lx + nodeW, x1 = rx, mx = (x0 + x1) / 2;
    const d = `M${x0},${l.y0} C${mx},${l.y0} ${mx},${l.r0} ${x1},${l.r0} L${x1},${l.r1} C${mx},${l.r1} ${mx},${l.y1} ${x0},${l.y1} Z`;
    const p = el("path", { d, class: "link", fill: col(l.src.g) }, gLinks); l.el = p;
    const same = (l.src.g === "labor" && l.dst.g === "labor") || (["liberal", "country", "coalition"].includes(l.src.g) && l.dst.g === "coalition");
    const html = same ? `<b>${esc(short(l.src.name))}</b> first preferences stay with ${esc(l.dst.name)}<span class="num">${fmt(Math.round(l.val))} votes</span>`
      : `<b>${esc(short(l.src.name))} → ${esc(l.dst.name)}</b><span class="num">${fmt(Math.round(l.val))} votes</span><span class="num">${pct(l.val, l.src.v)} of ${esc(short(l.src.name))} votes</span>`;
    p.addEventListener("mousemove", ev => { if (!skPin) { svg.classList.add("hovering"); p.classList.add("on"); } showTip(html, ev); });
    p.addEventListener("mouseleave", () => { if (!skPin) { svg.classList.remove("hovering"); p.classList.remove("on"); } hideTip(); });
  });
  const LH = 32, labs = nodes.map(n => ({ n, y: n.y0 + n.h / 2 }));
  for (let i = 1; i < labs.length; i++) labs[i].y = Math.max(labs[i].y, labs[i - 1].y + LH);
  const maxY = H - 18; if (labs.length && labs[labs.length - 1].y > maxY) { labs[labs.length - 1].y = maxY; for (let i = labs.length - 2; i >= 0; i--) labs[i].y = Math.min(labs[i].y, labs[i + 1].y - LH); }
  nodes.forEach((n, ix) => {
    const ly = labs[ix].y, ncy = n.y0 + n.h / 2, cy = ly - 6, moved = Math.abs(ncy - ly) > 2;
    const g = el("g", { class: "clickable", tabindex: 0, role: "button", "aria-pressed": skPin === n.name, "aria-label": `${short(n.name)}: highlight flows` }, svg);
    el("rect", { x: lx, y: n.y0, width: nodeW, height: n.h, fill: col(n.g), rx: 2 }, g);
    if (skPin === n.name) el("rect", { x: lx - 3, y: n.y0 - 3, width: nodeW + 6, height: n.h + 6, rx: 3, class: "pinned-ring" }, g);
    if (moved) el("path", { d: `M${lx - 2},${ncy} L${lx - 26},${ncy} L${lx - 44},${ly} L${lx - 50},${ly}`, fill: "none", stroke: "var(--rule-strong)", "stroke-width": 1 }, g);
    const tx = moved ? lx - 56 : lx - 10;
    const t = el("text", { x: tx, y: cy, "text-anchor": "end", class: "nlab" }, g); t.textContent = short(n.name);
    const t2 = el("text", { x: tx, y: cy + 15, "text-anchor": "end", class: "nval" }, g); t2.textContent = `${pct(n.v, total)} · ${fmt(n.v)}`;
    g.addEventListener("mousemove", ev => { if (!skPin) { svg.classList.add("hovering"); links.filter(l => l.src === n).forEach(l => l.el.classList.add("on")); }
      showTip(`<b>${esc(short(n.name))}</b><span class="num">${fmt(n.v)} first preferences (${pct(n.v, total)})</span><span class="num">→ Labor ${pct(n.a, n.v)}</span><span class="num">→ ${rightLabel(e)} ${pct(n.c, n.v)}</span><span class="small">Click to ${skPin === n.name ? "clear" : "pin"} highlight</span>`, ev); });
    g.addEventListener("mouseleave", () => { if (!skPin) { svg.classList.remove("hovering"); links.forEach(l => l.el.classList.remove("on")); } hideTip(); });
    const toggle = () => { skPin = skPin === n.name ? null : n.name; render(); };
    g.addEventListener("click", toggle);
    g.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle(); } });
  });
  for (const key of ["a", "c"]) {
    const R = right[key]; if (R.v <= 0) continue;
    el("rect", { x: rx, y: R.y0, width: nodeW, height: R.h, fill: col(R.g), rx: 2 }, svg);
    const cy = R.y0 + R.h / 2;
    const t = el("text", { x: rx + nodeW + 12, y: cy - 6, class: "big" }, svg); t.textContent = R.name;
    const t2 = el("text", { x: rx + nodeW + 12, y: cy + 16, class: "nval", style: "font-size:14px" }, svg); t2.textContent = pct(R.v, alpT + coT, 2);
    const t3 = el("text", { x: rx + nodeW + 12, y: cy + 34, class: "nval" }, svg); t3.textContent = fmt(Math.round(R.v)) + " votes";
  }
  applyPin();
  return { links, total, alpT, coT };
}

/* ---------- state strip (SVG, also a selector) ---------- */
function drawStateStrip(e, host, st) {
  const W = 960, H = 64, gap = 10, cw = (W - gap * 7) / 8;
  const svg = el("svg", { id: "ststrip", class: "chart-svg", viewBox: `0 0 ${W} ${H}`, role: "group", "aria-label": "Labor two-party-preferred share by state. Each state is a button." });
  host.appendChild(svg);
  ST_ORDER.forEach((s, i) => {
    const tp = STATES[e.year][s].tpp, a = tp.alp / (tp.alp + tp.coal), x0 = i * (cw + gap);
    const g = el("g", { class: "stc", tabindex: 0, role: "button", "aria-pressed": s === st, "aria-label": `${ST_NAME[s]}: Labor ${(100 * a).toFixed(1)}%` }, svg);
    el("rect", { class: "hit", x: x0, y: 0, width: cw, height: H, rx: 5, fill: s === st ? "var(--accent-soft)" : "transparent", stroke: s === st ? "var(--ink)" : "var(--rule)" }, g);
    const t = el("text", { x: x0 + 10, y: 22, class: "nlab" }, g); t.textContent = s;
    const t2 = el("text", { x: x0 + cw - 10, y: 22, "text-anchor": "end", class: "nval", style: "font-size:13px;fill:var(--ink)" }, g); t2.textContent = (100 * a).toFixed(1) + "%";
    const bw = cw - 20;
    el("rect", { x: x0 + 10, y: 34, width: bw * a - 1, height: 10, rx: 3, fill: "var(--p-labor)" }, g);
    el("rect", { x: x0 + 10 + bw * a + 1, y: 34, width: bw * (1 - a) - 1, height: 10, rx: 3, fill: "var(--p-coalition)" }, g);
    const go = () => { curState = s === curState ? "AUS" : s; skPin = null; render(); setHash(); };
    g.addEventListener("click", go);
    g.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); go(); } });
  });
  return svg;
}

/* ---------- votes vs seats (SVG) ---------- */
function drawVotesSeats(host, list, vsFormal, vsSeats) {
  host.innerHTML = "";
  const showV = !hidden.vs.has("votes"), showS = !hidden.vs.has("seats");
  const nb = (showV ? 1 : 0) + (showS ? 1 : 0);
  const W = 520, L = 170, R = 70, rowH = 12 + nb * 13, H = 8 + list.length * (rowH + 10);
  const svg = el("svg", { class: "chart-svg", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Share of first preferences and share of seats by party", style: "width:100%;height:auto;display:block" });
  host.appendChild(svg);
  const maxP = Math.max(0.01, ...list.map(p => Math.max(showV ? p.votes / vsFormal : 0, showS ? p.seats / vsSeats : 0)));
  const sx = v => (W - L - R) * v / maxP;
  const defs = el("defs", {}, svg);
  list.forEach((p, i) => {
    const y0 = 8 + i * (rowH + 10);
    el("line", { x1: 0, x2: W, y1: y0 + rowH + 5, y2: y0 + rowH + 5, stroke: "var(--rule)" }, svg);
    el("rect", { x: 0, y: y0 + rowH / 2 - 6, width: 11, height: 11, rx: 2, fill: col(p.group) }, svg);
    const t = el("text", { x: 18, y: y0 + rowH / 2 + 4, style: "font-size:13px" }, svg); const nm = short(p.name); t.textContent = nm.length > 22 ? nm.slice(0, 21) + "…" : nm;
    let by = y0 + 3;
    if (showV) { const vp = p.votes / vsFormal; el("rect", { x: L, y: by, width: Math.max(1, sx(vp)), height: 9, rx: 2, fill: col(p.group) }, svg); const tv = el("text", { x: L + sx(vp) + 6, y: by + 8.5, class: "nval", style: "font-size:11px" }, svg); tv.textContent = (100 * vp).toFixed(1) + "%"; by += 13; }
    if (showS) { const sp = p.seats / vsSeats; const pid = "hatch" + i; const pat = el("pattern", { id: pid, width: 5, height: 5, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs); el("rect", { width: 5, height: 5, fill: col(p.group) }, pat); el("line", { x1: 0, y1: 0, x2: 0, y2: 5, stroke: "var(--card)", "stroke-width": 1.6, "stroke-opacity": .6 }, pat);
      el("rect", { x: L, y: by, width: Math.max(1, sx(sp)), height: 9, rx: 2, fill: `url(#${pid})` }, svg); const ts = el("text", { x: L + sx(sp) + 6, y: by + 8.5, class: "nval", style: "font-size:11px" }, svg); ts.textContent = `${p.seats} seat${p.seats === 1 ? "" : "s"}`; }
  });
  return svg;
}

/* ---------- page for one election ---------- */
function methodBadge(e) {
  if (e.system === "fptp") return `<span class="badge warn">First past the post</span>`;
  if (!e.flows) return `<span class="badge warn">No national 2PP</span>`;
  return { aec: `<span class="badge">Counted flows · AEC</span>`, modelled: `<span class="badge">2PP: AEC · party flows modelled</span>`, estimate: `<span class="badge warn">Unofficial 2PP estimate · flows modelled</span>` }[e.flows.method];
}
function stateSeatList(e, st) {
  const S = SEATS[e.year], agg = {};
  for (const s of S.seats.filter(s => s[0] === st)) {
    const m = s[3], fin = m[m.length - 1]; let w = 0; fin.forEach((v, i) => { if (v > fin[w]) w = i; });
    s[2].forEach((c, i) => { const nm = S.parties[c[2]] || c[2]; const o = agg[nm] = agg[nm] || { name: nm, group: partyGroup(nm, e.year), votes: 0, seats: 0 }; o.votes += m[0][i]; if (i === w) o.seats++; });
  }
  let list = Object.values(agg).sort((a, b) => b.votes - a.votes);
  const totV = list.reduce((s, q) => s + q.votes, 0);
  const small = list.filter(p => p.votes / totV < 0.012 && !p.seats);
  if (small.length > 1) list = list.filter(p => !small.includes(p)).concat([{ name: "Others", group: "other", votes: small.reduce((s, p) => s + p.votes, 0), seats: 0 }]);
  return list;
}
function render() {
  const e = DATA[current];
  const host = document.getElementById("election");
  const turnout = e.formal + e.informal;
  const sorted = [...e.parties].sort((a, b) => b.votes - a.votes);
  const winner = e.tpp ? (e.tpp.alp > e.tpp.coal ? "Labor" : rightLabel(e)) : null;
  const hasStates = !!STATES[e.year];
  if (!hasStates) curState = "AUS";
  const st = curState;
  const fNodes = e.flows ? (st === "AUS" ? e.flows.nodes : STATES[e.year][st].n) : null;
  const where = st !== "AUS" ? " in " + ST_NAME[st] : "";
  host.innerHTML = `
    <div class="el-head">
      <div class="el-title">
        <div class="kicker">${esc(e.date)}</div>
        <div class="el-year">${e.year}</div>
        <div class="muted">${esc(e.pm)} formed government · ${esc(e.govt)}</div>
      </div>
      <div class="nav">
        <button id="prev" ${current === 0 ? "disabled" : ""} aria-label="Previous election">← ${current > 0 ? DATA[current - 1].year : ""}</button>
        <label class="sr" for="pick">Choose election</label>
        <select id="pick">${DATA.map((d, i) => `<option value="${i}" ${i === current ? "selected" : ""}>${d.year}</option>`).join("")}</select>
        <button id="next" ${current === DATA.length - 1 ? "disabled" : ""} aria-label="Next election">${current < DATA.length - 1 ? DATA[current + 1].year : ""} →</button>
      </div>
    </div>
    <div class="tiles">
      <div class="tile"><span class="lab">Formal votes</span><span class="val">${fmt(e.formal)}</span><span class="sub">${pct(e.informal, turnout)} informal</span></div>
      <div class="tile"><span class="lab">Enrolled</span><span class="val">${fmt(e.enrolled)}</span><span class="sub">${e.year >= 1925 ? "compulsory voting" : "voluntary voting"}</span></div>
      <div class="tile"><span class="lab">Two-party preferred</span><span class="val">${e.tpp ? pct(Math.max(e.tpp.alp, e.tpp.coal), e.tpp.alp + e.tpp.coal, 1) : "—"}</span><span class="sub">${e.tpp ? esc(winner) + (e.tpp.source === "estimate" ? " (estimate)" : "") : (e.system === "fptp" ? "no preferences before 1918" : "not available")}</span></div>
      <div class="tile"><span class="lab">Seats</span><span class="val">${e.seatsTotal}</span><span class="sub">${sorted.filter(p => p.seats).slice(0, 3).map(p => esc(short(p.name)) + " " + p.seats).join(" · ")}</span></div>
    </div>
    <div class="panel">
      <div class="panel-head">
        <h2>${e.flows ? "From first preferences to the final two-party count" + where : "First-preference vote"}</h2>
        <span style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">${methodBadge(e)}<span id="x-sankey"></span></span>
      </div>
      ${e.flows ? `<div class="pills" role="group" aria-label="Show flows for" style="margin:4px 0 6px">
        ${["AUS", ...ST_ORDER].map(s => `<button class="pill" data-st="${s}" aria-pressed="${s === st}" ${hasStates || s === "AUS" ? "" : "disabled"}>${s === "AUS" ? "Australia" : s}</button>`).join("")}
        ${hasStates ? "" : `<span class="small" style="align-self:center">State flows are published by the AEC from 2004 onwards.</span>`}
      </div>` : ""}
      ${hasStates ? `<div class="panel" style="margin:4px 0 8px"><div class="panel-head"><span class="small">Labor two-party-preferred share by state, ${e.year}. Click a state to see its flows.</span><span id="x-strip"></span></div><div id="strip" class="sankey-scroll"></div></div>` : ""}
      ${e.flows ? `<div class="chips" id="sk-chips" role="group" aria-label="Show parties"></div>` : ""}
      <div id="sk" class="sankey-scroll"></div>
      ${e.flows ? `<p class="small">Click a party to pin its flows; click again to clear. Switch parties off above to remove them; the two-party totals then show only the parties still on.</p>` : ""}
    </div>
    <div class="two-col">
      <div class="panel">
        <div class="panel-head"><h3>Votes versus seats${st !== "AUS" ? " in " + st : ""}</h3><span id="x-vs"></span></div>
        <div class="chips" id="vs-chips" role="group" aria-label="Show series"></div>
        <div id="vs"></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>${e.flows ? "Preference flows by party" + (st !== "AUS" ? " in " + st : "") : "First preferences by party"}</h3><span id="x-tbl"></span></div>
        <div class="tbl-scroll" id="tbl"></div>
      </div>
    </div>`;
  const tag = `${e.year}${st !== "AUS" ? "-" + st.toLowerCase() : ""}`;
  // sankey
  const sk = host.querySelector("#sk");
  if (e.flows) {
    const all = orderNodes(fNodes);
    mountChips(host.querySelector("#sk-chips"), all.map(n => ({ key: n[0], label: short(n[0]), color: col(n[1]) })), hidden.sk, () => render());
    const res = drawSankey(e, sk, fNodes);
    mountExport(host.querySelector("#x-sankey"), {
      name: `preference-flows-${tag}`, title: `Preference flows ${e.year}${where}`,
      png: () => svgToPngBlob(host.querySelector("#sankey"), `Preference flows, ${e.year} federal election${where}`, `First preferences to two-party-preferred · ${e.flows.method === "aec" ? "AEC counted flows" : "AEC 2PP; minor-party flows modelled"}${hidden.sk.size ? " · some parties hidden" : ""}`),
      csv: () => [["Election", "Area", "From (first preference)", "To (two-party preferred)", "Votes", "Share of party's votes %", "Method"],
        ...orderNodes(fNodes).filter(n => !hidden.sk.has(n[0])).flatMap(n => [[e.year, st === "AUS" ? "Australia" : st, short(n[0]), "Labor", n[4], (100 * n[4] / n[2]).toFixed(2), e.flows.method], [e.year, st === "AUS" ? "Australia" : st, short(n[0]), rightLabel(e), n[3], (100 * n[3] / n[2]).toFixed(2), e.flows.method]])]
    });
  } else {
    const note = e.system === "fptp" ? `Australia used first-past-the-post voting for the House until 1918, so each seat went to the candidate with the most votes and there were no preferences to distribute.` : `Preferences were distributed seat by seat (see the seat tab), but no reliable national two-party-preferred figure exists for this election, so national flows can't be drawn.`;
    sk.innerHTML = `<div class="empty-note"><p>${note}</p><div class="fp-bar" role="img" aria-label="First preference shares">${sorted.map(p => `<div style="flex:${p.votes};background:${col(p.group)}" title="${esc(short(p.name))} ${pct(p.votes, e.formal)}"></div>`).join("")}</div>
      <div class="legend">${sorted.map(p => `<span><i class="sw" style="background:${col(p.group)}"></i>${esc(short(p.name))} <span class="num">${pct(p.votes, e.formal)}</span></span>`).join("")}</div></div>`;
    host.querySelector("#x-sankey").innerHTML = "";
  }
  // state strip
  if (hasStates) {
    const sv = drawStateStrip(e, host.querySelector("#strip"), st);
    mountExport(host.querySelector("#x-strip"), {
      name: `labor-2pp-by-state-${e.year}`, title: `Labor 2PP by state ${e.year}`,
      png: () => svgToPngBlob(sv, `Two-party-preferred by state, ${e.year}`, "Labor share (red) and Coalition share (blue) · AEC"),
      csv: () => [["Election", "State", "Labor 2PP votes", "Coalition 2PP votes", "Labor 2PP %", "Coalition 2PP %"], ...ST_ORDER.map(s => { const t = STATES[e.year][s].tpp; return [e.year, s, t.alp, t.coal, (100 * t.alp / (t.alp + t.coal)).toFixed(2), (100 * t.coal / (t.alp + t.coal)).toFixed(2)]; })]
    });
  }
  // votes vs seats
  let vsList = sorted, vsFormal = e.formal, vsSeats = e.seatsTotal;
  if (st !== "AUS" && SEATS[e.year]) { vsList = stateSeatList(e, st); vsFormal = vsList.reduce((s, p) => s + p.votes, 0); vsSeats = vsList.reduce((s, p) => s + p.seats, 0); }
  mountChips(host.querySelector("#vs-chips"), [{ key: "votes", label: "Share of first preferences", color: "var(--ink-3)" }, { key: "seats", label: "Share of seats (hatched)", color: "var(--ink-3)" }], hidden.vs, () => { const s = drawVotesSeats(host.querySelector("#vs"), vsList, vsFormal, vsSeats); vsSvg = s; }, { min: 1 });
  let vsSvg = drawVotesSeats(host.querySelector("#vs"), vsList, vsFormal, vsSeats);
  mountExport(host.querySelector("#x-vs"), {
    name: `votes-vs-seats-${tag}`, title: `Votes versus seats ${e.year}${where}`,
    png: () => svgToPngBlob(host.querySelector("#vs svg"), `Votes versus seats, ${e.year}${where}`, "Share of first preferences (solid) and share of seats (hatched)"),
    csv: () => [["Election", "Area", "Party", "First-preference votes", "Vote share %", "Seats", "Seat share %"], ...vsList.map(p => [e.year, st === "AUS" ? "Australia" : st, p.name, p.votes, (100 * p.votes / vsFormal).toFixed(2), p.seats, (100 * p.seats / vsSeats).toFixed(2)])]
  });
  // table
  const tbl = host.querySelector("#tbl");
  let tRows, sw;
  if (e.flows) {
    const ns = orderNodes(fNodes), fTpp = st === "AUS" ? e.tpp : STATES[e.year][st].tpp;
    tRows = [["Party", "First prefs", "To Labor", "To " + rightLabel(e)], ...ns.map(n => [short(n[0]), fmt(n[2]), pct(n[4], n[2]), pct(n[3], n[2])]), ["Two-party result", fmt(fTpp.alp + fTpp.coal), pct(fTpp.alp, fTpp.alp + fTpp.coal, 2), pct(fTpp.coal, fTpp.alp + fTpp.coal, 2)]];
    sw = ns.map(n => resolvedColor(n[1])).concat([null]);
    tbl.innerHTML = `<table><thead><tr>${tRows[0].map((h, i) => `<th class="${i ? "r" : ""}">${esc(h)}</th>`).join("")}</tr></thead><tbody>
      ${ns.map(n => `<tr class="clickrow${skPin === n[0] ? " pin" : ""}" data-pin="${esc(n[0])}"><td><i class="sw" style="background:${col(n[1])};margin-right:8px;vertical-align:-1px"></i>${esc(short(n[0]))}</td><td class="r">${fmt(n[2])}</td><td class="r">${pct(n[4], n[2])}</td><td class="r">${pct(n[3], n[2])}</td></tr>`).join("")}
      <tr><td><b>Two-party result</b></td><td class="r">${fmt(fTpp.alp + fTpp.coal)}</td><td class="r"><b>${pct(fTpp.alp, fTpp.alp + fTpp.coal, 2)}</b></td><td class="r"><b>${pct(fTpp.coal, fTpp.alp + fTpp.coal, 2)}</b></td></tr>
      </tbody></table><p class="small" style="margin-top:8px">${e.flows.method === "aec" ? "Percentages are counted AEC flows." : "Minor-party splits are modelled to match the official two-party total; see notes below."} Click a row to pin that party in the diagram.</p>`;
    tbl.querySelectorAll("[data-pin]").forEach(r => r.onclick = () => { skPin = skPin === r.dataset.pin ? null : r.dataset.pin; render(); });
  } else {
    tRows = [["Party", "Votes", "Share", "Seats"], ...sorted.map(p => [p.name, fmt(p.votes), pct(p.votes, e.formal), String(p.seats)])];
    sw = sorted.map(p => resolvedColor(p.group));
    tbl.innerHTML = `<table><thead><tr><th>Party</th><th class="r">Votes</th><th class="r">Share</th><th class="r">Seats</th></tr></thead><tbody>
      ${sorted.map(p => `<tr><td><i class="sw" style="background:${col(p.group)};margin-right:8px;vertical-align:-1px"></i>${esc(p.name)}</td><td class="r">${fmt(p.votes)}</td><td class="r">${pct(p.votes, e.formal)}</td><td class="r">${p.seats}</td></tr>`).join("")}</tbody></table>`;
  }
  mountExport(host.querySelector("#x-tbl"), {
    name: `${e.flows ? "preference-flows-table" : "first-preferences"}-${tag}`, title: `${e.flows ? "Preference flows by party" : "First preferences by party"} ${e.year}${where}`,
    png: () => tableToPngBlob(tRows, `${e.flows ? "Preference flows by party" : "First preferences by party"}, ${e.year}${where}`, e.flows ? (e.flows.method === "aec" ? "AEC counted flows" : "AEC 2PP; minor-party flows modelled") : "Psephos (Adam Carr)", { swatches: sw }),
    csv: () => e.flows ? [["Election", "Area", "Party", "First-preference votes", "To Labor votes", "To " + rightLabel(e) + " votes", "To Labor %", "To " + rightLabel(e) + " %"], ...orderNodes(fNodes).map(n => [e.year, st === "AUS" ? "Australia" : st, short(n[0]), n[2], n[4], n[3], (100 * n[4] / n[2]).toFixed(2), (100 * n[3] / n[2]).toFixed(2)])]
      : [["Election", "Party", "First-preference votes", "Vote share %", "Seats"], ...sorted.map(p => [e.year, p.name, p.votes, (100 * p.votes / e.formal).toFixed(2), p.seats])]
  });
  host.querySelectorAll("[data-st]").forEach(b => b.onclick = () => { curState = b.dataset.st; skPin = null; render(); setHash(); });
  host.querySelector("#prev").onclick = () => select(current - 1);
  host.querySelector("#next").onclick = () => select(current + 1);
  host.querySelector("#pick").onchange = ev => select(+ev.target.value);
  moveSel();
}
function select(i, fromHash) {
  if (i < 0 || i >= DATA.length) return;
  if (i !== current) { skPin = null; hidden.sk.clear(); }
  current = i; render();
  if (!fromHash) setHash();
}

/* ---------- every seat ---------- */
const seatHidden = {};   // key `${year}|${div}` -> Set of hidden candidate indexes
const seatPin = {};      // key -> pinned candidate index
const histOpen = new Set();   // "ST|Seat" keys whose history section is open
const histHidden = new Set();
let seatOpen = null;          // {st, div} of the seat opened most recently
let SEAT_INDEX = null;
function seatIndex() {
  if (SEAT_INDEX) return SEAT_INDEX;
  SEAT_INDEX = {};
  for (const y of seatYears()) for (const s of SEATS[y].seats) { const k = s[0] + "|" + s[1]; (SEAT_INDEX[k] = SEAT_INDEX[k] || []).push({ year: y, s }); }
  return SEAT_INDEX;
}
function seatHistory(st, div) {
  return (seatIndex()[st + "|" + div] || []).map(({ year, s }) => {
    const S = SEATS[year], x = seatSummary(S, s), pc = c => S.parties[c[2]] || c[2];
    const wc = x.cands[x.w], wp = pc(wc), fin = x.m[x.m.length - 1];
    const counted = x.flag !== 1 && x.flag !== 4;
    const grp = gs => x.tot ? 100 * x.cands.reduce((a, c, i) => a + (gs.includes(partyGroup(pc(c), year)) ? x.m[0][i] : 0), 0) / x.tot : null;
    return { year, x, winner: candLabel(wc), party: pShort(wp), group: partyGroup(wp, year),
      share: counted && x.flag !== 2 && x.finTot ? 100 * fin[x.w] / x.finTot : null,
      ru: counted && x.ru != null ? candLabel(x.cands[x.ru]) : "", ruParty: counted && x.ru != null ? pShort(pc(x.cands[x.ru])) : "",
      two: counted && fin.filter(v => v > 0).length === 2, counts: x.m.length, ncand: x.cands.length, flag: x.flag,
      lab: counted ? grp(["labor"]) : null, coal: counted ? grp(["liberal", "country", "coalition", "prot"]) : null };
  });
}
function goSeat(year, st, div) {
  seatYear = year; seatState = st; seatQuery = ""; seatOpen = { st, div }; histOpen.add(st + "|" + div);
  renderSeats(); setHash();
}
const HIST_ITEMS = [
  { key: "share", label: "Winner's share at final count", color: "var(--ink-3)" },
  { key: "lab", label: "Labor first preferences", color: "var(--p-labor)", kind: "dash" },
  { key: "coal", label: "Coalition / non-Labor first preferences", color: "var(--p-coalition)", kind: "dash" }
];
function drawSeatHistoryChart(host, H, st, div) {
  host.innerHTML = "";
  const n = H.length, L = 44, R = 14, T = 16, B = 190, step = Math.max(26, Math.min(56, 860 / n)), W = Math.max(560, L + R + step * n), Ht = 250;
  const svg = el("svg", { class: "chart-svg", viewBox: `0 0 ${W} ${Ht}`, width: W, height: Ht, role: "group", "aria-label": `${div} results by election. Each year is a button.`, style: "max-width:none;display:block" });
  host.appendChild(svg);
  const x = i => L + step * (i + .5), y = v => T + (100 - v) / 100 * (B - T);
  for (let v = 0; v <= 100; v += 25) {
    el("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: v === 50 ? "var(--rule-strong)" : "var(--rule)", "stroke-dasharray": v === 50 ? "" : "2 3" }, svg);
    const tt = el("text", { x: L - 8, y: y(v) + 4, "text-anchor": "end", "font-size": 11, fill: "var(--ink-3)", "font-family": "var(--mono)" }, svg); tt.textContent = v + "%";
  }
  const cur = H.findIndex(h => h.year === seatYear);
  if (cur >= 0) el("rect", { x: x(cur) - step / 2, y: T - 8, width: step, height: Ht - T + 8, fill: "var(--accent-soft)", rx: 3 }, svg);
  const showShare = !histHidden.has("share");
  H.forEach((h, i) => {
    const g = el("g", { class: "hyr", tabindex: 0, role: "button", "aria-label": `${h.year}: ${h.winner} (${h.party})` }, svg);
    el("rect", { class: "hit", x: x(i) - step / 2, y: T - 8, width: step, height: Ht - T + 8, fill: "transparent", rx: 3 }, g);
    const bw = Math.min(22, step * .62);
    if (showShare) {
      if (h.flag === 1) { el("rect", { x: x(i) - bw / 2, y: y(100), width: bw, height: y(0) - y(100), rx: 2, fill: "none", stroke: col(h.group), "stroke-width": 1.5, "stroke-dasharray": "3 2" }, g); const u = el("text", { x: x(i), y: y(50) + 4, "text-anchor": "middle", "font-size": 10, fill: "var(--ink-2)", "font-family": "var(--mono)" }, g); u.textContent = "U"; }
      else if (h.share != null) el("rect", { x: x(i) - bw / 2, y: y(h.share), width: bw, height: y(0) - y(h.share), rx: 2, fill: col(h.group), "fill-opacity": h.two ? 0.85 : 0.5 }, g);
      else el("rect", { x: x(i) - bw / 2, y: B - 6, width: bw, height: 6, rx: 2, fill: col(h.group) }, g);
    } else el("rect", { x: x(i) - bw / 2, y: B + 2, width: bw, height: 6, rx: 2, fill: col(h.group) }, g);
    const yt = el("text", { x: x(i), y: B + 22, "text-anchor": "end", "font-size": 11, fill: i === cur ? "var(--ink)" : "var(--ink-2)", "font-weight": i === cur ? 700 : 400, "font-family": "var(--mono)", transform: `rotate(-55 ${x(i)} ${B + 22})` }, g); yt.textContent = h.year;
    const tipHtml = `<b>${h.year}</b> · ${esc(h.winner)} (${esc(h.party)})${h.flag === 1 ? "<br>Returned unopposed" : ""}${h.share != null ? `<span class="num">${h.share.toFixed(1)}% at final count${h.two ? "" : " (more than two left)"}</span>` : ""}${h.ru ? `<span>Runner-up: ${esc(h.ru)} (${esc(h.ruParty)})</span>` : ""}${h.lab != null ? `<span class="num">Labor primary ${h.lab.toFixed(1)}% · Non-Labor ${h.coal.toFixed(1)}%</span>` : ""}<span class="small">Click to open this count</span>`;
    g.addEventListener("mousemove", ev => showTip(tipHtml, ev)); g.addEventListener("mouseleave", hideTip);
    const go = () => { hideTip(); goSeat(h.year, st, div); };
    g.addEventListener("click", go); g.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); go(); } });
  });
  const line = (key, color) => {
    if (histHidden.has(key)) return;
    let seg = [];
    const flush = () => { if (seg.length > 1) el("path", { d: "M" + seg.map(p => p.join(",")).join("L"), fill: "none", stroke: color, "stroke-width": 1.8, "stroke-dasharray": "5 4" }, svg); seg = []; };
    H.forEach((h, i) => { if (h[key] == null) { flush(); return; } seg.push([x(i), y(h[key])]); });
    flush();
    H.forEach((h, i) => { if (h[key] != null) el("circle", { cx: x(i), cy: y(h[key]), r: 3, fill: color, stroke: "var(--card)", "stroke-width": 1.5, style: "pointer-events:none" }, svg); });
  };
  line("lab", "var(--p-labor)"); line("coal", "var(--p-coalition)");
  return svg;
}
function renderSeatHistory(host, st, div) {
  const H = seatHistory(st, div);
  const range = `${H[0].year}–${H[H.length - 1].year}`;
  host.innerHTML = `<p class="small">${H.length} election${H.length === 1 ? "" : "s"}, ${range}. Seats are matched by name, so boundaries will have changed with redistributions. Bars are the winner's share at the final count (paler where more than two candidates remained); the bar colour is the winning party.</p>
    <div class="panel-head" style="margin-top:6px"><div class="chips hist-chips" role="group" aria-label="Show series"></div><span class="xh-chart"></span></div>
    <div class="sankey-scroll hist-chart"></div>
    <div class="panel-head" style="margin-top:10px"><span class="small">Click a year to open that election's full count.</span><span class="xh-tbl"></span></div>
    <div class="tbl-scroll hist-tbl"></div>`;
  let svg;
  const draw = () => { svg = drawSeatHistoryChart(host.querySelector(".hist-chart"), H, st, div); };
  mountChips(host.querySelector(".hist-chips"), HIST_ITEMS, histHidden, draw, { min: 1 });
  draw();
  const pc1 = v => v == null ? "–" : v.toFixed(1) + "%";
  const rows = H.map(h => [String(h.year), h.winner, h.party, h.flag === 1 ? "Unopposed" : h.flag === 2 ? "Count n/a" : pc1(h.share), h.ru ? `${h.ru} (${h.ruParty})` : "", pc1(h.lab), pc1(h.coal), String(h.counts)]);
  const head = ["Year", "Winner", "Party", "Final share", "Runner-up", "Labor primary", "Non-Labor primary", "Counts"];
  const tbl = host.querySelector(".hist-tbl");
  tbl.innerHTML = `<table><thead><tr>${head.map((c, i) => `<th class="${i >= 3 && i !== 4 ? "r" : ""}">${c}</th>`).join("")}</tr></thead><tbody>${H.map((h, i) => `<tr class="clickrow${h.year === seatYear ? " cur" : ""}" data-y="${h.year}" tabindex="0"><td class="num">${h.year}</td><td><i class="sw" style="background:${col(h.group)};margin-right:8px;vertical-align:-1px"></i>${esc(h.winner)}</td><td>${esc(h.party)}</td><td class="r">${rows[i][3]}</td><td>${esc(rows[i][4])}</td><td class="r">${rows[i][5]}</td><td class="r">${rows[i][6]}</td><td class="r">${rows[i][7]}</td></tr>`).join("")}</tbody></table>`;
  tbl.querySelectorAll("tr[data-y]").forEach(r => { const go = () => goSeat(+r.dataset.y, st, div); r.onclick = go; r.onkeydown = ev => { if (ev.key === "Enter") go(); }; });
  const base = `${slug(div)}-${slug(st)}-history`;
  mountExport(host.querySelector(".xh-chart"), {
    name: `${base}-chart`, title: `${div} across elections`,
    png: () => svgToPngBlob(svg, `${div} (${st}) across elections, ${range}`, "Winner's share at final count (bars, coloured by winning party) and first-preference shares"),
    csv: () => [["Seat", "State", "Year", "Winner", "Party", "Winner's share at final count %", "Two candidates at final count", "Labor first preferences %", "Non-Labor first preferences %", "Candidates", "Counts", "Note"],
      ...H.map(h => [div, st, h.year, h.winner, h.party, h.share == null ? "" : h.share.toFixed(2), h.two ? "Yes" : "No", h.lab == null ? "" : h.lab.toFixed(2), h.coal == null ? "" : h.coal.toFixed(2), h.ncand, h.counts, ({ 1: "Unopposed", 2: "Count not available", 3: "Totals change between counts in source", 4: "Statewide" })[h.flag] || ""])]
  });
  mountExport(host.querySelector(".xh-tbl"), {
    name: `${base}-table`, title: `${div} results table`,
    png: () => tableToPngBlob([head, ...rows], `${div} (${st}) across elections, ${range}`, "Sources: AEC; Psephos (Adam Carr)", { swatches: H.map(h => resolvedColor(h.group)) }),
    csv: () => [["Seat", "State", ...head], ...rows.map(r => [div, st, ...r])]
  });
}
function histSection(x) {
  const k = x.st + "|" + x.div, n = (seatIndex()[k] || []).length, open = histOpen.has(k);
  return `<div class="panel hist-panel"><div class="panel-head"><h3>${esc(x.div)} across elections</h3>
    <button type="button" class="hist-btn" aria-expanded="${open}">${open ? "Hide" : "Show"} all ${n} election${n === 1 ? "" : "s"}</button></div>
    <div class="hist-host" ${open ? "" : "hidden"}></div></div>`;
}
function wireHist(body, x) {
  const k = x.st + "|" + x.div, btn = body.querySelector(".hist-btn"), hostH = body.querySelector(".hist-host");
  const n = (seatIndex()[k] || []).length;
  if (histOpen.has(k)) renderSeatHistory(hostH, x.st, x.div);
  btn.onclick = () => {
    if (histOpen.has(k)) { histOpen.delete(k); hostH.hidden = true; hostH.innerHTML = ""; }
    else { histOpen.add(k); hostH.hidden = false; renderSeatHistory(hostH, x.st, x.div); }
    btn.setAttribute("aria-expanded", histOpen.has(k)); btn.textContent = `${histOpen.has(k) ? "Hide" : "Show"} all ${n} election${n === 1 ? "" : "s"}`;
  };
}
function seatSummary(S, s) {
  const [st, div, cands, m, flag] = s;
  const fin = m[m.length - 1], first = m[0], tot = first.reduce((a, b) => a + b, 0);
  const rank = fin.map((v, i) => i).sort((a, b) => fin[b] - fin[a]);
  const w = rank[0], ru = cands.length > 1 ? rank[1] : null;
  let lead = 0; first.forEach((v, i) => { if (v > first[lead]) lead = i; });
  const finTot = fin.reduce((a, b) => a + b, 0);
  const winners = flag === 4 ? cands.map((c, i) => c[3] ? i : -1).filter(i => i >= 0) : null;
  return { winners, st, div, cands, m, flag: flag || 0, tot, w, ru, lead, finTot, onFirst: tot > 0 && first[w] / tot > 0.5, fromBehind: lead !== w, stopped: m.length > 1 ? fin.filter(v => v > 0).length > 2 : false };
}
function candLabel(c) { return `${titleCase(c[1])} ${titleCase(c[0])}`.trim(); }
function seatYears() { return Object.keys(SEATS).map(Number).sort((a, b) => a - b); }
function renderSeats() {
  const host = document.getElementById("view-seats");
  const years = seatYears();
  if (!SEATS[seatYear]) seatYear = years[years.length - 1];
  const S = SEATS[seatYear];
  const fptp = seatYear < 1918;
  const all = S.seats.map(s => seatSummary(S, s));
  const q = seatQuery.trim().toLowerCase();
  const match = x => !q || x.div.toLowerCase().includes(q) || x.cands.some(c => (c[0] + " " + c[1] + " " + (S.parties[c[2]] || "")).toLowerCase().includes(q));
  const shown = all.filter(x => (seatState === "ALL" || x.st === seatState) && match(x));
  const contested = all.filter(x => x.flag !== 1);
  const nFirst = contested.filter(x => x.onFirst).length, nBehind = contested.filter(x => x.fromBehind).length, nUnop = all.filter(x => x.flag === 1).length;
  const src = S.src === "aec" ? `AEC distribution of preferences by division` : `Adam Carr's Psephos archive (count-by-count results compiled from AEC and earlier Commonwealth records)`;
  host.innerHTML = `
    <section class="card" style="display:grid;gap:14px">
      <div class="el-head">
        <div class="el-title"><div class="kicker">Distribution of preferences · ${fptp ? "first past the post" : "preferential voting"}</div><div class="el-year">${seatYear}</div>
          <div class="muted">${all.length} seats${nUnop ? ` · ${nUnop} returned unopposed` : ""}${fptp ? "" : ` · ${nFirst} decided on first preferences · ${nBehind} won from behind on preferences`}</div></div>
        <div class="nav"><label for="seat-year" class="small">Election</label><select id="seat-year">${years.map(y => `<option ${y === seatYear ? "selected" : ""}>${y}</option>`).join("")}</select></div>
      </div>
      <div class="seat-tools">
        <div class="pills" role="group" aria-label="State">${["ALL", ...ST_ORDER].map(s => `<button class="pill" data-sst="${s}" aria-pressed="${s === seatState}" ${s !== "ALL" && !all.some(x => x.st === s) ? "disabled" : ""}>${s === "ALL" ? "All states" : s}</button>`).join("")}</div>
        <label for="seat-q" class="sr">Search seats and candidates</label>
        <input id="seat-q" type="search" placeholder="Search seat, candidate or party" value="${esc(seatQuery)}">
      </div>
      <p class="small">${fptp ? "Before 1918 the candidate with the most votes won; there were no preferences, so each seat shows first preferences only." : "Open a seat to see every count as a table and a flow diagram. Click a candidate (in either) to pin their flows; use the chips to switch candidates on or off."} Source: ${src}. The left border shows the winning party.</p>
    </section>
    <div id="seat-list" style="display:grid;gap:24px"></div>`;
  const list = host.querySelector("#seat-list");
  const groups = ST_ORDER.filter(s => seatState === "ALL" || s === seatState);
  list.innerHTML = groups.map(s => {
    const xs = shown.filter(x => x.st === s).sort((a, b) => a.div.localeCompare(b.div));
    if (!xs.length) return "";
    return `<div class="state-block"><h2>${ST_NAME[s]} <span class="small num">${xs.length} seat${xs.length === 1 ? "" : "s"}</span></h2>
      ${xs.map(x => {
        const wc = x.cands[x.w], wp = S.parties[wc[2]] || wc[2];
        let line;
        if (x.flag === 4) line = `Statewide electorate: <b>${x.winners.length} members elected</b> (${x.winners.map(i => esc(titleCase(x.cands[i][0]))).join(", ")})`;
        else if (x.flag === 1) line = `<b>${esc(candLabel(wc))}</b> (${esc(pShort(wp))}) returned unopposed`;
        else if (x.flag === 2) line = `<b>${esc(candLabel(wc))}</b> (${esc(pShort(wp))}) led on first preferences with <span class="num">${pct(x.m[0][x.w], x.tot)}</span>; full count not available`;
        else if (x.ru == null) line = `<b>${esc(candLabel(wc))}</b> (${esc(pShort(wp))})`;
        else {
          const rc = x.cands[x.ru], rp = S.parties[rc[2]] || rc[2], fin = x.m[x.m.length - 1];
          line = `<b>${esc(candLabel(wc))}</b> (${esc(pShort(wp))}) defeated ${esc(candLabel(rc))} (${esc(pShort(rp))}), <span class="num">${pct(fin[x.w], x.finTot)}</span> ${x.m.length > 1 ? `after ${x.m.length - 1} exclusion${x.m.length === 2 ? "" : "s"}` : (fptp ? "of the vote" : "on first preferences")}`;
        }
        const flags = [x.flag === 1 ? `<span class="badge">Unopposed</span>` : "", x.flag !== 1 && x.flag !== 4 && x.onFirst && !fptp ? `<span class="badge">Won on primaries</span>` : "", x.flag !== 1 && x.flag !== 4 && x.fromBehind ? `<span class="badge warn">Came from behind</span>` : "", x.flag === 4 ? `<span class="badge">Multi-member</span>` : "", x.flag === 2 || x.flag === 3 ? `<span class="badge warn">Source issue</span>` : ""].join("");
        return `<details class="seat" data-div="${esc(x.div)}" data-key="${esc(x.st + "|" + x.div)}" style="border-left-color:${col(partyGroup(wp, seatYear))}"><summary>
          <span class="seat-name">${esc(x.div)}</span><span class="seat-win">${line}</span><span class="seat-flags">${flags}</span>
        </summary><div class="seat-body"></div></details>`; }).join("")}</div>`;
  }).join("") || `<p class="muted">No seats match “${esc(seatQuery)}”.</p>`;
  list.querySelectorAll("details.seat").forEach(d => d.addEventListener("toggle", () => {
    const x = shown.find(z => z.st + "|" + z.div === d.dataset.key);
    if (d.open) { renderSeatBody(S, x, d.querySelector(".seat-body")); seatOpen = { st: x.st, div: x.div }; setHash(); }
    else if (seatOpen && seatOpen.st + "|" + seatOpen.div === d.dataset.key) { seatOpen = null; setHash(); }
  }));
  host.querySelector("#seat-year").onchange = ev => { seatYear = +ev.target.value; if (seatOpen && !SEATS[seatYear].seats.some(z => z[0] === seatOpen.st && z[1] === seatOpen.div)) seatOpen = null; renderSeats(); setHash(); };
  host.querySelectorAll("[data-sst]").forEach(b => b.onclick = () => { seatState = b.dataset.sst; seatOpen = null; renderSeats(); setHash(); });
  const qi = host.querySelector("#seat-q");
  qi.oninput = ev => { seatQuery = ev.target.value; clearTimeout(qi._t); qi._t = setTimeout(() => { const pos = ev.target.selectionStart; renderSeats(); const n = document.getElementById("seat-q"); n.focus(); n.setSelectionRange(pos, pos); }, 200); };
  if (q && shown.length <= 3) list.querySelectorAll("details.seat").forEach(d => d.open = true);
  if (seatOpen) {
    const d = [...list.querySelectorAll("details.seat")].find(z => z.dataset.key === seatOpen.st + "|" + seatOpen.div);
    if (d) { d.open = true; const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches; requestAnimationFrame(() => d.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" })); }
  }
}
function exclusionsOf(x) {
  const { cands, m } = x, steps = [];
  for (let k = 1; k < m.length; k++) {
    const exs = cands.map((_, i) => i).filter(i => m[k - 1][i] > 0 && m[k][i] === 0);
    steps.push({ k, exs, moved: exs.reduce((s, i) => s + m[k - 1][i], 0) });
  }
  return steps;
}
function renderSeatBody(S, x, body) {
  const key = seatYear + "|" + x.div;
  const hid = seatHidden[key] = seatHidden[key] || new Set();
  const pin = seatPin[key] ?? null;
  const { cands, m, tot } = x, steps = exclusionsOf(x);
  const isWin = i => x.flag === 4 ? !!cands[i][3] : i === x.w; const w = x.w;
  const pc = c => S.parties[c[2]] || c[2];
  const exAt = {}; steps.forEach(s => s.exs.forEach(i => exAt[i] = s.k));
  const order = cands.map((_, i) => i).sort((a, b) => (exAt[b] ?? 99) - (exAt[a] ?? 99) || m[m.length - 1][b] - m[m.length - 1][a]);
  const notes = [];
  if (x.flag === 1) { body.innerHTML = `<p class="muted">${esc(candLabel(cands[0]))} (${esc(pShort(pc(cands[0])))}) was the only candidate nominated, so no votes were cast.</p>` + histSection(x); wireHist(body, x); return; }
  if (x.flag === 4) notes.push("In 1901 this state voted as a single electorate: each voter could vote for as many candidates as there were seats, and the candidates with the most votes were elected (marked ✓).");
  else if (seatYear < 1918) notes.push("First past the post: the candidate with the most votes won. There were no preferences to distribute.");
  if (x.flag === 2) notes.push("This seat's count in Adam Carr's archive couldn't be read reliably (or a candidate appears to be missing from its candidate table), so only first preferences are shown and they may be incomplete. Check the original state file on Psephos for the full count.");
  if (x.flag === 3) notes.push("The source's vote totals change from one count to the next here, probably a transcription error in the original record. The figures are shown as published.");
  if (x.stopped) notes.push("The count stopped once the winner had an absolute majority, which was standard practice before 1984, so more than two candidates remain at the final count.");
  if (seatYear >= 1918 && m.length === 1 && x.flag !== 2 && cands.length > 1) notes.push("Decided on first preferences: the winner had an absolute majority, so no preferences were distributed.");
  // table rows
  const head = ["Candidate", "Party", "Primary", ...steps.map(s => "Count " + (s.k + 1))];
  const rowsCSV = [head.concat(["Excluded at count", "Elected"])];
  const trs = order.map(i => {
    const c = cands[i];
    let cells = `<td class="r">${fmt(m[0][i])}<span class="gain">${pct(m[0][i], tot)}</span></td>`;
    const csvR = [candLabel(c), pShort(pc(c)), m[0][i]];
    for (const s of steps) {
      const v = m[s.k][i], prev = m[s.k - 1][i];
      if (v === 0 && prev === 0) { cells += `<td class="r out">–</td>`; csvR.push(""); }
      else if (v === 0) { cells += `<td class="r exnow">excluded</td>`; csvR.push("excluded"); }
      else { cells += `<td class="r">${fmt(v)}<span class="gain">${v - prev < 0 ? "−" + fmt(prev - v) : "+" + fmt(v - prev)}</span></td>`; csvR.push(v); }
    }
    csvR.push(exAt[i] != null ? exAt[i] + 1 : "", isWin(i) ? "Yes" : "");
    rowsCSV.push(csvR);
    return `<tr class="clickrow${pin === i ? " pin" : ""}" data-ci="${i}" title="Click to pin this candidate's flows"><td><i class="sw" style="background:${col(partyGroup(pc(c), seatYear))};margin-right:8px;vertical-align:-1px"></i>${isWin(i) ? "<b>" : ""}${esc(candLabel(c))}${isWin(i) ? "</b> ✓" : ""}<span class="gain">${esc(pShort(pc(c)))}</span></td>${cells}</tr>`;
  }).join("");
  const hasFlows = steps.length > 0;
  body.innerHTML = `${notes.map(n => `<p class="note">${esc(n)}</p>`).join("")}
    <div class="panel"><div class="panel-head"><h3>Count by count</h3><span class="xs-tbl"></span></div>
      <div class="tbl-scroll"><table class="dop"><thead><tr><th>Candidate</th><th class="r">Primary</th>${steps.map(s => `<th class="r">Count ${s.k + 1}</th>`).join("")}</tr></thead><tbody>${trs}</tbody></table></div></div>
    ${hasFlows ? `<div class="panel"><div class="panel-head"><h3>How the preferences flowed</h3><span class="xs-sk"></span></div>
      <div class="chips seat-chips" role="group" aria-label="Show candidates"></div>
      <p class="small">Each column is a count. Faint bands carry a candidate's votes forward; bold bands are the ballots of the candidate excluded at that count, split among those still in the race. Hover for numbers; click a candidate to pin their flows.</p>
      <div class="sankey-scroll seat-sk"></div></div>` : ""}
    ${histSection(x)}`;
  wireHist(body, x);
  const base = `${slug(x.div)}-${seatYear}`;
  const tRows = [["Candidate", "Primary", ...steps.map(s => "Count " + (s.k + 1))], ...order.map(i => [`${candLabel(cands[i])} (${pShort(pc(cands[i]))})${isWin(i) ? " ✓" : ""}`, fmt(m[0][i]), ...steps.map(s => { const v = m[s.k][i], p = m[s.k - 1][i]; return v === 0 && p === 0 ? "–" : v === 0 ? "excluded" : fmt(v); })])];
  mountExport(body.querySelector(".xs-tbl"), {
    name: `${base}-count-table`, title: `${x.div} ${seatYear} count table`,
    png: () => tableToPngBlob(tRows, `${x.div} (${x.st}), ${seatYear}: distribution of preferences`, S.src === "aec" ? "Source: AEC" : "Source: Psephos (Adam Carr)", { swatches: order.map(i => resolvedColor(partyGroup(pc(cands[i]), seatYear))) }),
    csv: () => rowsCSV.map(r => [seatYear, x.st, x.div, ...r]).map((r, i) => i === 0 ? ["Election", "State", "Seat", ...rowsCSV[0]] : r)
  });
  body.querySelectorAll("tr[data-ci]").forEach(r => r.onclick = () => { const i = +r.dataset.ci; seatPin[key] = seatPin[key] === i ? null : i; renderSeatBody(S, x, body); });
  if (!hasFlows) return;
  mountChips(body.querySelector(".seat-chips"), order.map(i => ({ key: String(i), label: `${titleCase(cands[i][0])} (${pShort(pc(cands[i]))})`, color: col(partyGroup(pc(cands[i]), seatYear)) })), { has: k => hid.has(+k), delete: k => hid.delete(+k), add: k => hid.add(+k), get size() { return hid.size; } }, () => renderSeatBody(S, x, body), { min: 1 });
  const svg = drawSeatSankey(S, x, body.querySelector(".seat-sk"), hid, pin, i => { seatPin[key] = seatPin[key] === i ? null : i; renderSeatBody(S, x, body); });
  mountExport(body.querySelector(".xs-sk"), {
    name: `${base}-preference-flows`, title: `${x.div} ${seatYear} preference flows`,
    png: () => svgToPngBlob(svg, `${x.div} (${x.st}), ${seatYear}: how the preferences flowed`, (S.src === "aec" ? "Source: AEC" : "Source: Psephos (Adam Carr)") + (hid.size ? " · some candidates hidden" : "")),
    csv: () => {
      const rows = [["Election", "State", "Seat", "Count", "Excluded candidate", "From party", "To candidate", "To party", "Ballots", "Share of excluded candidate's ballots %"]];
      for (const s of steps) for (const ex of s.exs) for (let i = 0; i < cands.length; i++) {
        if (m[s.k][i] <= 0) continue; const g = m[s.k][i] - m[s.k - 1][i]; if (g <= 0) continue;
        const share = s.exs.length === 1 ? (100 * g / s.moved).toFixed(2) : "";
        if (s.exs.length > 1 && ex !== s.exs[0]) continue;
        rows.push([seatYear, x.st, x.div, s.k + 1, s.exs.map(j => candLabel(cands[j])).join(" + "), s.exs.map(j => pShort(pc(cands[j]))).join(" + "), candLabel(cands[i]), pShort(pc(cands[i])), g, share]);
      }
      return rows;
    }
  });
}
function drawSeatSankey(S, x, host, hid, pin, onPin) {
  host.innerHTML = "";
  const { cands, m, w } = x, n = cands.length, K = m.length;
  const pc = c => S.parties[c[2]] || c[2];
  const vis = i => !hid.has(i);
  const val = (k, i) => vis(i) ? m[k][i] : 0;
  const exAt = {}; for (let k = 1; k < K; k++) cands.forEach((_, i) => { if (m[k - 1][i] > 0 && m[k][i] === 0) exAt[i] = k; });
  const order = cands.map((_, i) => i).sort((a, b) => (exAt[b] ?? 99) - (exAt[a] ?? 99) || m[K - 1][b] - m[K - 1][a]);
  const colTot = k => order.reduce((s, i) => s + val(k, i), 0);
  const maxTot = Math.max(1, ...m.map((_, k) => colTot(k)));
  const totAll = m[0].reduce((s, v) => s + v, 0);
  const nVis = order.filter(vis).length;
  const L = 270, R = 170, colGap = Math.max(96, Math.min(150, 760 / Math.max(1, K - 1))), nodeW = 10, top = 46, gap = 6;
  const W = L + (K - 1) * colGap + nodeW + R;
  const H = Math.max(320, 90 + nVis * 30);
  const kk = (H - top - 12 - gap * Math.max(0, nVis - 1)) / maxTot;
  const svg = el("svg", { class: "chart-svg seat-svg", viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": `Preference flows in ${x.div}`, style: "max-width:none;display:block" });
  host.appendChild(svg);
  const X = k => L + k * colGap;
  const pos = [];
  for (let k = 0; k < K; k++) {
    let y = top; const c = {};
    for (const i of order) { const v = val(k, i); c[i] = { y0: y, h: v * kk, v }; y += v * kk + (v > 0 ? gap : 0); }
    const used = y - gap - top, off = (H - 12 - top - used) / 2;
    for (const i of order) c[i].y0 += off;
    pos.push(c);
  }
  const gl = el("g", {}, svg);
  const links = [];
  for (let k = 1; k < K; k++) {
    const exs = cands.map((_, i) => i).filter(i => m[k - 1][i] > 0 && m[k][i] === 0);
    const ex = exs.find(vis);
    let exY = ex != null ? pos[k - 1][ex].y0 : 0;
    for (const i of order) {
      if (!vis(i) || m[k][i] <= 0) continue;
      const self = Math.min(m[k - 1][i], m[k][i]), tr = Math.max(0, m[k][i] - m[k - 1][i]);
      links.push({ k, from: i, to: i, v: self, y0: pos[k - 1][i].y0, y1: pos[k][i].y0, self: true });
      if (tr > 0 && ex != null && exs.length === 1) { links.push({ k, from: ex, to: i, v: tr, y0: exY, y1: pos[k][i].y0 + self * kk, self: false, moved: m[k - 1][ex] }); exY += tr * kk; }
    }
  }
  const setHL = f => { svg.classList.toggle("hovering", !!f); links.forEach(l => l.el.classList.toggle("on", !!f && f(l))); };
  const pinF = pin != null ? (l => l.from === pin || l.to === pin && !l.self) : null;
  const restore = () => setHL(pinF);
  for (const l of links) {
    const h = l.v * kk, x0 = X(l.k - 1) + nodeW, x1 = X(l.k), mx = (x0 + x1) / 2;
    const d = `M${x0},${l.y0} C${mx},${l.y0} ${mx},${l.y1} ${x1},${l.y1} L${x1},${l.y1 + h} C${mx},${l.y1 + h} ${mx},${l.y0 + h} ${x0},${l.y0 + h} Z`;
    l.el = el("path", { d, class: "link " + (l.self ? "self" : "xfer"), fill: col(partyGroup(pc(cands[l.from]), seatYear)) }, gl);
    const fc = cands[l.from], tc = cands[l.to];
    const html = l.self ? `<b>${esc(candLabel(fc))}</b> keeps <span class="num">${fmt(l.v)}</span> votes into count ${l.k + 1}`
      : `<b>${esc(titleCase(fc[0]))} → ${esc(titleCase(tc[0]))}</b> (${esc(pShort(pc(tc)))})<span class="num">${fmt(l.v)} ballots</span><span class="num">${pct(l.v, l.moved)} of ${esc(titleCase(fc[0]))}'s ${fmt(l.moved)}</span>`;
    l.el.addEventListener("mousemove", ev => { if (pin == null) setHL(z => z === l); showTip(html, ev); });
    l.el.addEventListener("mouseleave", () => { restore(); hideTip(); });
  }
  for (let k = 0; k < K; k++) for (const i of order) {
    const p = pos[k][i]; if (p.v <= 0) continue;
    const g = el("g", { class: "clickable" }, svg);
    el("rect", { x: X(k), y: p.y0, width: nodeW, height: Math.max(p.h, 1), rx: 1.5, fill: col(partyGroup(pc(cands[i]), seatYear)), stroke: exAt[i] === k + 1 ? "var(--ink)" : "none", "stroke-width": 1.2 }, g);
    if (pin === i) el("rect", { x: X(k) - 3, y: p.y0 - 3, width: nodeW + 6, height: Math.max(p.h, 1) + 6, rx: 3, class: "pinned-ring" }, g);
    g.addEventListener("mousemove", ev => { if (pin == null) setHL(z => z.from === i || (z.to === i && !z.self)); showTip(`<b>${esc(candLabel(cands[i]))}</b> (${esc(pShort(pc(cands[i])))})<span class="num">Count ${k + 1}: ${fmt(p.v)} votes (${pct(p.v, totAll)})</span>${exAt[i] === k + 1 ? "<span>Excluded after this count</span>" : ""}<span class="small">Click to ${pin === i ? "clear" : "pin"} highlight</span>`, ev); });
    g.addEventListener("mouseleave", () => { restore(); hideTip(); });
    g.addEventListener("click", () => onPin(i));
  }
  for (let k = 0; k < K; k++) {
    const t1 = el("text", { x: X(k) + nodeW / 2, y: 14, "text-anchor": "middle", class: "colhead" }, svg); t1.textContent = k === 0 ? "Primary" : "Count " + (k + 1);
    if (k < K - 1) { const exs = cands.map((_, i) => i).filter(i => m[k][i] > 0 && m[k + 1][i] === 0); const t2 = el("text", { x: X(k) + nodeW / 2, y: 30, "text-anchor": "middle", class: "nval", style: "font-size:10.5px" }, svg); const nm = exs.map(i => titleCase(cands[i][0])).join(", "); t2.textContent = "out: " + (nm.length > 13 ? nm.slice(0, 12) + "…" : nm); }
  }
  const lab = (k, side) => {
    const items = order.filter(i => val(k, i) > 0).map(i => ({ i, y: pos[k][i].y0 + pos[k][i].h / 2 }));
    for (let j = 1; j < items.length; j++) items[j].y = Math.max(items[j].y, items[j - 1].y + 15);
    if (items.length) { items[items.length - 1].y = Math.min(items[items.length - 1].y, H - 12); for (let j = items.length - 2; j >= 0; j--) items[j].y = Math.min(items[j].y, items[j + 1].y - 15); }
    for (const o of items) {
      const v = m[k][o.i], c = cands[o.i];
      const ny = pos[k][o.i].y0 + pos[k][o.i].h / 2, moved = Math.abs(ny - o.y) > 3;
      const g = el("g", { class: "clickable" }, svg);
      if (moved) el("path", { d: side === "L" ? `M${X(k) - 2},${ny} L${X(k) - 12},${ny} L${X(k) - 24},${o.y} L${X(k) - 27},${o.y}` : `M${X(k) + nodeW + 2},${ny} L${X(k) + nodeW + 12},${ny} L${X(k) + nodeW + 24},${o.y} L${X(k) + nodeW + 27},${o.y}`, fill: "none", stroke: "var(--rule-strong)", "stroke-width": 1 }, g);
      const t = el("text", { x: side === "L" ? X(k) - (moved ? 30 : 8) : X(k) + nodeW + (moved ? 30 : 8), y: o.y + 4, "text-anchor": side === "L" ? "end" : "start", style: `font-size:12px;${pin === o.i ? "font-weight:700" : ""}` }, g);
      const nm = side === "L" ? `${titleCase(c[0])} (${pShort(pc(c))})` : titleCase(c[0]);
      t.textContent = (nm.length > 32 ? nm.slice(0, 31) + "…" : nm) + "  ";
      const ts = el("tspan", { class: "nval", style: "font-size:11px" }, t); ts.textContent = pct(v, totAll);
      if (side === "R" && o.i === w) t.setAttribute("font-weight", "600");
      g.addEventListener("click", () => onPin(o.i));
    }
  };
  lab(0, "L"); lab(K - 1, "R");
  restore();
  return svg;
}

/* ---------- routing ---------- */
function setHash() {
  let h;
  if (view === "flows") h = "e" + DATA[current].year + (curState !== "AUS" ? "-" + curState.toLowerCase() : "");
  else if (seatOpen) h = `seat-${seatYear}-${seatOpen.st.toLowerCase()}-${slug(seatOpen.div)}`;
  else h = "seats-" + seatYear + (seatState !== "ALL" ? "-" + seatState.toLowerCase() : "");
  if (location.hash !== "#" + h) { try { history.replaceState(null, "", "#" + h); } catch (_) { location.hash = h; } }
}
function applyHash() {
  let mm = location.hash.match(/^#e(\d{4})(?:-([a-z]+))?$/);
  if (mm) { const i = DATA.findIndex(d => d.year === +mm[1]); if (i >= 0) { current = i; curState = mm[2] && ST_ORDER.includes(mm[2].toUpperCase()) ? mm[2].toUpperCase() : "AUS"; showView("flows", true); return true; } }
  mm = location.hash.match(/^#seat-(\d{4})-([a-z]+)-([a-z0-9-]+)$/);
  if (mm && SEATS[mm[1]]) { const s = SEATS[mm[1]].seats.find(z => z[0] === mm[2].toUpperCase() && slug(z[1]) === mm[3]); if (s) { seatYear = +mm[1]; seatState = s[0]; seatQuery = ""; seatOpen = { st: s[0], div: s[1] }; showView("seats", true); return true; } }
  mm = location.hash.match(/^#seats-(\d{4})(?:-([a-z]+))?$/);
  if (mm && SEATS[mm[1]]) { seatYear = +mm[1]; seatState = mm[2] && ST_ORDER.includes(mm[2].toUpperCase()) ? mm[2].toUpperCase() : "ALL"; showView("seats", true); return true; }
  return false;
}
function showView(v, fromHash) {
  view = v;
  document.getElementById("view-flows").style.display = v === "flows" ? "grid" : "none";
  document.getElementById("view-seats").style.display = v === "seats" ? "grid" : "none";
  document.getElementById("tab-flows").setAttribute("aria-selected", v === "flows");
  document.getElementById("tab-seats").setAttribute("aria-selected", v === "seats");
  if (v === "flows") render(); else renderSeats();
  if (!fromHash) setHash();
}
document.getElementById("tab-flows").onclick = () => showView("flows");
document.getElementById("tab-seats").onclick = () => { if (SEATS[DATA[current].year]) seatYear = DATA[current].year; if (curState !== "AUS") seatState = curState; showView("seats"); };
document.addEventListener("keydown", ev => {
  if (view !== "flows") return;
  if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
  if (ev.key === "ArrowLeft") select(current - 1); if (ev.key === "ArrowRight") select(current + 1);
});
window.addEventListener("hashchange", () => { applyHash(); });

/* ---------- start ---------- */
async function start() {
  const status = document.getElementById("loading");
  try {
    const get = p => fetch(p).then(r => { if (!r.ok) throw new Error(p + " " + r.status); return r.json(); });
    [DATA, STATES, SEATS] = await Promise.all([get("data/elections.json"), get("data/states.json"), get("data/seats.json")]);
  } catch (err) {
    status.innerHTML = "<b>Couldn't load the data files.</b> If you opened index.html straight from your computer, run a local web server instead (see README). " + esc(String(err.message || err));
    return;
  }
  status.remove();
  current = DATA.length - 1;
  mountChips(document.getElementById("tl-chips"), TL_ITEMS, hidden.tl, drawTimeline, { min: 1 });
  mountExport(document.getElementById("x-timeline"), {
    name: "australian-federal-elections-1901-2025-vote-shares", title: "Labor and non-Labor vote, 1901–2025",
    subtitle: "Two-party-preferred and first-preference shares, House of Representatives",
    png: () => svgToPngBlob(document.getElementById("timeline"), "Labor and non-Labor vote, 1901–2025", "Two-party-preferred and first-preference shares, House of Representatives"),
    csv: () => [["Year", "Date", "Prime minister", "Government", "Labor 2PP %", "Coalition/non-Labor 2PP %", "2PP source", "Labor first preferences %", "Non-Labor first preferences %"],
      ...tlSeries().map(s => [s.e.year, s.e.date, s.e.pm, s.e.govt, s.alp2pp == null ? "" : s.alp2pp.toFixed(2), s.coal2pp == null ? "" : s.coal2pp.toFixed(2), s.e.tpp ? s.e.tpp.source : "", s.alpfp.toFixed(2), s.nlfp.toFixed(2)])]
  });
  drawTimeline();
  if (!applyHash()) { current = DATA.length - 1; showView("flows", true); }
}
start();
