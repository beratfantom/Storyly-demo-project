import { useState, useEffect, useRef, useCallback } from "react";

/*
  STORYLY DEMO PLATFORM — FIXED
  
  Key fix: Clone HTML is rendered in sections. Storyly widgets are
  REACT COMPONENTS placed between sections — not HTML injection.
  This means onClick works, and widgets never overlap content.
  
  Clone HTML split: The API generates HTML with 3 comment markers:
  <!-- SPLIT1 --> <!-- SPLIT2 --> <!-- SPLIT3 -->
  We split on these and render React widgets between the chunks.
*/

/* ═══ i18n ═══ */
const T = {
  en: {
    title: "Storyly Demo Platform",
    sub: "Upload screenshots — AI builds the app clone",
    brandName: "Brand name", brandPh: "e.g. Nike, Sephora, Hepsiburada...",
    colors: "Brand colors", primary: "Primary", accent: "Accent",
    screenshots: "App screenshots",
    screenshotDesc: "Upload 1-3 homepage screenshots. AI will recreate the UI.",
    uploadBtn: "Upload screenshot",
    generate: "Generate App Clone",
    generating: "Building your app clone...",
    steps: ["Compressing images...", "Analyzing app layout...", "Extracting colors & typography...", "Generating scrollable UI...", "Finalizing..."],
    gallery: "Gallery", config: "Config",
    galleryTitle: "Image Gallery",
    galleryDesc: "Upload images to fill widget slots",
    widgets: "Widgets", stickers: "Stickers",
    currentApp: "Current app", withStoryly: "✨ With Storyly",
    tip: "Scroll both phones. Click story circles for full-screen story.",
    error: "Generation failed. Try with clearer screenshots.",
    retry: "Try again", back: "← Back",
  },
  tr: {
    title: "Storyly Demo Platformu",
    sub: "Screenshot yükle — AI uygulama klonunu oluştursun",
    brandName: "Marka adı", brandPh: "örn. Nike, Sephora, Hepsiburada...",
    colors: "Marka renkleri", primary: "Ana renk", accent: "Vurgu",
    screenshots: "Uygulama screenshot'ları",
    screenshotDesc: "1-3 adet ana sayfa screenshot'ı yükle. AI, UI'ı yeniden oluşturacak.",
    uploadBtn: "Screenshot yükle",
    generate: "Uygulama Klonu Oluştur",
    generating: "Uygulama klonu hazırlanıyor...",
    steps: ["Görseller sıkıştırılıyor...", "Layout analiz ediliyor...", "Renkler ve tipografi çıkarılıyor...", "Scrollable UI üretiliyor...", "Tamamlanıyor..."],
    gallery: "Galeri", config: "Ayarlar",
    galleryTitle: "Görsel Galerisi",
    galleryDesc: "Widget slot'larını doldurmak için görsel yükle",
    widgets: "Widget'lar", stickers: "Sticker'lar",
    currentApp: "Mevcut uygulama", withStoryly: "✨ Storyly ile",
    tip: "Telefonları kaydır. Story circle'lara tıkla.",
    error: "Oluşturma başarısız. Daha net screenshot'larla dene.",
    retry: "Tekrar dene", back: "← Geri",
  },
};

