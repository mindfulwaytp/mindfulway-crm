import { useState, useEffect, useCallback } from "react";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../lib/firebase";
import { fetchWikiPages, saveWikiPage, deleteWikiPage } from "../lib/wikiApi";

const EMPTY_DRAFT = {
  title: "",
  category: "",
  status: "",
  statusColor: "blue",
  sections: [{ heading: "", body: "", callout: false, images: [] }],
};

// Rendered pixel widths for the three image size options.
const IMG_WIDTHS = { small: 180, medium: 340, full: "100%" };

// Compute an image's style from its saved { width, align }. A "full"-width
// image is always a centered block; small/medium images float so text wraps.
function imageStyle(img) {
  const w = IMG_WIDTHS[img.width] || IMG_WIDTHS.medium;
  if (img.width === "full") {
    return { display: "block", width: "100%", maxWidth: "100%", height: "auto", borderRadius: 6, margin: "6px 0 14px" };
  }
  const base = { width: w, maxWidth: "100%", height: "auto", borderRadius: 6 };
  if (img.align === "left") return { ...base, float: "left", margin: "4px 18px 10px 0" };
  if (img.align === "right") return { ...base, float: "right", margin: "4px 0 10px 18px" };
  return { ...base, display: "block", margin: "6px auto 14px" }; // center
}

