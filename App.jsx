import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// ── Utilities ──────────────────────────────────────────────
const uid = () => crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36);
const now = () => new Date().toISOString();
const fmt = (d) => d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";

// ── Data Store (localStorage-backed, offline-first) ──────
const STORE_KEY = "av_site_visit_data";
const getStore = () => {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || defaultStore(); }
  catch { return defaultStore(); }
};
const defaultStore = () => ({
  customers: [], siteVisits: [], rooms: [], photos: [], equipment: [],
  checklistResults: [], actionItems: [], notes: [], templates: defaultTemplates(),
});
const saveStore = (data) => { localStorage.setItem(STORE_KEY, JSON.stringify(data)); };

function defaultTemplates() {
  return [
    { id: "tpl-standard", name: "Standard Meeting Room", equipment: ["Display","Camera","Microphones","Speakers","Room System","Connectivity","Network"] },
    { id: "tpl-boardroom", name: "Boardroom", equipment: ["Display","Camera","Microphones","Speakers","Room System","Control","Connectivity","Network","Multiple Displays","Table Microphones","Ceiling Microphones","Audio DSP"] },
    { id: "tpl-huddle", name: "Huddle Room", equipment: ["Display","Camera","Microphones","Speakers","Connectivity"] },
    { id: "tpl-training", name: "Training Room", equipment: ["Display","Camera","Microphones","Speakers","Room System","Connectivity","Network","Wireless Presentation"] },
  ];
}

const DEFAULT_CHECKLIST = [
  "Display installed", "Display operational", "Camera installed", "Camera operational",
  "Microphones installed", "Microphone coverage sufficient", "Speakers installed",
  "Audio quality acceptable", "Teams/Zoom room system available", "Touch controller available",
  "HDMI available", "USB-C available", "Wireless presentation available",
  "Network connection available", "Power outlets available", "Cable management acceptable",
  "Equipment rack available", "Room suitable for AV upgrade",
];

const ROOM_TYPES = ["Boardroom","Meeting Room","Huddle Room","Training Room","Conference Room","Auditorium","Other"];
const PRIORITIES = ["Low","Medium","High","Critical"];
const ACTION_STATUSES = ["Open","In Progress","Completed"];
const VISIT_STATUSES = ["Draft","In Progress","Completed","Report Generated"];
const CONDITIONS = ["New","Good","Fair","Poor","Non-functional"];

// ── Icons (inline SVG components) ────────────────────────
const Icon = ({ d, size = 24, className = "", ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...p}>
    <path d={d} />
  </svg>
);
const Icons = {
  home: (p) => <Icon {...p} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10" />,
  users: (p) => <Icon {...p} d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M12 3a4 4 0 100 8 4 4 0 000-8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75" />,
  clipboard: (p) => <Icon {...p} d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2 M9 2h6a1 1 0 011 1v1a1 1 0 01-1 1H9a1 1 0 01-1-1V3a1 1 0 011-1z" />,
  file: (p) => <Icon {...p} d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6" />,
  settings: (p) => <Icon {...p} d="M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />,
  plus: (p) => <Icon {...p} d="M12 5v14 M5 12h14" />,
  camera: (p) => <Icon {...p} d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z M12 13a4 4 0 100-8 4 4 0 000 8z" />,
  check: (p) => <Icon {...p} d="M20 6L9 17l-5-5" />,
  chevLeft: (p) => <Icon {...p} d="M15 18l-6-6 6-6" />,
  chevRight: (p) => <Icon {...p} d="M9 18l6-6-6-6" />,
  trash: (p) => <Icon {...p} d="M3 6h18 M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />,
  edit: (p) => <Icon {...p} d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />,
  search: (p) => <Icon {...p} d="M11 19a8 8 0 100-16 8 8 0 000 16z M21 21l-4.35-4.35" />,
  x: (p) => <Icon {...p} d="M18 6L6 18 M6 6l12 12" />,
  menu: (p) => <Icon {...p} d="M3 12h18 M3 6h18 M3 18h18" />,
  map: (p) => <Icon {...p} d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z M12 7a3 3 0 100 6 3 3 0 000-6z" />,
  star: (p) => <Icon {...p} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />,
  mic: (p) => <Icon {...p} d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z M19 10v2a7 7 0 01-14 0v-2 M12 19v4 M8 23h8" />,
  download: (p) => <Icon {...p} d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3" />,
  ai: (p) => <Icon {...p} d="M12 2a4 4 0 014 4v1h2a3 3 0 013 3v2a3 3 0 01-3 3h-1v3a4 4 0 01-8 0v-3H8a3 3 0 01-3-3v-2a3 3 0 013-3h2V6a4 4 0 014-4z M10 10h.01 M14 10h.01 M10 14a3.5 3.5 0 004 0" />,
  list: (p) => <Icon {...p} d="M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01" />,
};

// ── Toast ────────────────────────────────────────────────
function Toast({ message, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-slate-800 text-white px-5 py-3 rounded-xl shadow-2xl text-sm font-medium animate-fade-in flex items-center gap-2 max-w-[90vw]">
      <Icons.check size={16} className="text-teal-400 shrink-0" />
      <span className="truncate">{message}</span>
    </div>
  );
}

// ── Confirm Dialog ───────────────────────────────────────
function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
        <p className="text-slate-600 text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Photo Viewer ─────────────────────────────────────────
function PhotoViewer({ photos, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex);
  const p = photos[idx];
  if (!p) return null;
  return (
    <div className="fixed inset-0 z-[80] bg-black flex flex-col">
      <div className="flex items-center justify-between p-4">
        <span className="text-white/70 text-sm">{idx + 1} / {photos.length}</span>
        <button onClick={onClose} className="text-white p-2"><Icons.x size={24} /></button>
      </div>
      <div className="flex-1 flex items-center justify-center p-4 relative">
        {idx > 0 && <button onClick={() => setIdx(i => i - 1)} className="absolute left-2 text-white/70 p-2"><Icons.chevLeft size={32} /></button>}
        <img src={p.data} alt={p.caption || ""} className="max-w-full max-h-full object-contain rounded-lg" />
        {idx < photos.length - 1 && <button onClick={() => setIdx(i => i + 1)} className="absolute right-2 text-white/70 p-2"><Icons.chevRight size={32} /></button>}
      </div>
      {p.caption && <div className="p-4 text-center text-white/80 text-sm">{p.caption}</div>}
    </div>
  );
}