/* ═══ COMPRESS ═══ */
function compress(dataUrl, maxW = 700) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, maxW / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.55));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/* ═══ CLAUDE API ═══ */
async function generateClone({ screenshots, brandName, pri, acc }) {
  const imgs = await Promise.all(screenshots.map(s => compress(s)));

  const prompt = `You are a mobile UI engineer. These are screenshots of ${brandName}'s mobile app.

Recreate this app as HTML that fits inside a 170x330px scrollable container. 

RULES:
- ONLY inline styles, div, span elements
- Match layout, colors, typography, spacing exactly
- Include status bar (time), header/logo, tabs, content sections, cards, category banners, bottom nav
- Use emoji for icons (🏠🔍🛒👤)
- For photos use colored divs with emoji placeholders
- Bottom nav: position:sticky;bottom:0;z-index:10
- Keep total HTML under 3500 tokens
- Primary color: ${pri}, Accent: ${acc}

CRITICAL — Insert these EXACT comment markers where content sections meet:
<!-- SPLIT1 --> right after the header/navigation area (before first content)
<!-- SPLIT2 --> after the first content section (hero cards/carousel)  
<!-- SPLIT3 --> in the middle of the content (between categories)

These markers let me inject interactive widgets between sections.

OUTPUT: Raw HTML only. No backticks. Start with <div, end with </div>.`;

  const content = imgs.map(img => ({
    type: "image",
    source: { type: "base64", media_type: "image/jpeg", data: img.split(",")[1] }
  }));
  content.push({ type: "text", text: prompt });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 120000);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 5000, messages: [{ role: "user", content }] }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error("API " + res.status);
    const data = await res.json();
    const html = (data.content || []).find(b => b.type === "text")?.text || "";
    return html.replace(/^```html?\n?/i, "").replace(/\n?```$/i, "").trim();
  } catch (err) {
    clearTimeout(timer);
    throw err.name === "AbortError" ? new Error("Timeout (120s)") : err;
  }
}

/* ═══ SPLIT HTML into chunks ═══ */
function splitClone(html) {
  if (!html) return ["", "", "", ""];
  const parts = html.split(/<!--\s*SPLIT[123]\s*-->/i);
  while (parts.length < 4) parts.push("");
  return parts;
}

/* ═══ GALLERY SLOTS ═══ */
const SLOTS = [
  { id: "logo", cat: "Brand", label: "Logo" },
  { id: "story1", cat: "Stories", label: "Story 1" }, { id: "story2", cat: "Stories", label: "Story 2" },
  { id: "story3", cat: "Stories", label: "Story 3" }, { id: "story4", cat: "Stories", label: "Story 4" },
  { id: "story5", cat: "Stories", label: "Story 5" },
  { id: "vf1", cat: "Video Feed", label: "Video 1" }, { id: "vf2", cat: "Video Feed", label: "Video 2" },
  { id: "vf3", cat: "Video Feed", label: "Video 3" },
  { id: "bannerBg", cat: "Banner", label: "Banner BG" },
  { id: "canvas1", cat: "Canvas", label: "Product 1" }, { id: "canvas2", cat: "Canvas", label: "Product 2" },
  { id: "canvas3", cat: "Canvas", label: "Product 3" }, { id: "canvas4", cat: "Canvas", label: "Product 4" },
  { id: "canvas5", cat: "Canvas", label: "Product 5" }, { id: "canvas6", cat: "Canvas", label: "Product 6" },
];
const GCATS = ["Brand", "Stories", "Video Feed", "Banner", "Canvas"];

/* ═══ STORYLY REACT WIDGETS ═══ */
function Badge({ t }) {
  return <div style={{ position: "absolute", top: -6, right: 6, zIndex: 20, background: "#7c3aed", color: "#fff", fontSize: 5.5, fontWeight: 800, padding: "1.5px 6px", borderRadius: 3, boxShadow: "0 2px 6px rgba(124,58,237,0.45)" }}>Storyly {t}</div>;
}