function slugify(text) {
  const s = (text || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return s || "page";
}

// ── Seed pages ─────────────────────────────────────────────────
// Intentionally empty — the knowledge base starts blank and is built entirely
// from pages created in-app (stored in Firestore). Any entries added here would
// appear as built-in, non-deletable default pages.
const SEED_PAGES = {};

// ── Styles ──────────────────────────────────────────────────────
const STATUS_COLORS = {
  blue:  { bg: "#D4E4F7", text: "#2A5B8C" },
  amber: { bg: "#F5E6C8", text: "#7A5C1E" },
  green: { bg: "#D4EDDA", text: "#276738" },
  red:   { bg: "#F5D4D4", text: "#8C2A2A" },
};

// ── Main Component ─────────────────────────────────────────────
export default function CRMWiki({ canEdit = false }) {
  const [pages, setPages] = useState(SEED_PAGES);
  const [firestoreIds, setFirestoreIds] = useState(() => new Set());
  const [activePage, setActivePage] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editor, setEditor] = useState(null); // null | { mode: "create" | "edit", draft }
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  // Load pages from Firestore and overlay them on the built-in seed pages.
  const loadPages = useCallback(async () => {
    try {
      const docs = await fetchWikiPages();
      const overrides = {};
      docs.forEach((d) => { overrides[d.id] = d; });
      const merged = { ...SEED_PAGES, ...overrides };
      setFirestoreIds(new Set(docs.map((d) => d.id)));
      setPages(merged);
      // Keep the current selection if it still exists, otherwise land on the first page.
      setActivePage((prev) => (prev && merged[prev] ? prev : (Object.keys(merged)[0] || "")));
    } catch (e) {
      console.error("Failed to load wiki pages:", e);
    }
  }, []);

  useEffect(() => { loadPages(); }, [loadPages]);

  // Group filtered pages by category for the sidebar
  const categories = {};
  const filteredPages = Object.values(pages).filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const searchable = p.title + " " + (p.sections || []).map(s => (s.heading || "") + " " + s.body).join(" ");
    return searchable.toLowerCase().includes(q);
  });
  filteredPages.forEach(p => {
    if (!categories[p.category]) categories[p.category] = [];
    categories[p.category].push(p);
  });

  const categoryOptions = [...new Set(Object.values(pages).map(p => p.category).filter(Boolean))].sort();
  const current = pages[activePage];

  // ── Manual page editor ─────────────────────────────────────
  function openCreate() {
    setSaveError("");
    setEditor({ mode: "create", draft: JSON.parse(JSON.stringify(EMPTY_DRAFT)) });
  }

  function openEdit() {
    if (!current) return;
    setSaveError("");
    setEditor({
      mode: "edit",
      draft: {
        id: current.id,
        title: current.title || "",
        category: current.category || "",
        status: current.status || "",
        statusColor: current.statusColor || "blue",
        sections: (current.sections || []).map(s => ({
          heading: s.heading || "",
          body: s.body || "",
          callout: !!s.callout,
          images: (s.images || []).map(im => ({ url: im.url, width: im.width || "medium", align: im.align || "center" })),
        })),
      },
    });
  }

  function updateDraft(field, value) {
    setEditor(e => ({ ...e, draft: { ...e.draft, [field]: value } }));
  }

  function updateSection(idx, field, value) {
    setEditor(e => ({
      ...e,
      draft: { ...e.draft, sections: e.draft.sections.map((s, i) => (i === idx ? { ...s, [field]: value } : s)) },
    }));
  }

  function addSection() {
    setEditor(e => ({ ...e, draft: { ...e.draft, sections: [...e.draft.sections, { heading: "", body: "", callout: false, images: [] }] } }));
  }

  function removeSection(idx) {
    setEditor(e => ({ ...e, draft: { ...e.draft, sections: e.draft.sections.filter((_, i) => i !== idx) } }));
  }

  // ── Section images ─────────────────────────────────────────
  async function handleImageUpload(sectionIdx, file) {
    if (!file) return;
    setUploadingImage(true);
    setSaveError("");
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileRef = storageRef(storage, `wiki-images/${Date.now()}-${safeName}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      setEditor(e => ({
        ...e,
        draft: {
          ...e.draft,
          sections: e.draft.sections.map((s, i) =>
            i === sectionIdx
              ? { ...s, images: [...(s.images || []), { url, width: "medium", align: "center" }] }
              : s
          ),
        },
      }));
    } catch (err) {
      console.error(err);
      setSaveError(`Image upload failed: ${err?.message || "please try again"}.`);
    } finally {
      setUploadingImage(false);
    }
  }

  function updateImage(sectionIdx, imgIdx, field, value) {
    setEditor(e => ({
      ...e,
      draft: {
        ...e.draft,
        sections: e.draft.sections.map((s, i) =>
          i === sectionIdx
            ? { ...s, images: s.images.map((im, j) => (j === imgIdx ? { ...im, [field]: value } : im)) }
            : s
        ),
      },
    }));
  }

  function removeImage(sectionIdx, imgIdx) {
    setEditor(e => ({
      ...e,
      draft: {
        ...e.draft,
        sections: e.draft.sections.map((s, i) =>
          i === sectionIdx ? { ...s, images: s.images.filter((_, j) => j !== imgIdx) } : s
        ),
      },
    }));
  }

  function moveImage(sectionIdx, imgIdx, dir) {
    setEditor(e => ({
      ...e,
      draft: {
        ...e.draft,
        sections: e.draft.sections.map((s, i) => {
          if (i !== sectionIdx) return s;
          const images = [...s.images];
          const target = imgIdx + dir;
          if (target < 0 || target >= images.length) return s;
          [images[imgIdx], images[target]] = [images[target], images[imgIdx]];
          return { ...s, images };
        }),
      },
    }));
  }

  async function handleSave() {
    const draft = editor.draft;
    const title = draft.title.trim();
    if (!title) { setSaveError("Title is required."); return; }

    const sections = draft.sections
      .map(s => ({
        heading: s.heading.trim() ? s.heading.trim() : null,
        body: s.body,
        callout: !!s.callout,
        images: (s.images || []).map(im => ({ url: im.url, width: im.width || "medium", align: im.align || "center" })),
      }))
      .filter(s => s.heading || (s.body && s.body.trim()) || (s.images && s.images.length));

    const page = {
      title,
      category: draft.category.trim() || "Uncategorized",
      status: draft.status.trim() || "Page",
      statusColor: draft.statusColor || "blue",
      sections: sections.length ? sections : [{ heading: null, body: "", callout: false, images: [] }],
    };

    let id;
    if (editor.mode === "edit") {
      id = draft.id;
    } else {
      id = slugify(title);
      const existing = new Set(Object.keys(pages));
      if (existing.has(id)) {
        let n = 2;
        while (existing.has(`${id}-${n}`)) n++;
        id = `${id}-${n}`;
      }
    }

    setSaving(true);
    setSaveError("");
    try {
      await saveWikiPage(id, page);
      await loadPages();
      setActivePage(id);
      setEditor(null);
    } catch (e) {
      console.error(e);
      setSaveError(e?.message || "Could not save the page. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!current) return;
    const id = current.id;
    const isSeed = !!SEED_PAGES[id];
    const hasOverride = firestoreIds.has(id);
    if (isSeed && !hasOverride) return; // built-in default with no edits — nothing to remove

    const msg = isSeed
      ? "Revert this page to its built-in default? Your edits will be discarded."
      : "Delete this page? This cannot be undone.";
    if (!window.confirm(msg)) return;

    try {
      await deleteWikiPage(id);
      await loadPages(); // reselects a remaining page (or clears if none left)
    } catch (e) {
      console.error(e);
      window.alert(e?.message || "Could not delete the page.");
    }
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div style={S.root}>
      {/* Mobile overlay */}
      {sidebarOpen && <div style={S.overlay} onClick={() => setSidebarOpen(false)} />}

      {/* Mobile toggle */}
      <button style={S.mobileToggle} onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>

      {/* ── SIDEBAR ── */}
      <aside style={{ ...S.sidebar, ...(sidebarOpen ? S.sidebarOpen : {}) }}>
        <div style={S.sidebarHeader}>
          <div style={S.sidebarTitle}>Practice CRM</div>
          <div style={S.sidebarSub}>Knowledge Base</div>
        </div>

        <div style={S.sidebarSearch}>
          <input
            style={S.sidebarSearchInput}
            placeholder="Search…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <nav style={S.nav}>
          {Object.entries(categories).map(([cat, items]) => (
            <div key={cat}>
              <div style={S.navLabel}>{cat}</div>
              {items.map(p => (
                <div
                  key={p.id}
                  style={{ ...S.navItem, ...(activePage === p.id ? S.navItemActive : {}) }}
                  onClick={() => { setActivePage(p.id); setSidebarOpen(false); }}
                >
                  {p.title}
                </div>
              ))}
            </div>
          ))}
        </nav>

        {canEdit && (
          <div style={S.sidebarFooter}>
            <button style={S.aiBtn} onClick={openCreate}>
              + New Page
            </button>
          </div>
        )}
      </aside>

      {/* ── MAIN ── */}
      <main style={S.main}>
        {current ? (
          <>
            {/* Page header */}
            <div style={S.pageHeader}>
              <div style={S.pageHeaderTop}>
                <h1 style={S.pageTitle}>{current.title}</h1>
                {canEdit && (
                  <div style={S.pageActions}>
                    <button style={S.editBtn} onClick={openEdit}>
                      ✎ Edit
                    </button>
                    {(!SEED_PAGES[current.id] || firestoreIds.has(current.id)) && (
                      <button
                        style={S.deleteBtn}
                        onClick={handleDelete}
                        title={SEED_PAGES[current.id] ? "Revert to built-in default" : "Delete page"}
                      >
                        {SEED_PAGES[current.id] ? "Revert" : "✕"}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div style={S.pageMeta}>
                <span style={{
                  ...S.tag,
                  background: STATUS_COLORS[current.statusColor]?.bg,
                  color: STATUS_COLORS[current.statusColor]?.text
                }}>
                  {current.status}
                </span>
                <span style={S.metaText}>{current.category}</span>
              </div>
            </div>

            {/* Page sections */}
            {current.sections.map((sec, i) => (
              <div key={i} style={sec.callout ? S.callout : S.section}>
                {sec.heading && <h2 style={S.sectionHeading}>{sec.heading}</h2>}
                {/* overflow:hidden contains the floated images (clearfix) */}
                <div style={{ ...S.sectionBody, overflow: "hidden" }}>
                  {(sec.images || []).map((img, k) => (
                    <img key={k} src={img.url} alt="" style={imageStyle(img)} />
                  ))}
                  {(sec.body || "").split("\n").map((line, j) => (
                    <p key={j} style={S.bodyLine}>{line}</p>
                  ))}
                </div>
              </div>
            ))}
          </>
        ) : (
          <div style={S.empty}>
            {canEdit ? "Select a page from the sidebar, or create a new one." : "Select a page from the sidebar."}
          </div>
        )}
      </main>

      {/* ── PAGE EDITOR MODAL ── */}
      {editor && (
        <div style={S.modalOverlay} onClick={() => !saving && setEditor(null)}>
          <div style={S.editorModal} onClick={e => e.stopPropagation()}>
            <h2 style={S.modalTitle}>{editor.mode === "create" ? "New Page" : "Edit Page"}</h2>

            <label style={S.fieldLabel}>Title</label>
            <input
              style={S.input}
              value={editor.draft.title}
              onChange={e => updateDraft("title", e.target.value)}
              placeholder="Page title"
              autoFocus
            />

            <div style={S.fieldRow}>
              <div style={{ flex: 1 }}>
                <label style={S.fieldLabel}>Category</label>
                <input
                  style={S.input}
                  list="wiki-categories"
                  value={editor.draft.category}
                  onChange={e => updateDraft("category", e.target.value)}
                  placeholder="e.g. Operations"
                />
                <datalist id="wiki-categories">
                  {categoryOptions.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div style={{ width: 150 }}>
                <label style={S.fieldLabel}>Status label</label>
                <input
                  style={S.input}
                  value={editor.draft.status}
                  onChange={e => updateDraft("status", e.target.value)}
                  placeholder="e.g. Active"
                />
              </div>
              <div style={{ width: 120 }}>
                <label style={S.fieldLabel}>Color</label>
                <select style={S.input} value={editor.draft.statusColor} onChange={e => updateDraft("statusColor", e.target.value)}>
                  <option value="blue">Blue</option>
                  <option value="amber">Amber</option>
                  <option value="green">Green</option>
                  <option value="red">Red</option>
                </select>
              </div>
            </div>

            <div style={S.sectionsHeader}>
              <label style={S.fieldLabel}>Sections</label>
              <button style={S.smallBtn} onClick={addSection}>+ Add section</button>
            </div>

            {editor.draft.sections.map((sec, i) => (
              <div key={i} style={S.sectionEditor}>
                <div style={S.sectionEditorTop}>
                  <input
                    style={{ ...S.input, flex: 1, marginBottom: 0 }}
                    value={sec.heading}
                    onChange={e => updateSection(i, "heading", e.target.value)}
                    placeholder="Section heading (optional)"
                  />
                  <label style={S.calloutLabel}>
                    <input type="checkbox" checked={sec.callout} onChange={e => updateSection(i, "callout", e.target.checked)} />
                    Callout
                  </label>
                  {editor.draft.sections.length > 1 && (
                    <button style={S.removeBtn} onClick={() => removeSection(i)} title="Remove section">✕</button>
                  )}
                </div>
                <textarea
                  style={S.textarea}
                  rows={4}
                  value={sec.body}
                  onChange={e => updateSection(i, "body", e.target.value)}
                  placeholder="Body text. New lines become paragraphs; start a line with • for a bullet."
                />

                {/* Section images */}
                <div style={S.imagesHeader}>
                  <span style={S.imagesLabel}>Images</span>
                  <label style={{ ...S.smallBtn, opacity: uploadingImage ? 0.6 : 1 }}>
                    {uploadingImage ? "Uploading…" : "+ Add image"}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingImage}
                      style={{ display: "none" }}
                      onChange={e => { handleImageUpload(i, e.target.files[0]); e.target.value = ""; }}
                    />
                  </label>
                </div>

                {(sec.images || []).map((img, k) => (
                  <div key={k} style={S.imageRow}>
                    <img src={img.url} alt="" style={S.imageThumb} />
                    <div style={S.imageControls}>
                      <div style={S.controlGroup}>
                        <span style={S.controlLabel}>Size</span>
                        {["small", "medium", "full"].map(w => (
                          <button
                            key={w}
                            style={img.width === w ? S.segBtnActive : S.segBtn}
                            onClick={() => updateImage(i, k, "width", w)}
                          >
                            {w === "small" ? "S" : w === "medium" ? "M" : "Full"}
                          </button>
                        ))}
                      </div>
                      <div style={S.controlGroup}>
                        <span style={S.controlLabel}>Align</span>
                        {["left", "center", "right"].map(a => (
                          <button
                            key={a}
                            style={img.align === a ? S.segBtnActive : S.segBtn}
                            title={img.width === "full" ? "Full-width images are always centered" : `Align ${a}`}
                            onClick={() => updateImage(i, k, "align", a)}
                          >
                            {a === "left" ? "◧" : a === "center" ? "▣" : "◨"}
                          </button>
                        ))}
                      </div>
                      <div style={S.controlGroup}>
                        <button style={S.segBtn} onClick={() => moveImage(i, k, -1)} disabled={k === 0} title="Move up">↑</button>
                        <button style={S.segBtn} onClick={() => moveImage(i, k, 1)} disabled={k === sec.images.length - 1} title="Move down">↓</button>
                        <button style={S.removeBtn} onClick={() => removeImage(i, k)} title="Remove image">✕</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {saveError && <div style={S.error}>{saveError}</div>}

            <div style={S.modalActions}>
              <button style={S.cancelBtn} onClick={() => setEditor(null)} disabled={saving}>
                Cancel
              </button>
              <button
                style={{ ...S.generateBtn, opacity: saving ? 0.6 : 1 }}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save Page"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles object ───────────────────────────────────────────────
const S = {
  root: {
    display: "flex",
    minHeight: "100vh",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    background: "#F7F6F3",
    color: "#2C2B28",
    position: "relative",
  },

  // Sidebar
  sidebar: {
    width: 256,
    minWidth: 256,
    background: "#2C2B28",
    color: "#C8C5BE",
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    position: "sticky",
    top: 0,
    zIndex: 100,
    overflowY: "auto",
  },
  sidebarOpen: { position: "fixed", left: 0, top: 0, bottom: 0 },
  sidebarHeader: { padding: "22px 18px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)" },
  sidebarTitle: { fontSize: 17, fontWeight: 700, color: "#fff", letterSpacing: -0.3 },
  sidebarSub: { fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, opacity: 0.45, marginTop: 2 },
  sidebarSearch: { padding: "10px 14px 4px" },
  sidebarSearchInput: {
    width: "100%", padding: "7px 10px", background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5, color: "#ddd",
    fontSize: 13, outline: "none", fontFamily: "inherit",
  },
  nav: { flex: 1, padding: "6px 0", overflowY: "auto" },
  navLabel: {
    fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5,
    color: "rgba(200,197,190,0.35)", padding: "14px 18px 4px", fontWeight: 600,
  },
  navItem: {
    padding: "7px 18px", fontSize: 13.5, cursor: "pointer",
    borderLeft: "3px solid transparent", transition: "background 0.12s",
  },
  navItemActive: {
    background: "rgba(61,122,104,0.18)", color: "#fff",
    borderLeftColor: "#3D7A68",
  },
  sidebarFooter: { padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.07)" },
  aiBtn: {
    width: "100%", padding: "9px 0", background: "#3D7A68", color: "#fff",
    border: "none", borderRadius: 5, fontSize: 13, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit",
  },

  // Main
  main: { flex: 1, minWidth: 0, padding: "32px 40px 80px", maxWidth: 820 },
  pageHeader: { marginBottom: 28 },
  pageHeaderTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  pageTitle: { fontSize: 26, fontWeight: 700, letterSpacing: -0.4, margin: 0, lineHeight: 1.25 },
  pageActions: { display: "flex", gap: 6, flexShrink: 0, marginTop: 4 },
  editBtn: {
    padding: "5px 12px", background: "transparent", border: "1px solid #D8D5CF",
    borderRadius: 5, fontSize: 12.5, cursor: "pointer", color: "#6B6963",
    fontFamily: "inherit", whiteSpace: "nowrap",
  },
  deleteBtn: {
    padding: "5px 8px", background: "transparent", border: "1px solid #D8D5CF",
    borderRadius: 5, fontSize: 12.5, cursor: "pointer", color: "#B0524D",
    fontFamily: "inherit",
  },
  pageMeta: { display: "flex", alignItems: "center", gap: 12, marginTop: 10 },
  tag: {
    display: "inline-block", fontSize: 11, fontWeight: 600,
    padding: "2px 8px", borderRadius: 3, letterSpacing: 0.3,
  },
  metaText: { fontSize: 12, color: "#6B6963" },

  // Sections
  section: { marginBottom: 28 },
  callout: {
    marginBottom: 28, background: "#E8F0ED", borderLeft: "3px solid #3D7A68",
    padding: "14px 18px", borderRadius: "0 5px 5px 0",
  },
  sectionHeading: { fontSize: 17, fontWeight: 650, marginBottom: 8, letterSpacing: -0.2 },
  sectionBody: {},
  bodyLine: { fontSize: 14.5, lineHeight: 1.7, margin: "2px 0" },

  // Modal
  modalOverlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000, padding: 20,
  },
  modal: {
    background: "#fff", borderRadius: 10, padding: "28px 28px 22px",
    width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
  },
  modalTitle: { fontSize: 18, fontWeight: 700, marginBottom: 6 },
  modalDesc: { fontSize: 13.5, color: "#6B6963", marginBottom: 16, lineHeight: 1.5 },
  textarea: {
    width: "100%", padding: 12, border: "1px solid #D8D5CF", borderRadius: 6,
    fontSize: 14, fontFamily: "inherit", resize: "vertical", outline: "none",
    lineHeight: 1.55,
  },
  error: {
    marginTop: 10, padding: "8px 12px", background: "#FEF2F2",
    border: "1px solid #F5D4D4", borderRadius: 5, fontSize: 13, color: "#8C2A2A",
  },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 },
  cancelBtn: {
    padding: "8px 16px", background: "transparent", border: "1px solid #D8D5CF",
    borderRadius: 5, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
  },
  generateBtn: {
    padding: "8px 20px", background: "#3D7A68", color: "#fff",
    border: "none", borderRadius: 5, fontSize: 13, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit",
  },

  // Page editor
  editorModal: {
    background: "#fff", borderRadius: 10, padding: "24px 24px 20px",
    width: "100%", maxWidth: 640, maxHeight: "88vh", overflowY: "auto",
    boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
  },
  fieldLabel: {
    display: "block", fontSize: 12, fontWeight: 600, color: "#6B6963",
    marginBottom: 4, marginTop: 2,
  },
  input: {
    width: "100%", padding: "8px 10px", border: "1px solid #D8D5CF",
    borderRadius: 6, fontSize: 14, fontFamily: "inherit", outline: "none",
    marginBottom: 12, boxSizing: "border-box", background: "#fff",
  },
  fieldRow: { display: "flex", gap: 12, alignItems: "flex-start" },
  sectionsHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginTop: 10, marginBottom: 8,
  },
  sectionEditor: {
    border: "1px solid #ECEAE4", borderRadius: 8, padding: 12,
    marginBottom: 10, background: "#FAF9F6",
  },
  sectionEditorTop: { display: "flex", gap: 8, alignItems: "center", marginBottom: 8 },
  calloutLabel: {
    display: "flex", alignItems: "center", gap: 4, fontSize: 12.5,
    color: "#6B6963", whiteSpace: "nowrap", cursor: "pointer",
  },
  smallBtn: {
    padding: "5px 12px", background: "transparent", border: "1px solid #D8D5CF",
    borderRadius: 5, fontSize: 12.5, cursor: "pointer", color: "#3D7A68",
    fontFamily: "inherit", fontWeight: 600,
  },
  removeBtn: {
    padding: "5px 9px", background: "transparent", border: "1px solid #D8D5CF",
    borderRadius: 5, fontSize: 12.5, cursor: "pointer", color: "#B0524D",
    fontFamily: "inherit", flexShrink: 0,
  },

  // Section images (editor)
  imagesHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginTop: 10, marginBottom: 6,
  },
  imagesLabel: { fontSize: 12, fontWeight: 600, color: "#6B6963" },
  imageRow: {
    display: "flex", gap: 10, alignItems: "center", padding: 8,
    border: "1px solid #ECEAE4", borderRadius: 7, background: "#fff", marginBottom: 6,
  },
  imageThumb: {
    width: 54, height: 54, objectFit: "cover", borderRadius: 5,
    border: "1px solid #E5E3DD", flexShrink: 0,
  },
  imageControls: { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" },
  controlGroup: { display: "flex", alignItems: "center", gap: 3 },
  controlLabel: { fontSize: 11, color: "#9A968D", marginRight: 3 },
  segBtn: {
    padding: "3px 8px", background: "#fff", border: "1px solid #D8D5CF",
    borderRadius: 5, fontSize: 12, cursor: "pointer", color: "#6B6963",
    fontFamily: "inherit", minWidth: 26,
  },
  segBtnActive: {
    padding: "3px 8px", background: "#3D7A68", border: "1px solid #3D7A68",
    borderRadius: 5, fontSize: 12, cursor: "pointer", color: "#fff",
    fontFamily: "inherit", fontWeight: 600, minWidth: 26,
  },

  // Misc
  empty: { fontSize: 14, color: "#6B6963", padding: "60px 0", textAlign: "center" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 90 },
  mobileToggle: {
    position: "fixed", top: 10, left: 10, zIndex: 200,
    background: "#2C2B28", color: "#fff", border: "none", borderRadius: 5,
    width: 36, height: 36, fontSize: 18, cursor: "pointer",
    display: "none",
  },
};