// ── Input Components ─────────────────────────────────────
function Input({ label, ...p }) {
  return (
    <label className="block mb-3">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">{label}</span>
      <input {...p} className={`w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-base focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent ${p.className || ""}`} />
    </label>
  );
}
function TextArea({ label, ...p }) {
  return (
    <label className="block mb-3">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">{label}</span>
      <textarea {...p} className={`w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-base focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent min-h-[100px] ${p.className || ""}`} />
    </label>
  );
}
function Select({ label, options, ...p }) {
  return (
    <label className="block mb-3">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">{label}</span>
      <select {...p} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-base focus:outline-none focus:ring-2 focus:ring-teal-400">
        <option value="">Select...</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

// ── Badge / Pill ─────────────────────────────────────────
function Badge({ text, color = "teal" }) {
  const colors = {
    teal: "bg-teal-100 text-teal-700", green: "bg-emerald-100 text-emerald-700",
    yellow: "bg-amber-100 text-amber-700", red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700", gray: "bg-slate-100 text-slate-600",
    purple: "bg-purple-100 text-purple-700", orange: "bg-orange-100 text-orange-700",
  };
  return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors[color] || colors.gray}`}>{text}</span>;
}

const statusColor = (s) => ({ Draft: "gray", "In Progress": "yellow", Completed: "green", "Report Generated": "blue" }[s] || "gray");
const priorityColor = (p) => ({ Low: "gray", Medium: "yellow", High: "orange", Critical: "red" }[p] || "gray");

// ── Progress Ring ────────────────────────────────────────
function ProgressRing({ pct, size = 48 }) {
  const r = (size - 6) / 2, c = 2 * Math.PI * r, offset = c - (pct / 100) * c;
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={4} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={pct >= 80 ? "#14b8a6" : pct >= 50 ? "#f59e0b" : "#94a3b8"}
        strokeWidth={4} strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} className="transition-all duration-500" />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        className="text-xs font-bold fill-slate-700">{pct}%</text>
    </svg>
  );
}

// ── Empty State ──────────────────────────────────────────
function EmptyState({ icon: Ic, title, subtitle, action, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Ic size={28} className="text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-700 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 mb-6">{subtitle}</p>
      {action && <button onClick={onAction} className="px-6 py-3 bg-teal-500 text-white rounded-xl font-medium flex items-center gap-2">
        <Icons.plus size={18} />{action}
      </button>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ── MAIN APP ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════════
export default function App() {
  const [data, setData] = useState(getStore);
  const [screen, setScreen] = useState({ page: "dashboard" });
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [viewerPhotos, setViewerPhotos] = useState(null);

  const save = useCallback((updater) => {
    setData(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveStore(next);
      return next;
    });
  }, []);

  const notify = (msg) => setToast(msg);
  const go = (page, props) => setScreen({ page, ...props });
  const back = () => {
    const h = screen._back || { page: "dashboard" };
    setScreen(h);
  };

  // ── CRUD helpers ───────────────────────────────────────
  const addCustomer = (c) => { save(d => ({ ...d, customers: [...d.customers, { ...c, id: uid(), createdAt: now() }] })); notify("Customer created"); };
  const updateCustomer = (id, patch) => { save(d => ({ ...d, customers: d.customers.map(c => c.id === id ? { ...c, ...patch, updatedAt: now() } : c) })); notify("Customer updated"); };
  const deleteCustomer = (id) => { save(d => ({ ...d, customers: d.customers.filter(c => c.id !== id) })); notify("Customer deleted"); go("customers"); };

  const addVisit = (v) => { const nv = { ...v, id: uid(), status: "Draft", createdAt: now() }; save(d => ({ ...d, siteVisits: [...d.siteVisits, nv] })); notify("Site visit created"); return nv; };
  const updateVisit = (id, patch) => { save(d => ({ ...d, siteVisits: d.siteVisits.map(v => v.id === id ? { ...v, ...patch, updatedAt: now() } : v) })); };
  const deleteVisit = (id) => { save(d => ({ ...d, siteVisits: d.siteVisits.filter(v => v.id !== id), rooms: d.rooms.filter(r => r.visitId !== id), photos: d.photos.filter(p => p.visitId !== id), equipment: d.equipment.filter(e => e.visitId !== id), checklistResults: d.checklistResults.filter(c => c.visitId !== id), actionItems: d.actionItems.filter(a => a.visitId !== id) })); notify("Site visit deleted"); go("visits"); };

  const addRoom = (r) => { const nr = { ...r, id: uid(), createdAt: now() }; save(d => ({ ...d, rooms: [...d.rooms, nr] })); notify("Room added"); return nr; };
  const updateRoom = (id, patch) => { save(d => ({ ...d, rooms: d.rooms.map(r => r.id === id ? { ...r, ...patch, updatedAt: now() } : r) })); };
  const deleteRoom = (id) => { save(d => ({ ...d, rooms: d.rooms.filter(r => r.id !== id), photos: d.photos.filter(p => p.roomId !== id), equipment: d.equipment.filter(e => e.roomId !== id), checklistResults: d.checklistResults.filter(c => c.roomId !== id), actionItems: d.actionItems.filter(a => a.roomId !== id) })); notify("Room deleted"); };

  const addPhoto = (photo) => { save(d => ({ ...d, photos: [...d.photos, { ...photo, id: uid(), createdAt: now() }] })); };
  const deletePhoto = (id) => { save(d => ({ ...d, photos: d.photos.filter(p => p.id !== id) })); notify("Photo deleted"); };
  const updatePhoto = (id, patch) => { save(d => ({ ...d, photos: d.photos.map(p => p.id === id ? { ...p, ...patch } : p) })); };

  const setEquipment = (roomId, visitId, eqData) => {
    save(d => {
      const filtered = d.equipment.filter(e => e.roomId !== roomId);
      return { ...d, equipment: [...filtered, { roomId, visitId, ...eqData, id: uid(), updatedAt: now() }] };
    });
    notify("Equipment saved");
  };

  const setChecklistResult = (roomId, visitId, item, value, comment) => {
    save(d => {
      const existing = d.checklistResults.find(c => c.roomId === roomId && c.item === item);
      if (existing) {
        return { ...d, checklistResults: d.checklistResults.map(c => c.roomId === roomId && c.item === item ? { ...c, value, comment, updatedAt: now() } : c) };
      }
      return { ...d, checklistResults: [...d.checklistResults, { id: uid(), roomId, visitId, item, value, comment, createdAt: now() }] };
    });
  };

  const addActionItem = (a) => { save(d => ({ ...d, actionItems: [...d.actionItems, { ...a, id: uid(), createdAt: now() }] })); notify("Action item added"); };
  const updateActionItem = (id, patch) => { save(d => ({ ...d, actionItems: d.actionItems.map(a => a.id === id ? { ...a, ...patch, updatedAt: now() } : a) })); };
  const deleteActionItem = (id) => { save(d => ({ ...d, actionItems: d.actionItems.filter(a => a.id !== id) })); notify("Action item deleted"); };

  // ── Derived data ───────────────────────────────────────
  const roomPhotos = (roomId) => data.photos.filter(p => p.roomId === roomId);
  const visitRooms = (visitId) => data.rooms.filter(r => r.visitId === visitId);
  const visitPhotos = (visitId) => data.photos.filter(p => p.visitId === visitId);
  const visitActions = (visitId) => data.actionItems.filter(a => a.visitId === visitId);
  const roomActions = (roomId) => data.actionItems.filter(a => a.roomId === roomId);
  const roomEquip = (roomId) => data.equipment.find(e => e.roomId === roomId) || {};
  const roomChecklist = (roomId) => data.checklistResults.filter(c => c.roomId === roomId);

  const checklistPct = (roomId) => {
    const results = roomChecklist(roomId);
    const answered = results.filter(r => r.value && r.value !== "");
    return DEFAULT_CHECKLIST.length > 0 ? Math.round((answered.length / DEFAULT_CHECKLIST.length) * 100) : 0;
  };

  const visitCompletion = (visitId) => {
    const rooms = visitRooms(visitId);
    if (rooms.length === 0) return 0;
    const total = rooms.reduce((s, r) => s + checklistPct(r.id), 0);
    return Math.round(total / rooms.length);
  };

  // ── Header ─────────────────────────────────────────────
  const Header = ({ title, showBack, right }) => (
    <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-lg border-b border-slate-100">
      <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 min-w-0">
          {showBack && <button onClick={back} className="p-2 -ml-2 text-slate-600 active:bg-slate-100 rounded-xl"><Icons.chevLeft size={22} /></button>}
          <h1 className="text-lg font-bold text-slate-800 truncate">{title}</h1>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setSearchOpen(true)} className="p-2 text-slate-500 active:bg-slate-100 rounded-xl"><Icons.search size={20} /></button>
          {right}
        </div>
      </div>
    </div>
  );

  // ── Bottom Nav ─────────────────────────────────────────
  const navItems = [
    { key: "dashboard", label: "Home", icon: Icons.home },
    { key: "customers", label: "Customers", icon: Icons.users },
    { key: "visits", label: "Visits", icon: Icons.clipboard },
    { key: "reports", label: "Reports", icon: Icons.file },
    { key: "settings", label: "Settings", icon: Icons.settings },
  ];

  const BottomNav = () => (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-100 pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around max-w-2xl mx-auto">
        {navItems.map(n => {
          const active = screen.page === n.key;
          return (
            <button key={n.key} onClick={() => go(n.key)}
              className={`flex flex-col items-center py-2 px-3 min-w-[64px] transition-colors ${active ? "text-teal-600" : "text-slate-400"}`}>
              <n.icon size={22} />
              <span className="text-[10px] font-semibold mt-0.5">{n.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ── Floating Action Button ─────────────────────────────
  const FAB = ({ onClick, icon: Ic = Icons.plus }) => (
    <button onClick={onClick}
      className="fixed right-5 bottom-24 z-40 w-14 h-14 rounded-2xl bg-teal-500 text-white shadow-lg shadow-teal-500/30 flex items-center justify-center active:scale-95 transition-transform">
      <Ic size={24} />
    </button>
  );

  // ── Search Modal ───────────────────────────────────────
  const SearchModal = () => {
    if (!searchOpen) return null;
    const q = searchQ.toLowerCase();
    const results = [];
    if (q.length > 1) {
      data.customers.filter(c => c.name?.toLowerCase().includes(q) || c.city?.toLowerCase().includes(q)).forEach(c => results.push({ type: "Customer", label: c.name, sub: c.city, action: () => { setSearchOpen(false); go("customerDetail", { customerId: c.id }); } }));
      data.siteVisits.forEach(v => { const cust = data.customers.find(c => c.id === v.customerId); if (cust?.name?.toLowerCase().includes(q) || v.consultant?.toLowerCase().includes(q)) results.push({ type: "Site Visit", label: `${cust?.name || "?"} — ${fmt(v.date)}`, sub: v.status, action: () => { setSearchOpen(false); go("visitDetail", { visitId: v.id }); } }); });
      data.rooms.filter(r => r.name?.toLowerCase().includes(q) || r.number?.toLowerCase().includes(q)).forEach(r => results.push({ type: "Room", label: r.name, sub: r.type, action: () => { setSearchOpen(false); go("roomDetail", { roomId: r.id, visitId: r.visitId }); } }));
    }
    return (
      <div className="fixed inset-0 z-[70] bg-white flex flex-col">
        <div className="flex items-center gap-2 p-4 border-b border-slate-100">
          <Icons.search size={20} className="text-slate-400 shrink-0" />
          <input autoFocus value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search customers, visits, rooms..." className="flex-1 text-base outline-none" />
          <button onClick={() => { setSearchOpen(false); setSearchQ(""); }} className="p-2 text-slate-500"><Icons.x size={20} /></button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {q.length <= 1 && <p className="text-sm text-slate-400 text-center mt-8">Type at least 2 characters to search</p>}
          {q.length > 1 && results.length === 0 && <p className="text-sm text-slate-400 text-center mt-8">No results found</p>}
          {results.map((r, i) => (
            <button key={i} onClick={r.action} className="w-full text-left p-3 rounded-xl hover:bg-slate-50 active:bg-slate-100 flex items-center gap-3 mb-1">
              <Badge text={r.type} color="teal" />
              <div className="min-w-0"><div className="font-medium text-slate-800 truncate">{r.label}</div>{r.sub && <div className="text-xs text-slate-500">{r.sub}</div>}</div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  // ════════════════════════════════════════════════════════
  // ── DASHBOARD ──────────────────────────────────────────
  // ════════════════════════════════════════════════════════
  const Dashboard = () => {
    const activeVisits = data.siteVisits.filter(v => v.status !== "Completed" && v.status !== "Report Generated");
    const totalRooms = data.rooms.length;
    const totalPhotos = data.photos.length;
    const totalActions = data.actionItems.filter(a => a.status !== "Completed").length;
    return (
      <div className="pb-24">
        <Header title="AV Site Visit" />
        <div className="max-w-2xl mx-auto px-4 pt-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[{ n: data.customers.length, l: "Customers", c: "bg-teal-50 text-teal-700" },
              { n: data.siteVisits.length, l: "Site Visits", c: "bg-blue-50 text-blue-700" },
              { n: totalPhotos, l: "Photos", c: "bg-purple-50 text-purple-700" },
              { n: totalActions, l: "Open Actions", c: "bg-amber-50 text-amber-700" },
            ].map(s => (
              <div key={s.l} className={`${s.c} rounded-2xl p-4`}>
                <div className="text-2xl font-bold">{s.n}</div>
                <div className="text-xs font-semibold opacity-70">{s.l}</div>
              </div>
            ))}
          </div>

          {/* Active visits */}
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">Active Site Visits</h2>
          {activeVisits.length === 0 && <div className="text-center py-8 text-slate-400 text-sm">No active site visits</div>}
          {activeVisits.map(v => {
            const cust = data.customers.find(c => c.id === v.customerId);
            const rooms = visitRooms(v.id);
            const photos = visitPhotos(v.id);
            const pct = visitCompletion(v.id);
            return (
              <button key={v.id} onClick={() => go("visitDetail", { visitId: v.id })}
                className="w-full text-left bg-white border border-slate-100 rounded-2xl p-4 mb-3 active:bg-slate-50 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 truncate">{cust?.name || "Unknown"}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{fmt(v.date)} · {v.consultant || "—"}</div>
                  </div>
                  <Badge text={v.status} color={statusColor(v.status)} />
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                  <span>{rooms.length} rooms</span>
                  <span>📷 {photos.length}</span>
                  <span className="ml-auto"><ProgressRing pct={pct} size={36} /></span>
                </div>
              </button>
            );
          })}

          {/* Quick actions */}
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 mt-6">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => go("customerForm")} className="bg-teal-500 text-white rounded-2xl p-4 text-left active:bg-teal-600">
              <Icons.plus size={20} /><div className="font-semibold mt-2 text-sm">New Customer</div>
            </button>
            <button onClick={() => go("visitForm")} className="bg-slate-700 text-white rounded-2xl p-4 text-left active:bg-slate-800">
              <Icons.clipboard size={20} /><div className="font-semibold mt-2 text-sm">New Site Visit</div>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ════════════════════════════════════════════════════════
  // ── CUSTOMERS ──────────────────────────────────────────
  // ════════════════════════════════════════════════════════
  const CustomersList = () => (
    <div className="pb-24">
      <Header title="Customers" />
      <div className="max-w-2xl mx-auto px-4 pt-4">
        {data.customers.length === 0 ? <EmptyState icon={Icons.users} title="No customers yet" subtitle="Add your first customer to get started" action="Add Customer" onAction={() => go("customerForm")} /> :
          data.customers.map(c => (
            <button key={c.id} onClick={() => go("customerDetail", { customerId: c.id })}
              className="w-full text-left bg-white border border-slate-100 rounded-2xl p-4 mb-3 active:bg-slate-50 shadow-sm">
              <div className="font-bold text-slate-800">{c.name}</div>
              <div className="text-sm text-slate-500">{[c.city, c.contact].filter(Boolean).join(" · ")}</div>
              <div className="text-xs text-slate-400 mt-1">{data.siteVisits.filter(v => v.customerId === c.id).length} visit(s)</div>
            </button>
          ))
        }
      </div>
      <FAB onClick={() => go("customerForm")} />
    </div>
  );

  // ── Customer Form ──────────────────────────────────────
  const CustomerForm = () => {
    const editing = screen.customerId && data.customers.find(c => c.id === screen.customerId);
    const [f, setF] = useState(editing || { name: "", address: "", city: "", contact: "", email: "", phone: "", notes: "" });
    const upd = (k, v) => setF({ ...f, [k]: v });
    const submit = () => {
      if (!f.name.trim()) return;
      if (editing) { updateCustomer(editing.id, f); go("customerDetail", { customerId: editing.id }); }
      else { addCustomer(f); go("customers"); }
    };
    return (
      <div className="pb-24">
        <Header title={editing ? "Edit Customer" : "New Customer"} showBack
          right={<button onClick={submit} className="px-4 py-2 bg-teal-500 text-white rounded-xl text-sm font-medium">Save</button>} />
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <Input label="Customer Name *" value={f.name} onChange={e => upd("name", e.target.value)} />
          <Input label="Address" value={f.address} onChange={e => upd("address", e.target.value)} />
          <Input label="City" value={f.city} onChange={e => upd("city", e.target.value)} />
          <Input label="Contact Person" value={f.contact} onChange={e => upd("contact", e.target.value)} />
          <Input label="Email" type="email" value={f.email} onChange={e => upd("email", e.target.value)} />
          <Input label="Telephone" type="tel" value={f.phone} onChange={e => upd("phone", e.target.value)} />
          <TextArea label="Notes" value={f.notes} onChange={e => upd("notes", e.target.value)} />
        </div>
      </div>
    );
  };

  // ── Customer Detail ────────────────────────────────────
  const CustomerDetail = () => {
    const c = data.customers.find(c => c.id === screen.customerId);
    if (!c) return <div className="p-8 text-center text-slate-400">Customer not found</div>;
    const visits = data.siteVisits.filter(v => v.customerId === c.id);
    return (
      <div className="pb-24">
        <Header title={c.name} showBack
          right={<>
            <button onClick={() => go("customerForm", { customerId: c.id, _back: screen })} className="p-2 text-slate-500"><Icons.edit size={18} /></button>
            <button onClick={() => setConfirm({ title: "Delete Customer", message: `Delete "${c.name}" and all associated data?`, onConfirm: () => { deleteCustomer(c.id); setConfirm(null); }, onCancel: () => setConfirm(null) })} className="p-2 text-red-400"><Icons.trash size={18} /></button>
          </>} />
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <div className="bg-white border border-slate-100 rounded-2xl p-4 mb-4 shadow-sm space-y-1 text-sm">
            {c.address && <div><span className="text-slate-400">Address:</span> {c.address}</div>}
            {c.city && <div><span className="text-slate-400">City:</span> {c.city}</div>}
            {c.contact && <div><span className="text-slate-400">Contact:</span> {c.contact}</div>}
            {c.email && <div><span className="text-slate-400">Email:</span> {c.email}</div>}
            {c.phone && <div><span className="text-slate-400">Phone:</span> {c.phone}</div>}
            {c.notes && <div className="pt-2 text-slate-600">{c.notes}</div>}
          </div>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">Site Visits</h2>
          {visits.length === 0 ? <p className="text-sm text-slate-400">No visits yet</p> : visits.map(v => (
            <button key={v.id} onClick={() => go("visitDetail", { visitId: v.id })}
              className="w-full text-left bg-white border border-slate-100 rounded-2xl p-4 mb-3 active:bg-slate-50 shadow-sm flex items-center justify-between">
              <div><div className="font-semibold text-slate-800">{fmt(v.date)}</div><div className="text-xs text-slate-500">{v.consultant}</div></div>
              <Badge text={v.status} color={statusColor(v.status)} />
            </button>
          ))}
          <button onClick={() => go("visitForm", { customerId: c.id })} className="w-full py-3 mt-2 border-2 border-dashed border-slate-200 rounded-2xl text-sm font-medium text-slate-500 active:bg-slate-50 flex items-center justify-center gap-2">
            <Icons.plus size={16} /> New Site Visit
          </button>
        </div>
      </div>
    );
  };

  // ════════════════════════════════════════════════════════
  // ── SITE VISITS ────────────────────────────────────────
  // ════════════════════════════════════════════════════════
  const VisitsList = () => (
    <div className="pb-24">
      <Header title="Site Visits" />
      <div className="max-w-2xl mx-auto px-4 pt-4">
        {data.siteVisits.length === 0 ? <EmptyState icon={Icons.clipboard} title="No site visits" subtitle="Create a site visit to start documenting" action="New Site Visit" onAction={() => go("visitForm")} /> :
          data.siteVisits.map(v => {
            const cust = data.customers.find(c => c.id === v.customerId);
            return (
              <button key={v.id} onClick={() => go("visitDetail", { visitId: v.id })}
                className="w-full text-left bg-white border border-slate-100 rounded-2xl p-4 mb-3 active:bg-slate-50 shadow-sm">
                <div className="flex justify-between items-start">
                  <div className="min-w-0"><div className="font-bold text-slate-800 truncate">{cust?.name || "—"}</div><div className="text-xs text-slate-500">{fmt(v.date)} · {v.consultant || "—"}</div></div>
                  <Badge text={v.status} color={statusColor(v.status)} />
                </div>
              </button>
            );
          })}
      </div>
      <FAB onClick={() => go("visitForm")} />
    </div>
  );

  // ── Visit Form ─────────────────────────────────────────
  const VisitForm = () => {
    const editing = screen.visitId && data.siteVisits.find(v => v.id === screen.visitId);
    const [f, setF] = useState(editing || { customerId: screen.customerId || "", date: new Date().toISOString().slice(0, 10), startTime: "", endTime: "", consultant: "", notes: "" });
    const upd = (k, v) => setF({ ...f, [k]: v });
    const submit = () => {
      if (!f.customerId || !f.date) return;
      if (editing) { updateVisit(editing.id, f); notify("Visit updated"); go("visitDetail", { visitId: editing.id }); }
      else { const nv = addVisit(f); go("visitDetail", { visitId: nv.id }); }
    };
    return (
      <div className="pb-24">
        <Header title={editing ? "Edit Visit" : "New Site Visit"} showBack
          right={<button onClick={submit} className="px-4 py-2 bg-teal-500 text-white rounded-xl text-sm font-medium">Save</button>} />
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <Select label="Customer *" value={f.customerId} onChange={e => upd("customerId", e.target.value)} options={[]} />
          {/* Custom customer select */}
          <div className="-mt-3 mb-3">
            <div className="space-y-1 max-h-40 overflow-auto border border-slate-100 rounded-xl p-2">
              {data.customers.map(c => (
                <button key={c.id} onClick={() => upd("customerId", c.id)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${f.customerId === c.id ? "bg-teal-50 text-teal-700 font-medium" : "text-slate-600 hover:bg-slate-50"}`}>{c.name}</button>
              ))}
              {data.customers.length === 0 && <p className="text-xs text-slate-400 p-2">No customers — create one first</p>}
            </div>
          </div>
          <Input label="Date *" type="date" value={f.date} onChange={e => upd("date", e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Time" type="time" value={f.startTime} onChange={e => upd("startTime", e.target.value)} />
            <Input label="End Time" type="time" value={f.endTime} onChange={e => upd("endTime", e.target.value)} />
          </div>
          <Input label="Consultant" value={f.consultant} onChange={e => upd("consultant", e.target.value)} />
          {editing && <Select label="Status" value={f.status || editing.status} onChange={e => upd("status", e.target.value)} options={VISIT_STATUSES} />}
          <TextArea label="Notes" value={f.notes} onChange={e => upd("notes", e.target.value)} />
        </div>
      </div>
    );
  };

  // ── Visit Detail ───────────────────────────────────────
  const VisitDetail = () => {
    const v = data.siteVisits.find(v => v.id === screen.visitId);
    if (!v) return <div className="p-8 text-center text-slate-400">Visit not found</div>;
    const cust = data.customers.find(c => c.id === v.customerId);
    const rooms = visitRooms(v.id);
    const photos = visitPhotos(v.id);
    const actions = visitActions(v.id);
    const pct = visitCompletion(v.id);
    const completed = rooms.filter(r => checklistPct(r.id) === 100).length;
    const [tab, setTab] = useState("rooms");

    return (
      <div className="pb-24">
        <Header title={cust?.name || "Site Visit"} showBack
          right={<>
            <button onClick={() => go("visitForm", { visitId: v.id, _back: screen })} className="p-2 text-slate-500"><Icons.edit size={18} /></button>
            <button onClick={() => setConfirm({ title: "Delete Visit", message: "Delete this site visit and all rooms, photos, and data?", onConfirm: () => { deleteVisit(v.id); setConfirm(null); }, onCancel: () => setConfirm(null) })} className="p-2 text-red-400"><Icons.trash size={18} /></button>
          </>} />
        <div className="max-w-2xl mx-auto px-4 pt-4">
          {/* Summary */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-2xl p-5 mb-4 text-white">
            <div className="flex items-center justify-between mb-3">
              <Badge text={v.status} color={statusColor(v.status)} />
              <ProgressRing pct={pct} size={52} />
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><div className="text-2xl font-bold">{rooms.length}</div><div className="text-xs text-slate-300">Rooms</div></div>
              <div><div className="text-2xl font-bold">📷 {photos.length}</div><div className="text-xs text-slate-300">Photos</div></div>
              <div><div className="text-2xl font-bold">{actions.filter(a => a.status !== "Completed").length}</div><div className="text-xs text-slate-300">Actions</div></div>
            </div>
            <div className="mt-3 text-xs text-slate-300">{fmt(v.date)} · {v.consultant || "—"} · {completed}/{rooms.length} completed</div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-4">
            {["rooms", "actions", "report"].map(t => (
              <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${tab === t ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>
                {t === "rooms" ? "Rooms" : t === "actions" ? "Actions" : "Report"}
              </button>
            ))}
          </div>

          {tab === "rooms" && (
            <>
              {rooms.length === 0 && <EmptyState icon={Icons.map} title="No rooms added" subtitle="Add meeting rooms to document" action="Add Room" onAction={() => go("roomForm", { visitId: v.id, _back: screen })} />}
              {rooms.map(r => {
                const rPhotos = roomPhotos(r.id);
                const pct = checklistPct(r.id);
                return (
                  <button key={r.id} onClick={() => go("roomDetail", { roomId: r.id, visitId: v.id, _back: screen })}
                    className="w-full text-left bg-white border border-slate-100 rounded-2xl p-4 mb-3 active:bg-slate-50 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800">{r.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{r.type} · {r.capacity ? `${r.capacity} persons` : "—"}</div>
                      </div>
                      <ProgressRing pct={pct} size={40} />
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <span>📷 {rPhotos.length} photos</span>
                      <span>✓ {pct}% completed</span>
                      {r.floor && <span>Floor {r.floor}</span>}
                    </div>
                  </button>
                );
              })}
              <button onClick={() => go("roomForm", { visitId: v.id, _back: screen })}
                className="w-full py-3 mt-1 border-2 border-dashed border-slate-200 rounded-2xl text-sm font-medium text-slate-500 active:bg-slate-50 flex items-center justify-center gap-2">
                <Icons.plus size={16} /> Add Room
              </button>
              {/* Quick add from template */}
              <div className="mt-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Quick Add from Template</h3>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {data.templates.map(t => (
                    <button key={t.id} onClick={() => {
                      const nr = addRoom({ visitId: v.id, name: t.name, type: t.name.includes("Huddle") ? "Huddle Room" : t.name.includes("Board") ? "Boardroom" : "Meeting Room", capacity: "", floor: "", number: "", notes: "", template: t.id });
                    }} className="shrink-0 px-4 py-2 bg-slate-100 rounded-xl text-xs font-medium text-slate-600 active:bg-slate-200">
                      + {t.name}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === "actions" && (
            <>
              {actions.length === 0 && <EmptyState icon={Icons.list} title="No action items" subtitle="Add action items during your visit" action="Add Action" onAction={() => go("actionForm", { visitId: v.id, _back: screen })} />}
              {actions.map(a => (
                <div key={a.id} className="bg-white border border-slate-100 rounded-2xl p-4 mb-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 text-sm">{a.description}</div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge text={a.priority} color={priorityColor(a.priority)} />
                        <Badge text={a.status} color={a.status === "Completed" ? "green" : a.status === "In Progress" ? "yellow" : "gray"} />
                        {a.responsible && <span className="text-xs text-slate-400">{a.responsible}</span>}
                        {a.dueDate && <span className="text-xs text-slate-400">Due: {fmt(a.dueDate)}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => go("actionForm", { visitId: v.id, actionId: a.id, _back: screen })} className="p-1.5 text-slate-400"><Icons.edit size={16} /></button>
                      <button onClick={() => { setConfirm({ title: "Delete Action", message: "Delete this action item?", onConfirm: () => { deleteActionItem(a.id); setConfirm(null); }, onCancel: () => setConfirm(null) }); }} className="p-1.5 text-red-300"><Icons.trash size={16} /></button>
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={() => go("actionForm", { visitId: v.id, _back: screen })} className="w-full py-3 mt-1 border-2 border-dashed border-slate-200 rounded-2xl text-sm font-medium text-slate-500 active:bg-slate-50 flex items-center justify-center gap-2">
                <Icons.plus size={16} /> Add Action Item
              </button>
            </>
          )}

          {tab === "report" && <ReportTab visit={v} customer={cust} rooms={rooms} />}
        </div>
      </div>
    );
  };

  // ── Report Tab / Generator ─────────────────────────────
  const ReportTab = ({ visit, customer, rooms }) => {
    const [generating, setGenerating] = useState(false);
    const [reportHtml, setReportHtml] = useState(null);

    const generateReport = () => {
      setGenerating(true);
      setTimeout(() => {
        const photos = visitPhotos(visit.id);
        const actions = visitActions(visit.id);
        let html = `<html><head><style>
          body{font-family:Inter,system-ui,sans-serif;color:#1e293b;max-width:800px;margin:0 auto;padding:40px 20px;line-height:1.6}
          h1{color:#0f172a;border-bottom:3px solid #14b8a6;padding-bottom:8px;} h2{color:#334155;margin-top:32px;border-bottom:1px solid #e2e8f0;padding-bottom:6px} h3{color:#475569}
          .badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:600}
          .teal{background:#ccfbf1;color:#0d9488} .red{background:#fef2f2;color:#ef4444} .yellow{background:#fffbeb;color:#d97706} .green{background:#ecfdf5;color:#059669}
          table{width:100%;border-collapse:collapse;margin:12px 0} th,td{text-align:left;padding:8px 12px;border:1px solid #e2e8f0;font-size:14px} th{background:#f8fafc;font-weight:600}
          .photo-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:12px 0} .photo-grid img{width:100%;border-radius:8px;border:1px solid #e2e8f0}
          .cover{text-align:center;padding:80px 20px;border:2px solid #14b8a6;border-radius:16px;margin-bottom:40px}
          .cover h1{border:none;font-size:28px;margin:0} .cover p{color:#64748b;margin:4px 0}
        </style></head><body>`;

        html += `<div class="cover"><h1>AV Site Visit Report</h1><p style="font-size:20px;color:#0f172a;margin-top:16px">${customer?.name || "—"}</p><p>${fmt(visit.date)}</p><p>Prepared by: ${visit.consultant || "—"}</p></div>`;
        html += `<h2>Executive Summary</h2><p>Site visit conducted at ${customer?.name || "—"} on ${fmt(visit.date)}. ${rooms.length} room(s) were surveyed, with ${photos.length} photographs captured and ${actions.length} action item(s) identified.</p>`;
        html += `<h2>Site Overview</h2><table><tr><th>Metric</th><th>Value</th></tr>
          <tr><td>Total Rooms</td><td>${rooms.length}</td></tr>
          <tr><td>Photos Taken</td><td>${photos.length}</td></tr>
          <tr><td>Action Items</td><td>${actions.length}</td></tr>
          <tr><td>Overall Completion</td><td>${visitCompletion(visit.id)}%</td></tr></table>`;

        rooms.forEach(r => {
          const rPhotos = roomPhotos(r.id);
          const rChecklist = roomChecklist(r.id);
          const rEquip = roomEquip(r.id);
          const rActions = roomActions(r.id);
          html += `<h2>${r.name}</h2>`;
          html += `<table><tr><th>Type</th><td>${r.type || "—"}</td></tr><tr><th>Capacity</th><td>${r.capacity || "—"}</td></tr><tr><th>Floor</th><td>${r.floor || "—"}</td></tr></table>`;
          if (r.notes) html += `<p><strong>Notes:</strong> ${r.notes}</p>`;

          if (rChecklist.length > 0) {
            html += `<h3>Technical Checklist</h3><table><tr><th>Item</th><th>Status</th><th>Comment</th></tr>`;
            rChecklist.forEach(c => { html += `<tr><td>${c.item}</td><td><span class="badge ${c.value === 'Yes' ? 'green' : c.value === 'No' ? 'red' : 'yellow'}">${c.value}</span></td><td>${c.comment || ""}</td></tr>`; });
            html += `</table>`;
          }
          if (rActions.length > 0) {
            html += `<h3>Action Items</h3><table><tr><th>Description</th><th>Priority</th><th>Status</th></tr>`;
            rActions.forEach(a => { html += `<tr><td>${a.description}</td><td><span class="badge ${a.priority === 'Critical' ? 'red' : a.priority === 'High' ? 'yellow' : 'teal'}">${a.priority}</span></td><td>${a.status}</td></tr>`; });
            html += `</table>`;
          }
          if (rPhotos.length > 0) {
            html += `<h3>Photos</h3><div class="photo-grid">`;
            rPhotos.slice(0, 6).forEach(p => { html += `<div><img src="${p.data}" />${p.caption ? `<p style="font-size:12px;color:#64748b;margin:4px 0">${p.caption}</p>` : ""}</div>`; });
            html += `</div>`;
          }
        });

        if (actions.length > 0) {
          html += `<h2>Action Plan</h2><table><tr><th>Action</th><th>Priority</th><th>Responsible</th><th>Due</th><th>Status</th></tr>`;
          actions.forEach(a => { html += `<tr><td>${a.description}</td><td>${a.priority}</td><td>${a.responsible || "—"}</td><td>${a.dueDate ? fmt(a.dueDate) : "—"}</td><td>${a.status}</td></tr>`; });
          html += `</table>`;
        }
        html += `</body></html>`;
        setReportHtml(html);
        updateVisit(visit.id, { status: "Report Generated" });
        setGenerating(false);
      }, 500);
    };

    const downloadPdf = () => {
      if (!reportHtml) return;
      const blob = new Blob([reportHtml], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `AV_Site_Visit_${customer?.name || "Report"}_${visit.date || "report"}.html`;
      a.click();
      URL.revokeObjectURL(url);
      notify("Report downloaded");
    };

    return (
      <div>
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm text-center">
          <Icons.file size={32} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-semibold text-slate-700 mb-1">Site Visit Report</h3>
          <p className="text-sm text-slate-500 mb-4">Generate a professional report including all rooms, photos, checklists, and action items.</p>
          <button onClick={generateReport} disabled={generating}
            className="w-full py-3 bg-teal-500 text-white rounded-xl font-medium active:bg-teal-600 disabled:opacity-50 mb-3">
            {generating ? "Generating..." : reportHtml ? "Regenerate Report" : "Generate Report"}
          </button>
          {reportHtml && (
            <button onClick={downloadPdf} className="w-full py-3 bg-slate-700 text-white rounded-xl font-medium active:bg-slate-800 flex items-center justify-center gap-2">
              <Icons.download size={18} /> Download Report
            </button>
          )}
        </div>
        {reportHtml && (
          <div className="mt-4 bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-3 border-b border-slate-100 text-xs font-semibold text-slate-500">PREVIEW</div>
            <iframe srcDoc={reportHtml} className="w-full h-96 border-0" title="Report Preview" />
          </div>
        )}
      </div>
    );
  };

  // ════════════════════════════════════════════════════════
  // ── ROOM FORM ──────────────────────────────────────────
  // ════════════════════════════════════════════════════════
  const RoomForm = () => {
    const editing = screen.roomId && data.rooms.find(r => r.id === screen.roomId);
    const [f, setF] = useState(editing || { name: "", number: "", floor: "", capacity: "", type: "Meeting Room", notes: "", visitId: screen.visitId });
    const upd = (k, v) => setF({ ...f, [k]: v });
    const submit = () => {
      if (!f.name.trim()) return;
      if (editing) { updateRoom(editing.id, f); notify("Room updated"); back(); }
      else { addRoom(f); back(); }
    };
    return (
      <div className="pb-24">
        <Header title={editing ? "Edit Room" : "Add Room"} showBack
          right={<button onClick={submit} className="px-4 py-2 bg-teal-500 text-white rounded-xl text-sm font-medium">Save</button>} />
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <Input label="Room Name *" value={f.name} onChange={e => upd("name", e.target.value)} placeholder="e.g. Meeting Room 01" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Room Number" value={f.number} onChange={e => upd("number", e.target.value)} />
            <Input label="Floor" value={f.floor} onChange={e => upd("floor", e.target.value)} />
          </div>
          <Input label="Capacity (persons)" type="number" value={f.capacity} onChange={e => upd("capacity", e.target.value)} />
          <Select label="Room Type" value={f.type} onChange={e => upd("type", e.target.value)} options={ROOM_TYPES} />
          <TextArea label="Notes" value={f.notes} onChange={e => upd("notes", e.target.value)} />
        </div>
      </div>
    );
  };

  // ════════════════════════════════════════════════════════
  // ── ROOM DETAIL ────────────────────────────────────────
  // ════════════════════════════════════════════════════════
  const RoomDetail = () => {
    const room = data.rooms.find(r => r.id === screen.roomId);
    if (!room) return <div className="p-8 text-center text-slate-400">Room not found</div>;
    const [tab, setTab] = useState("overview");
    const rPhotos = roomPhotos(room.id);
    const pct = checklistPct(room.id);
    const tabs = ["overview", "photos", "equipment", "checklist", "actions"];

    return (
      <div className="pb-24">
        <Header title={room.name} showBack
          right={<>
            <button onClick={() => go("roomForm", { roomId: room.id, visitId: room.visitId, _back: screen })} className="p-2 text-slate-500"><Icons.edit size={18} /></button>
            <button onClick={() => setConfirm({ title: "Delete Room", message: `Delete "${room.name}"?`, onConfirm: () => { deleteRoom(room.id); setConfirm(null); back(); }, onCancel: () => setConfirm(null) })} className="p-2 text-red-400"><Icons.trash size={18} /></button>
          </>} />
        <div className="max-w-2xl mx-auto">
          {/* Tab bar */}
          <div className="flex overflow-x-auto gap-1 px-4 pt-3 pb-2 no-scrollbar">
            {tabs.map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-colors ${tab === t ? "bg-teal-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                {t === "overview" ? "Overview" : t === "photos" ? `Photos (${rPhotos.length})` : t === "equipment" ? "Equipment" : t === "checklist" ? `Checklist ${pct}%` : "Actions"}
              </button>
            ))}
          </div>

          <div className="px-4 pt-3">
            {tab === "overview" && <RoomOverview room={room} />}
            {tab === "photos" && <RoomPhotos room={room} photos={rPhotos} />}
            {tab === "equipment" && <RoomEquipment room={room} />}
            {tab === "checklist" && <RoomChecklist room={room} />}
            {tab === "actions" && <RoomActionsTab room={room} />}
          </div>
        </div>
      </div>
    );
  };

  // ── Room Overview ──────────────────────────────────────
  const RoomOverview = ({ room }) => (
    <div className="space-y-3">
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-slate-400">Type</span><span className="font-medium">{room.type}</span></div>
        <div className="flex justify-between"><span className="text-slate-400">Capacity</span><span className="font-medium">{room.capacity || "—"} persons</span></div>
        <div className="flex justify-between"><span className="text-slate-400">Floor</span><span className="font-medium">{room.floor || "—"}</span></div>
        <div className="flex justify-between"><span className="text-slate-400">Room Number</span><span className="font-medium">{room.number || "—"}</span></div>
      </div>
      {/* Notes */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Notes</h3>
        <textarea
          value={room.notes || ""} onChange={e => updateRoom(room.id, { notes: e.target.value })}
          placeholder="Add notes about this room..."
          className="w-full min-h-[120px] text-sm text-slate-700 outline-none resize-none bg-transparent"
        />
      </div>
    </div>
  );

  // ── Room Photos ────────────────────────────────────────
  const RoomPhotos = ({ room, photos }) => {
    const fileRef = useRef(null);
    const cameraRef = useRef(null);

    const handleFiles = (files) => {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          // Compress by drawing to canvas
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const MAX = 1200;
            let w = img.width, h = img.height;
            if (w > MAX || h > MAX) { const s = MAX / Math.max(w, h); w *= s; h *= s; }
            canvas.width = w; canvas.height = h;
            canvas.getContext("2d").drawImage(img, 0, 0, w, h);
            const compressed = canvas.toDataURL("image/jpeg", 0.7);
            addPhoto({ roomId: room.id, visitId: room.visitId, data: compressed, caption: "" });
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    };

    return (
      <div>
        {/* Camera + Gallery buttons */}
        <div className="flex gap-3 mb-4">
          <button onClick={() => cameraRef.current?.click()}
            className="flex-1 py-4 bg-teal-500 text-white rounded-2xl font-medium flex items-center justify-center gap-2 active:bg-teal-600 text-sm">
            <Icons.camera size={20} /> Take Photo
          </button>
          <button onClick={() => fileRef.current?.click()}
            className="flex-1 py-4 bg-slate-100 text-slate-700 rounded-2xl font-medium flex items-center justify-center gap-2 active:bg-slate-200 text-sm">
            📁 Gallery
          </button>
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { if (e.target.files.length) handleFiles(e.target.files); e.target.value = ""; }} />
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { if (e.target.files.length) handleFiles(e.target.files); e.target.value = ""; }} />

        {photos.length === 0 ? <EmptyState icon={Icons.camera} title="No photos yet" subtitle="Capture photos of this room" /> : (
          <div className="grid grid-cols-2 gap-3">
            {photos.map((p, i) => (
              <div key={p.id} className="relative group">
                <img src={p.data} alt={p.caption || ""} onClick={() => setViewerPhotos({ photos, startIndex: i })}
                  className="w-full h-32 object-cover rounded-xl border border-slate-100 cursor-pointer" />
                <button onClick={() => setConfirm({ title: "Delete Photo", message: "Delete this photo?", onConfirm: () => { deletePhoto(p.id); setConfirm(null); }, onCancel: () => setConfirm(null) })}
                  className="absolute top-1.5 right-1.5 w-7 h-7 bg-red-500/80 text-white rounded-full flex items-center justify-center">
                  <Icons.x size={14} />
                </button>
                <input value={p.caption || ""} onChange={e => updatePhoto(p.id, { caption: e.target.value })}
                  placeholder="Add caption..." className="mt-1 w-full text-xs text-slate-600 bg-transparent outline-none border-b border-transparent focus:border-teal-400 px-1 py-0.5" />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── Room Equipment ─────────────────────────────────────
  const RoomEquipment = ({ room }) => {
    const eq = roomEquip(room.id);
    const [f, setF] = useState({
      display: { manufacturer: "", model: "", size: "", quantity: "", condition: "", notes: "", ...eq.display },
      camera: { manufacturer: "", model: "", quantity: "", location: "", condition: "", notes: "", ...eq.camera },
      microphones: { manufacturer: "", model: "", type: "", quantity: "", location: "", condition: "", notes: "", ...eq.microphones },
      speakers: { manufacturer: "", model: "", quantity: "", location: "", condition: "", notes: "", ...eq.speakers },
      roomSystem: { type: "", manufacturer: "", model: "", ...eq.roomSystem },
      control: { touchPanel: false, roomController: false, manufacturer: "", model: "", ...eq.control },
      connectivity: { hdmi: false, usbC: false, displayPort: false, wireless: false, other: "", ...eq.connectivity },
      network: { lan: false, wifi: false, location: "", notes: "", ...eq.network },
      other: eq.other || "",
    });

    const saveEq = () => { setEquipment(room.id, room.visitId, f); };

    const Section = ({ title, children }) => (
      <div className="bg-white border border-slate-100 rounded-2xl p-4 mb-3 shadow-sm">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">{title}</h3>
        {children}
      </div>
    );

    const EqInput = ({ label, value, onChange, ...p }) => (
      <label className="block mb-2">
        <span className="text-xs text-slate-500">{label}</span>
        <input value={value || ""} onChange={onChange} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" {...p} />
      </label>
    );

    const Toggle = ({ label, checked, onChange }) => (
      <label className="flex items-center gap-3 py-2 cursor-pointer">
        <div className={`w-10 h-6 rounded-full transition-colors relative ${checked ? "bg-teal-500" : "bg-slate-200"}`}
          onClick={onChange}>
          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-4.5 left-0" : "left-0.5"}`} />
        </div>
        <span className="text-sm text-slate-700">{label}</span>
      </label>
    );

    const upd = (cat, key, val) => setF(prev => ({ ...prev, [cat]: { ...prev[cat], [key]: val } }));

    return (
      <div>
        <Section title="Display">
          <div className="grid grid-cols-2 gap-2">
            <EqInput label="Manufacturer" value={f.display.manufacturer} onChange={e => upd("display", "manufacturer", e.target.value)} />
            <EqInput label="Model" value={f.display.model} onChange={e => upd("display", "model", e.target.value)} />
            <EqInput label="Size" value={f.display.size} onChange={e => upd("display", "size", e.target.value)} />
            <EqInput label="Quantity" type="number" value={f.display.quantity} onChange={e => upd("display", "quantity", e.target.value)} />
          </div>
          <Select label="Condition" value={f.display.condition} onChange={e => upd("display", "condition", e.target.value)} options={CONDITIONS} />
        </Section>

        <Section title="Camera">
          <div className="grid grid-cols-2 gap-2">
            <EqInput label="Manufacturer" value={f.camera.manufacturer} onChange={e => upd("camera", "manufacturer", e.target.value)} />
            <EqInput label="Model" value={f.camera.model} onChange={e => upd("camera", "model", e.target.value)} />
            <EqInput label="Quantity" type="number" value={f.camera.quantity} onChange={e => upd("camera", "quantity", e.target.value)} />
            <EqInput label="Location" value={f.camera.location} onChange={e => upd("camera", "location", e.target.value)} />
          </div>
          <Select label="Condition" value={f.camera.condition} onChange={e => upd("camera", "condition", e.target.value)} options={CONDITIONS} />
        </Section>

        <Section title="Microphones">
          <div className="grid grid-cols-2 gap-2">
            <EqInput label="Manufacturer" value={f.microphones.manufacturer} onChange={e => upd("microphones", "manufacturer", e.target.value)} />
            <EqInput label="Model" value={f.microphones.model} onChange={e => upd("microphones", "model", e.target.value)} />
            <EqInput label="Type" value={f.microphones.type} onChange={e => upd("microphones", "type", e.target.value)} />
            <EqInput label="Quantity" type="number" value={f.microphones.quantity} onChange={e => upd("microphones", "quantity", e.target.value)} />
          </div>
          <Select label="Condition" value={f.microphones.condition} onChange={e => upd("microphones", "condition", e.target.value)} options={CONDITIONS} />
        </Section>

        <Section title="Speakers">
          <div className="grid grid-cols-2 gap-2">
            <EqInput label="Manufacturer" value={f.speakers.manufacturer} onChange={e => upd("speakers", "manufacturer", e.target.value)} />
            <EqInput label="Model" value={f.speakers.model} onChange={e => upd("speakers", "model", e.target.value)} />
            <EqInput label="Quantity" type="number" value={f.speakers.quantity} onChange={e => upd("speakers", "quantity", e.target.value)} />
            <EqInput label="Location" value={f.speakers.location} onChange={e => upd("speakers", "location", e.target.value)} />
          </div>
          <Select label="Condition" value={f.speakers.condition} onChange={e => upd("speakers", "condition", e.target.value)} options={CONDITIONS} />
        </Section>

        <Section title="Room System">
          <Select label="Type" value={f.roomSystem.type} onChange={e => upd("roomSystem", "type", e.target.value)} options={["Microsoft Teams Rooms", "Zoom Room", "Other"]} />
          <div className="grid grid-cols-2 gap-2">
            <EqInput label="Manufacturer" value={f.roomSystem.manufacturer} onChange={e => upd("roomSystem", "manufacturer", e.target.value)} />
            <EqInput label="Model" value={f.roomSystem.model} onChange={e => upd("roomSystem", "model", e.target.value)} />
          </div>
        </Section>

        <Section title="Control">
          <Toggle label="Touch Panel" checked={f.control.touchPanel} onChange={() => upd("control", "touchPanel", !f.control.touchPanel)} />
          <Toggle label="Room Controller" checked={f.control.roomController} onChange={() => upd("control", "roomController", !f.control.roomController)} />
          <div className="grid grid-cols-2 gap-2 mt-2">
            <EqInput label="Manufacturer" value={f.control.manufacturer} onChange={e => upd("control", "manufacturer", e.target.value)} />
            <EqInput label="Model" value={f.control.model} onChange={e => upd("control", "model", e.target.value)} />
          </div>
        </Section>

        <Section title="Connectivity">
          <Toggle label="HDMI" checked={f.connectivity.hdmi} onChange={() => upd("connectivity", "hdmi", !f.connectivity.hdmi)} />
          <Toggle label="USB-C" checked={f.connectivity.usbC} onChange={() => upd("connectivity", "usbC", !f.connectivity.usbC)} />
          <Toggle label="DisplayPort" checked={f.connectivity.displayPort} onChange={() => upd("connectivity", "displayPort", !f.connectivity.displayPort)} />
          <Toggle label="Wireless Presentation" checked={f.connectivity.wireless} onChange={() => upd("connectivity", "wireless", !f.connectivity.wireless)} />
          <EqInput label="Other" value={f.connectivity.other} onChange={e => upd("connectivity", "other", e.target.value)} />
        </Section>

        <Section title="Network">
          <Toggle label="LAN Available" checked={f.network.lan} onChange={() => upd("network", "lan", !f.network.lan)} />
          <Toggle label="Wi-Fi Available" checked={f.network.wifi} onChange={() => upd("network", "wifi", !f.network.wifi)} />
          <EqInput label="Connection Location" value={f.network.location} onChange={e => upd("network", "location", e.target.value)} />
          <EqInput label="Notes" value={f.network.notes} onChange={e => upd("network", "notes", e.target.value)} />
        </Section>

        <Section title="Other Equipment">
          <textarea value={f.other} onChange={e => setF(prev => ({ ...prev, other: e.target.value }))} placeholder="Any other equipment..."
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm min-h-[80px]" />
        </Section>

        <button onClick={saveEq} className="w-full py-4 bg-teal-500 text-white rounded-2xl font-medium active:bg-teal-600 mb-4">
          Save Equipment
        </button>
      </div>
    );
  };

  // ── Room Checklist ─────────────────────────────────────
  const RoomChecklist = ({ room }) => {
    const results = roomChecklist(room.id);
    const pct = checklistPct(room.id);

    const getResult = (item) => results.find(r => r.item === item) || {};
    const setVal = (item, value) => setChecklistResult(room.id, room.visitId, item, value, getResult(item).comment || "");
    const setComment = (item, comment) => setChecklistResult(room.id, room.visitId, item, getResult(item).value || "", comment);

    const [expanded, setExpanded] = useState(null);

    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <ProgressRing pct={pct} size={56} />
          <div><div className="font-bold text-slate-700">Checklist Progress</div><div className="text-xs text-slate-500">{results.filter(r => r.value).length} of {DEFAULT_CHECKLIST.length} items</div></div>
        </div>

        {DEFAULT_CHECKLIST.map((item, i) => {
          const r = getResult(item);
          return (
            <div key={i} className="bg-white border border-slate-100 rounded-xl p-3 mb-2 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-700 flex-1 mr-2">{item}</span>
                <div className="flex gap-1 shrink-0">
                  {["Yes", "No", "N/A"].map(v => (
                    <button key={v} onClick={() => setVal(item, v)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${r.value === v
                        ? v === "Yes" ? "bg-emerald-500 text-white" : v === "No" ? "bg-red-500 text-white" : "bg-slate-500 text-white"
                        : "bg-slate-100 text-slate-500"}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => setExpanded(expanded === i ? null : i)} className="text-xs text-teal-500 mt-1">
                {expanded === i ? "Hide comment" : r.comment ? "Edit comment" : "+ Comment"}
              </button>
              {expanded === i && (
                <input value={r.comment || ""} onChange={e => setComment(item, e.target.value)} placeholder="Add comment..."
                  className="w-full mt-2 px-3 py-2 rounded-lg border border-slate-200 text-sm" />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ── Room Actions Tab ───────────────────────────────────
  const RoomActionsTab = ({ room }) => {
    const actions = roomActions(room.id);
    return (
      <div>
        {actions.length === 0 && <EmptyState icon={Icons.list} title="No action items" subtitle="Add action items for this room" action="Add Action" onAction={() => go("actionForm", { visitId: room.visitId, roomId: room.id, _back: screen })} />}
        {actions.map(a => (
          <div key={a.id} className="bg-white border border-slate-100 rounded-2xl p-4 mb-3 shadow-sm">
            <div className="font-medium text-slate-800 text-sm">{a.description}</div>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge text={a.priority} color={priorityColor(a.priority)} />
              <Badge text={a.status} color={a.status === "Completed" ? "green" : "gray"} />
            </div>
            <div className="flex gap-2 mt-3">
              {ACTION_STATUSES.map(s => (
                <button key={s} onClick={() => updateActionItem(a.id, { status: s })}
                  className={`px-3 py-1 rounded-lg text-xs font-medium ${a.status === s ? "bg-teal-500 text-white" : "bg-slate-100 text-slate-500"}`}>{s}</button>
              ))}
            </div>
          </div>
        ))}
        <button onClick={() => go("actionForm", { visitId: room.visitId, roomId: room.id, _back: screen })}
          className="w-full py-3 mt-1 border-2 border-dashed border-slate-200 rounded-2xl text-sm font-medium text-slate-500 active:bg-slate-50 flex items-center justify-center gap-2">
          <Icons.plus size={16} /> Add Action Item
        </button>
      </div>
    );
  };

  // ════════════════════════════════════════════════════════
  // ── ACTION ITEM FORM ───────────────────────────────────
  // ════════════════════════════════════════════════════════
  const ActionForm = () => {
    const editing = screen.actionId && data.actionItems.find(a => a.id === screen.actionId);
    const [f, setF] = useState(editing || { description: "", priority: "Medium", responsible: "", dueDate: "", status: "Open", visitId: screen.visitId, roomId: screen.roomId || "" });
    const upd = (k, v) => setF({ ...f, [k]: v });
    const submit = () => {
      if (!f.description.trim()) return;
      if (editing) { updateActionItem(editing.id, f); notify("Action updated"); }
      else { addActionItem(f); }
      back();
    };
    return (
      <div className="pb-24">
        <Header title={editing ? "Edit Action" : "New Action Item"} showBack
          right={<button onClick={submit} className="px-4 py-2 bg-teal-500 text-white rounded-xl text-sm font-medium">Save</button>} />
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <TextArea label="Description *" value={f.description} onChange={e => upd("description", e.target.value)} />
          <Select label="Priority" value={f.priority} onChange={e => upd("priority", e.target.value)} options={PRIORITIES} />
          <Input label="Responsible Person" value={f.responsible} onChange={e => upd("responsible", e.target.value)} />
          <Input label="Due Date" type="date" value={f.dueDate} onChange={e => upd("dueDate", e.target.value)} />
          {editing && <Select label="Status" value={f.status} onChange={e => upd("status", e.target.value)} options={ACTION_STATUSES} />}
        </div>
      </div>
    );
  };

  // ════════════════════════════════════════════════════════
  // ── REPORTS LIST ───────────────────────────────────────
  // ════════════════════════════════════════════════════════
  const ReportsList = () => {
    const reported = data.siteVisits.filter(v => v.status === "Report Generated" || v.status === "Completed");
    return (
      <div className="pb-24">
        <Header title="Reports" />
        <div className="max-w-2xl mx-auto px-4 pt-4">
          {reported.length === 0 ? <EmptyState icon={Icons.file} title="No reports yet" subtitle="Complete a site visit to generate reports" /> :
            reported.map(v => {
              const cust = data.customers.find(c => c.id === v.customerId);
              return (
                <button key={v.id} onClick={() => go("visitDetail", { visitId: v.id })}
                  className="w-full text-left bg-white border border-slate-100 rounded-2xl p-4 mb-3 active:bg-slate-50 shadow-sm">
                  <div className="font-bold text-slate-800">{cust?.name || "—"}</div>
                  <div className="text-xs text-slate-500">{fmt(v.date)}</div>
                  <Badge text={v.status} color={statusColor(v.status)} />
                </button>
              );
            })}
        </div>
      </div>
    );
  };

  // ════════════════════════════════════════════════════════
  // ── SETTINGS ───────────────────────────────────────────
  // ════════════════════════════════════════════════════════
  const Settings = () => {
    const [showClear, setShowClear] = useState(false);
    const totalSize = new Blob([JSON.stringify(data)]).size;
    const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    return (
      <div className="pb-24">
        <Header title="Settings" />
        <div className="max-w-2xl mx-auto px-4 pt-4 space-y-3">
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
            <h3 className="font-bold text-slate-700 mb-3">Data Storage</h3>
            <div className="text-sm text-slate-500 space-y-1">
              <div>Storage used: {sizeMB} MB</div>
              <div>Customers: {data.customers.length}</div>
              <div>Site Visits: {data.siteVisits.length}</div>
              <div>Rooms: {data.rooms.length}</div>
              <div>Photos: {data.photos.length}</div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-emerald-600 font-medium">Data saved locally (offline-ready)</span>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
            <h3 className="font-bold text-slate-700 mb-3">Export / Import</h3>
            <button onClick={() => {
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = `av-sitevisit-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
              URL.revokeObjectURL(url);
              notify("Data exported");
            }} className="w-full py-3 bg-slate-700 text-white rounded-xl font-medium mb-2 flex items-center justify-center gap-2">
              <Icons.download size={18} /> Export All Data
            </button>
            <label className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-medium flex items-center justify-center gap-2 cursor-pointer">
              📁 Import Data
              <input type="file" accept=".json" className="hidden" onChange={e => {
                const file = e.target.files[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => { try { const imported = JSON.parse(ev.target.result); save(imported); notify("Data imported"); } catch { notify("Invalid file"); } };
                reader.readAsText(file);
              }} />
            </label>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
            <h3 className="font-bold text-slate-700 mb-3">Templates</h3>
            <div className="space-y-2">
              {data.templates.map(t => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div><div className="text-sm font-medium text-slate-700">{t.name}</div><div className="text-xs text-slate-400">{t.equipment.length} categories</div></div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
            <h3 className="font-bold text-red-700 mb-2">Danger Zone</h3>
            {!showClear ? (
              <button onClick={() => setShowClear(true)} className="text-sm text-red-500 font-medium">Clear all data...</button>
            ) : (
              <div>
                <p className="text-sm text-red-600 mb-3">This will permanently delete all data. Export first!</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowClear(false)} className="flex-1 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-medium">Cancel</button>
                  <button onClick={() => { save(defaultStore()); setShowClear(false); notify("All data cleared"); }} className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-medium">Delete All</button>
                </div>
              </div>
            )}
          </div>

          <div className="text-center text-xs text-slate-400 py-4">
            AV Site Visit App v1.0<br />
            Built for AV professionals
          </div>
        </div>
      </div>
    );
  };

  // ════════════════════════════════════════════════════════
  // ── ROUTER ─────────────────────────────────────────────
  // ════════════════════════════════════════════════════════
  const renderScreen = () => {
    switch (screen.page) {
      case "dashboard": return <Dashboard />;
      case "customers": return <CustomersList />;
      case "customerForm": return <CustomerForm />;
      case "customerDetail": return <CustomerDetail />;
      case "visits": return <VisitsList />;
      case "visitForm": return <VisitForm />;
      case "visitDetail": return <VisitDetail />;
      case "roomForm": return <RoomForm />;
      case "roomDetail": return <RoomDetail />;
      case "actionForm": return <ActionForm />;
      case "reports": return <ReportsList />;
      case "settings": return <Settings />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-['Inter',system-ui,sans-serif]">


      {renderScreen()}
      <BottomNav />
      <SearchModal />

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      {confirm && <ConfirmDialog {...confirm} />}
      {viewerPhotos && <PhotoViewer {...viewerPhotos} onClose={() => setViewerPhotos(null)} />}
    </div>
  );
}