function WStories({ onTap, gallery, pri, acc }) {
  const names = ["New", "Best", "Sale", "Trend", "For You"];
  const emojis = ["🔥", "⭐", "💰", "💎", "✨"];
  return (
    <div style={{ position: "relative", padding: "7px 7px 4px", background: "rgba(255,255,255,0.98)" }}>
      <Badge t="Stories" />
      <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none" }}>
        {names.map((n, i) => {
          const img = gallery["story" + (i + 1)];
          return (
            <div key={i} onClick={() => onTap()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", flexShrink: 0 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: `linear-gradient(135deg, ${pri}, ${acc})`, padding: 1.5 }}>
                <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {img ? <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 11 }}>{emojis[i]}</span>}
                </div>
              </div>
              <span style={{ fontSize: 5, fontWeight: 600, color: "#333" }}>{n}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WBanner({ gallery, pri, acc }) {
  const bg = gallery.bannerBg;
  return (
    <div style={{ position: "relative", padding: "3px 7px 4px" }}>
      <Badge t="Banner" />
      <div style={{ borderRadius: 7, height: 30, background: bg ? `url(${bg}) center/cover` : `linear-gradient(135deg, ${pri}, ${acc})`, display: "flex", alignItems: "center", padding: "0 9px", overflow: "hidden" }}>
        {bg && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", borderRadius: 7 }} />}
        <div style={{ flex: 1, position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 7, color: "#fff", fontWeight: 800 }}>Limited offer ⏱</div>
          <div style={{ fontSize: 5, color: "rgba(255,255,255,0.65)" }}>Tap to shop exclusive deals</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.2)", padding: "2px 7px", borderRadius: 8, fontSize: 5.5, color: "#fff", fontWeight: 700, flexShrink: 0, position: "relative", zIndex: 1 }}>Shop →</div>
      </div>
    </div>
  );
}

function WVideoFeed({ gallery, pri }) {
  return (
    <div style={{ position: "relative", padding: "5px 7px", background: "rgba(255,255,255,0.98)" }}>
      <Badge t="Video Feed" />
      <div style={{ fontSize: 7, fontWeight: 700, color: "#111", marginBottom: 3 }}>Trending</div>
      <div style={{ display: "flex", gap: 4 }}>
        {[0, 1, 2].map(i => {
          const img = gallery["vf" + (i + 1)];
          return (
            <div key={i} style={{ width: 50, height: 72, borderRadius: 5, background: `linear-gradient(180deg, ${pri}18, ${pri}35)`, position: "relative", overflow: "hidden", flexShrink: 0, border: "1px solid rgba(0,0,0,0.06)" }}>
              {img ? <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 6, color: pri }}>▶</span></div>
                </div>
              )}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.7))", padding: "8px 3px 3px" }}>
                <div style={{ fontSize: 5, color: "#fff", fontWeight: 600 }}>Product</div>
                <div style={{ fontSize: 6, color: "#fff", fontWeight: 800 }}>{"$" + (29 + i * 10) + ".99"}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WCanvas({ gallery, pri }) {
  return (
    <div style={{ position: "relative", padding: "5px 7px", background: "rgba(255,255,255,0.98)" }}>
      <Badge t="Canvas" />
      <div style={{ background: "#f5f5f5", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ padding: "3px 6px 1px", display: "flex", justifyContent: "space-between" }}>
          <span style={{ background: pri, color: "#fff", padding: "1px 5px", borderRadius: 3, fontSize: 5, fontWeight: 700 }}>Canvas</span>
          <span style={{ fontSize: 5, color: "#999" }}>For you</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1.5, padding: "2px 4px 4px" }}>
          {[0, 1, 2, 3, 4, 5].map(i => {
            const img = gallery["canvas" + (i + 1)];
            return (
              <div key={i} style={{ aspectRatio: "3/4", borderRadius: 3, background: `${pri}0a`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {img ? <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 8, opacity: 0.15 }}>📦</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══ PHONE with split clone + React widgets ═══ */
function ClonePhone({ cloneHTML, showStoryly, widgets, gallery, pri, acc, onStory }) {
  const chunks = splitClone(cloneHTML);

  return (
    <div style={{ width: "100%", height: "100%", overflowY: "auto", scrollbarWidth: "none", background: "#fff" }}>
      {/* Chunk 0: Header/nav */}
      <div dangerouslySetInnerHTML={{ __html: chunks[0] }} />

      {/* Storyly Stories — after header */}
      {showStoryly && widgets.stories && <WStories onTap={onStory} gallery={gallery} pri={pri} acc={acc} />}

      {/* Chunk 1: Hero/first content */}
      <div dangerouslySetInnerHTML={{ __html: chunks[1] }} />

      {/* Storyly Banner — after hero */}
      {showStoryly && widgets.banners && <WBanner gallery={gallery} pri={pri} acc={acc} />}

      {/* Chunk 2: Mid content */}
      <div dangerouslySetInnerHTML={{ __html: chunks[2] }} />

      {/* Storyly Video Feed — mid content */}
      {showStoryly && widgets.video_feed && <WVideoFeed gallery={gallery} pri={pri} />}

      {/* Chunk 3: Rest */}
      <div dangerouslySetInnerHTML={{ __html: chunks[3] }} />

      {/* Storyly Canvas — before footer */}
      {showStoryly && widgets.canvas && <WCanvas gallery={gallery} pri={pri} />}

      <div style={{ height: 30 }} />
    </div>
  );
}

/* ═══ STORY OVERLAY — uses story cover images as slide backgrounds ═══ */
function StoryOverlay({ onClose, stickers, gallery, brand, pri, acc }) {
  const [s, setS] = useState(0);
  const [p, setP] = useState(0);
  const tot = 5;
  useEffect(() => { setP(0); const iv = setInterval(() => setP(v => v >= 100 ? (clearInterval(iv), 100) : v + 0.8), 40); return () => clearInterval(iv); }, [s]);

  /* Each slide uses its corresponding story cover image as background */
  const slideBg = gallery["story" + (s + 1)];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 300, height: 640, borderRadius: 38, background: "#000", padding: 6, boxShadow: "0 30px 60px rgba(0,0,0,0.6)" }}>
        <div style={{ width: 288, height: 628, borderRadius: 32, overflow: "hidden", position: "relative" }}>
          {/* Progress */}
          <div style={{ position: "absolute", top: 38, left: 10, right: 10, zIndex: 60, display: "flex", gap: 3 }}>
            {Array.from({ length: tot }).map((_, i) => (
              <div key={i} style={{ flex: 1, height: 2.5, borderRadius: 2, background: "rgba(255,255,255,0.2)", overflow: "hidden" }}>
                <div style={{ height: "100%", background: "#fff", width: i < s ? "100%" : i === s ? p + "%" : "0%", transition: "width 0.04s linear" }} />
              </div>
            ))}
          </div>
          {/* Header */}
          <div style={{ position: "absolute", top: 50, left: 10, right: 10, zIndex: 60, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {gallery.logo ? <img src={gallery.logo} alt="" style={{ width: 20, height: 14, objectFit: "contain" }} /> : <span style={{ fontSize: 12, fontWeight: 800, color: pri }}>{(brand || "B")[0]}</span>}
              </div>
              <div><div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{brand || "Brand"}</div><div style={{ fontSize: 8, color: "rgba(255,255,255,0.5)" }}>Sponsored</div></div>
            </div>
            <div onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff", fontSize: 16, fontWeight: 300 }}>✕</div>
          </div>
          {/* Background: story cover image or gradient */}
          <div style={{ position: "absolute", inset: 0 }}>
            {slideBg ? (
              <>
                <img src={slideBg} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} />
              </>
            ) : (
              <div style={{ position: "absolute", inset: 0, background: `linear-gradient(170deg, ${pri}dd, ${acc}bb)` }} />
            )}
          </div>
          {/* Slide content */}
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "72px 18px 56px", zIndex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
              {s === 0 && (<>
                <div style={{ width: 120, height: 120, borderRadius: 16, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 46, overflow: "hidden", backdropFilter: "blur(6px)" }}>
                  {slideBg ? <img src={slideBg} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 16 }} /> : "📦"}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginTop: 10, textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>Featured Product</div>
                {stickers.product_tag && (
                  <div style={{ marginTop: 12, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(10px)", borderRadius: 12, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, width: "85%" }}>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 9, color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>Product Name</div></div>
                    <div><div style={{ fontSize: 12, color: "#fff", fontWeight: 800 }}>$99.99</div><div style={{ background: "#fff", color: "#000", padding: "2px 8px", borderRadius: 6, fontSize: 7, fontWeight: 700, marginTop: 2 }}>Add to Cart</div></div>
                  </div>
                )}
              </>)}
              {s === 1 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, width: "85%" }}>
                  {[1, 2, 3, 4].map(i => {
                    const cImg = gallery["canvas" + i];
                    return (
                      <div key={i} style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)", borderRadius: 10, padding: "8px", textAlign: "center", overflow: "hidden" }}>
                        <div style={{ width: "100%", height: 50, borderRadius: 6, marginBottom: 3, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.06)" }}>
                          {cImg ? <img src={cImg} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 18 }}>📦</span>}
                        </div>
                        <div style={{ fontSize: 8, color: "#fff", fontWeight: 700 }}>Product {i}</div>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", fontWeight: 800 }}>{"$" + (19 + i * 10) + ".99"}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              {s === 2 && stickers.poll && (
                <div style={{ width: "85%", textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 14, textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>Which do you prefer?</div>
                  {["Option A ✨", "Option B 💫", "Option C 🌟"].map((o, i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", borderRadius: 10, padding: "10px 12px", marginBottom: 5, display: "flex", justifyContent: "space-between", border: i === 0 ? "2px solid rgba(255,255,255,0.4)" : "none" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{o}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>{["52%", "31%", "17%"][i]}</span>
                    </div>
                  ))}
                </div>
              )}
              {s === 2 && !stickers.poll && <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>Discover More</div>}
              {s === 3 && stickers.emoji && (
                <div style={{ width: "85%", textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 20, textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>How much do you love it?</div>
                  <div style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", borderRadius: 20, height: 36, position: "relative" }}>
                    <div style={{ height: 4, background: `linear-gradient(90deg, ${pri}, ${acc})`, borderRadius: 2, position: "absolute", top: "50%", transform: "translateY(-50%)", left: 14, width: "65%" }} />
                    <div style={{ position: "absolute", left: "65%", top: "50%", transform: "translate(-50%, -50%)", fontSize: 28 }}>😍</div>
                  </div>
                </div>
              )}
              {s === 3 && !stickers.emoji && <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>Explore</div>}
              {s === 4 && (
                <div style={{ width: "85%", textAlign: "center" }}>
                  {stickers.countdown && (
                    <div style={{ display: "flex", justifyContent: "center", gap: 7, marginBottom: 14 }}>
                      {[{ v: "02", l: "D" }, { v: "14", l: "H" }, { v: "30", l: "M" }, { v: "00", l: "S" }].map(x => (
                        <div key={x.l} style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(8px)", borderRadius: 10, padding: "6px 8px", minWidth: 40 }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{x.v}</div>
                          <div style={{ fontSize: 5, color: "rgba(255,255,255,0.4)" }}>{x.l}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 10, textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>Limited Time</div>
                  {stickers.cta && <div style={{ background: "#fff", color: "#000", padding: "10px 24px", borderRadius: 24, fontSize: 12, fontWeight: 800, display: "inline-block", cursor: "pointer" }}>Shop Now →</div>}
                </div>
              )}
            </div>
          </div>
          {/* Tap zones */}
          <div onClick={() => s > 0 && setS(s - 1)} style={{ position: "absolute", left: 0, top: 80, bottom: 50, width: "25%", zIndex: 55, cursor: "pointer" }} />
          <div onClick={() => { if (s < tot - 1) setS(s + 1); else onClose(); }} style={{ position: "absolute", right: 0, top: 80, bottom: 50, width: "75%", zIndex: 55, cursor: "pointer" }} />
        </div>
      </div>
    </div>
  );
}

/* ═══ GALLERY PANEL ═══ */
function GalleryPanel({ gallery, setGallery }) {
  const [openCat, setOpenCat] = useState("Stories");
  const upload = (id) => { const i = document.createElement("input"); i.type = "file"; i.accept = "image/*"; i.onchange = e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => setGallery(g => ({ ...g, [id]: ev.target.result })); r.readAsDataURL(f); }; i.click(); };
  return (
    <div>{GCATS.map(cat => {
      const slots = SLOTS.filter(s => s.cat === cat);
      const filled = slots.filter(s => gallery[s.id]).length;
      const isOpen = openCat === cat;
      return (<div key={cat} style={{ marginBottom: 3 }}>
        <div onClick={() => setOpenCat(isOpen ? null : cat)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 7px", borderRadius: 6, background: isOpen ? "rgba(124,58,237,0.06)" : "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)", cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ fontSize: 9, fontWeight: 700, color: isOpen ? "#c4b5fd" : "#888" }}>{cat}</span><span style={{ fontSize: 7, color: filled > 0 ? "#059669" : "#555" }}>{filled}/{slots.length}</span></div>
          <span style={{ fontSize: 9, color: "#555", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>›</span>
        </div>
        {isOpen && (<div style={{ padding: "3px 0 0 6px" }}>{slots.map(slot => (
          <div key={slot.id} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2, padding: "2px 4px", borderRadius: 4 }}>
            <div onClick={() => upload(slot.id)} style={{ width: 24, height: 24, borderRadius: 3, border: "1px dashed rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", flexShrink: 0 }}>
              {gallery[slot.id] ? <img src={gallery[slot.id]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 9, color: "#555" }}>+</span>}
            </div>
            <span style={{ fontSize: 8, fontWeight: 600, color: gallery[slot.id] ? "#c4b5fd" : "#888", flex: 1 }}>{slot.label}</span>
            {gallery[slot.id] && <div onClick={() => setGallery(g => { const n = { ...g }; delete n[slot.id]; return n; })} style={{ fontSize: 7, color: "#ef4444", cursor: "pointer" }}>✕</div>}
          </div>
        ))}</div>)}
      </div>);
    })}</div>
  );
}

/* ═══ PHONE FRAME ═══ */
function PF({ children, label, hl }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: hl ? "#c4b5fd" : "#666", padding: "3px 10px", borderRadius: 10, background: hl ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.04)", border: hl ? "1px solid rgba(124,58,237,0.2)" : "1px solid rgba(255,255,255,0.05)" }}>{label}</div>
      <div style={{ width: 178, height: 370, borderRadius: 24, background: "#000", padding: 4, boxShadow: "0 16px 36px rgba(0,0,0,0.45)" }}>
        <div style={{ width: 170, height: 362, borderRadius: 20, overflow: "hidden", position: "relative", background: "#fff" }}>{children}</div>
      </div>
    </div>
  );
}

/* ═══ MAIN ═══ */
export default function App() {
  const [lang, setLang] = useState("en");
  const t = T[lang];
  const [step, setStep] = useState(0);
  const [brand, setBrand] = useState("");
  const [pri, setPri] = useState("#111111");
  const [acc, setAcc] = useState("#7c3aed");
  const [screenshots, setScreenshots] = useState([]);
  const [cloneHTML, setCloneHTML] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadStep, setLoadStep] = useState(0);
  const [error, setError] = useState(null);
  const [gallery, setGallery] = useState({});
  const [tab, setTab] = useState("gallery");
  const [storyOpen, setStoryOpen] = useState(false);
  const [w, setW] = useState({ stories: true, banners: true, video_feed: true, canvas: true });
  const [st, setSt] = useState({ product_tag: true, poll: true, emoji: true, countdown: true, cta: true });
  const fileRef = useRef();

  const addSS = (files) => { Array.from(files || []).forEach(f => { if (!f.type.startsWith("image/")) return; const r = new FileReader(); r.onload = e => setScreenshots(s => [...s.slice(0, 2), e.target.result]); r.readAsDataURL(f); }); };

  const doGenerate = async () => {
    if (!screenshots.length || !brand) return;
    setLoading(true); setError(null); setLoadStep(0); setStep(1);
    const iv = setInterval(() => setLoadStep(s => Math.min(s + 1, 4)), 4000);
    try {
      const html = await generateClone({ screenshots, brandName: brand, pri, acc });
      if (!html || html.length < 30) throw new Error("Empty response");
      setCloneHTML(html); setLoadStep(4);
      setTimeout(() => { setStep(2); setLoading(false); }, 600);
    } catch (err) { setError(err.message); setLoading(false); setStep(0); }
    finally { clearInterval(iv); }
  };

  const sec = { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "12px 14px", marginBottom: 8 };
  const inp = { width: "100%", padding: "7px 10px", borderRadius: 7, fontSize: 11, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#e0ddf0", outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  const btnS = { width: "100%", padding: "11px", borderRadius: 9, border: "none", background: "linear-gradient(135deg, #7c3aed, #a855f7)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
  const ch = (a) => ({ padding: "5px 8px", borderRadius: 7, cursor: "pointer", background: a ? "rgba(124,58,237,0.1)" : "rgba(255,255,255,0.015)", border: a ? "1.5px solid rgba(124,58,237,0.2)" : "1.5px solid rgba(255,255,255,0.03)", display: "flex", alignItems: "center", gap: 5 });

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #0a0a12 0%, #12122a 50%, #0a0a12 100%)", fontFamily: "-apple-system,'Helvetica Neue',sans-serif", color: "#d8d5e8" }}>
      <div style={{ padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg, #7c3aed, #a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff" }}>S</div>
          <div><div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{t.title}</div><div style={{ fontSize: 7, color: "#555" }}>{t.sub}</div></div>
        </div>
        <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: 2 }}>
          {["en", "tr"].map(l => (<div key={l} onClick={() => setLang(l)} style={{ padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 600, cursor: "pointer", background: lang === l ? "rgba(124,58,237,0.2)" : "transparent", color: lang === l ? "#c4b5fd" : "#666" }}>{l.toUpperCase()}</div>))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, padding: "12px 18px", alignItems: "flex-start", flexWrap: "wrap", justifyContent: "center" }}>
        <div style={{ flex: "1 1 260px", maxWidth: 340, minWidth: 240 }}>
          {step === 0 && (<>
            <div style={sec}><div style={{ fontSize: 12, fontWeight: 700, color: "#e0ddf0", marginBottom: 6 }}>{t.brandName}</div><input value={brand} onChange={e => setBrand(e.target.value)} placeholder={t.brandPh} style={inp} /></div>
            <div style={sec}><div style={{ fontSize: 12, fontWeight: 700, color: "#e0ddf0", marginBottom: 6 }}>{t.colors}</div><div style={{ display: "flex", gap: 14 }}>{[{ l: t.primary, v: pri, s: setPri }, { l: t.accent, v: acc, s: setAcc }].map(c => (<div key={c.l} style={{ display: "flex", alignItems: "center", gap: 5 }}><input type="color" value={c.v} onChange={e => c.s(e.target.value)} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", padding: 0, background: "none" }} /><span style={{ fontSize: 10, color: "#999" }}>{c.l}</span></div>))}</div></div>
            <div style={sec}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#e0ddf0", marginBottom: 4 }}>{t.screenshots}</div>
              <div style={{ fontSize: 9, color: "#666", marginBottom: 8 }}>{t.screenshotDesc}</div>
              {screenshots.length > 0 && (<div style={{ display: "flex", gap: 4, marginBottom: 6 }}>{screenshots.map((ss, i) => (<div key={i} style={{ position: "relative" }}><img src={ss} alt="" style={{ width: 56, height: 100, objectFit: "cover", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)" }} /><div onClick={() => setScreenshots(s => s.filter((_, j) => j !== i))} style={{ position: "absolute", top: -4, right: -4, width: 14, height: 14, borderRadius: "50%", background: "#ef4444", color: "#fff", fontSize: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>✕</div></div>))}</div>)}
              {screenshots.length < 3 && (<div onClick={() => fileRef.current?.click()} style={{ border: "2px dashed rgba(255,255,255,0.08)", borderRadius: 9, padding: 12, textAlign: "center", cursor: "pointer" }}><div style={{ fontSize: 18, opacity: 0.3 }}>📱</div><div style={{ fontSize: 10, fontWeight: 600, color: "#888" }}>{t.uploadBtn}</div></div>)}
              <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => addSS(e.target.files)} />
            </div>
            {error && (<div style={{ ...sec, borderColor: "rgba(239,68,68,0.2)" }}><div style={{ fontSize: 10, color: "#ef4444" }}>{t.error}</div><div style={{ fontSize: 8, color: "#888", wordBreak: "break-all" }}>{error}</div></div>)}
            <button onClick={doGenerate} disabled={!screenshots.length || !brand} style={{ ...btnS, opacity: screenshots.length && brand ? 1 : 0.4 }}>{t.generate}</button>
          </>)}

          {step === 1 && (
            <div style={{ ...sec, textAlign: "center", padding: "28px 20px" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #7c3aed, #a855f7)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <div style={{ width: 18, height: 18, border: "2.5px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 10 }}>{t.generating}</div>
              {t.steps.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, opacity: i <= loadStep ? 1 : 0.25, transition: "opacity 0.4s" }}>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", background: i < loadStep ? "#059669" : i === loadStep ? "#7c3aed" : "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, color: "#fff", flexShrink: 0 }}>{i < loadStep ? "✓" : ""}</div>
                  <span style={{ fontSize: 10, color: i <= loadStep ? "#ccc" : "#555" }}>{s}</span>
                </div>
              ))}
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {step === 2 && (<>
            <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.03)", borderRadius: 7, padding: 2, marginBottom: 8 }}>
              {[{ id: "gallery", l: "🖼 " + t.gallery }, { id: "config", l: "⚙ " + t.config }].map(tb => (
                <div key={tb.id} onClick={() => setTab(tb.id)} style={{ flex: 1, padding: "5px", borderRadius: 5, fontSize: 9, fontWeight: 600, cursor: "pointer", textAlign: "center", background: tab === tb.id ? "rgba(124,58,237,0.15)" : "transparent", color: tab === tb.id ? "#c4b5fd" : "#555" }}>{tb.l}</div>
              ))}
            </div>
            {tab === "gallery" && (<div style={sec}><div style={{ fontSize: 12, fontWeight: 700, color: "#e0ddf0", marginBottom: 4 }}>{t.galleryTitle}</div><div style={{ fontSize: 8, color: "#555", marginBottom: 6 }}>{t.galleryDesc}</div><GalleryPanel gallery={gallery} setGallery={setGallery} /></div>)}
            {tab === "config" && (<>
              <div style={sec}><div style={{ fontSize: 12, fontWeight: 700, color: "#e0ddf0", marginBottom: 6 }}>{t.widgets}</div>
                {[{ id: "stories", l: "Stories" }, { id: "banners", l: "Banners" }, { id: "video_feed", l: "Video Feed" }, { id: "canvas", l: "Canvas" }].map(x => (
                  <div key={x.id} onClick={() => setW(v => ({ ...v, [x.id]: !v[x.id] }))} style={{ ...ch(w[x.id]), marginBottom: 2 }}><span style={{ fontSize: 10, fontWeight: 600, color: w[x.id] ? "#c4b5fd" : "#666", flex: 1 }}>{x.l}</span><div style={{ width: 14, height: 14, borderRadius: 3, background: w[x.id] ? "#7c3aed" : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9 }}>{w[x.id] ? "✓" : ""}</div></div>
                ))}</div>
              <div style={sec}><div style={{ fontSize: 12, fontWeight: 700, color: "#e0ddf0", marginBottom: 6 }}>{t.stickers}</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
                {[{ id: "product_tag", l: "Cart", i: "🛒" }, { id: "poll", l: "Poll", i: "📊" }, { id: "emoji", l: "Emoji", i: "😍" }, { id: "countdown", l: "Timer", i: "⏱" }, { id: "cta", l: "CTA", i: "👆" }].map(x => (
                  <div key={x.id} onClick={() => setSt(v => ({ ...v, [x.id]: !v[x.id] }))} style={{ ...ch(st[x.id]), padding: "4px 6px" }}><span style={{ fontSize: 10 }}>{x.i}</span><span style={{ fontSize: 8, fontWeight: 600, color: st[x.id] ? "#c4b5fd" : "#666" }}>{x.l}</span></div>
                ))}</div></div>
            </>)}
            <button onClick={() => { setStep(0); setCloneHTML(""); }} style={{ ...btnS, background: "rgba(255,255,255,0.06)", fontSize: 10, marginTop: 4 }}>{t.back}</button>
            <div style={{ fontSize: 8, color: "#555", textAlign: "center", marginTop: 6 }}>{t.tip}</div>
          </>)}
        </div>

        {step === 2 && cloneHTML && (
          <div style={{ flex: "0 0 auto", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <PF label={t.currentApp} hl={false}>
              <ClonePhone cloneHTML={cloneHTML} showStoryly={false} widgets={w} gallery={gallery} pri={pri} acc={acc} onStory={() => {}} />
            </PF>
            <PF label={t.withStoryly} hl={true}>
              <ClonePhone cloneHTML={cloneHTML} showStoryly={true} widgets={w} gallery={gallery} pri={pri} acc={acc} onStory={() => setStoryOpen(true)} />
            </PF>
          </div>
        )}
      </div>

      {storyOpen && <StoryOverlay onClose={() => setStoryOpen(false)} stickers={st} gallery={gallery} brand={brand} pri={pri} acc={acc} />}
    </div>
  );
}
