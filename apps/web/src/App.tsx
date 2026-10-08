import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, NavLink, Route, Routes, useSearchParams } from "react-router";
import { GitBranch, ListTree, MessageSquarePlus, Moon, Network, Sun } from "lucide-react";
import { FamilyContext } from "./lib/context";
import { AccessRequired, loadFamily, type Family } from "./lib/data";
import AccessGate from "./components/AccessGate";
import SearchBox from "./components/SearchBox";
import PersonDrawer from "./components/PersonDrawer";
import Chatbot from "./components/Chatbot";
import Home from "./pages/Home";
import Branches from "./pages/Branches";

const TreePage = lazy(() => import("./pages/TreePage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));

export default function App() {
  const [family, setFamily] = useState<Family | null>(null);
  const [error, setError] = useState(false);
  const [locked, setLocked] = useState(false);
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem("theme") === "dark";
    } catch {
      return false;
    }
  });
  const [params, setParams] = useSearchParams();
  const headerRef = useRef<HTMLElement>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPath, setChatPath] = useState<string | null>(null);

  const load = () => {
    setLocked(false);
    setError(false);
    loadFamily()
      .then(setFamily)
      .catch((e) => (e instanceof AccessRequired ? setLocked(true) : setError(true)));
  };
  useEffect(load, []);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty("--header-h", el.offsetHeight + "px"));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      /* storage unavailable */
    }
  }, [dark]);

  const openPerson = (path: string | null) => {
    const next = new URLSearchParams(params);
    if (path) next.set("person", path);
    else next.delete("person");
    setParams(next, { replace: false });
  };

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="site-header" ref={headerRef}>
        <Link to="/" className="brand">
          <Network size={20} strokeWidth={1.75} aria-hidden="true" />
          <span>Bintukwanga Family</span>
        </Link>
        <nav aria-label="Main">
          <NavLink to="/branches">
            <ListTree size={16} strokeWidth={1.75} aria-hidden="true" /> Branches
          </NavLink>
          <NavLink to="/tree">
            <GitBranch size={16} strokeWidth={1.75} aria-hidden="true" /> Tree
          </NavLink>
        </nav>
        {family && <SearchBox family={family} onPick={(p) => openPerson(p.path)} />}
        <button
          className="icon-btn"
          aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
          onClick={() => setDark((d) => !d)}
        >
          {dark ? <Sun size={20} strokeWidth={1.75} /> : <Moon size={20} strokeWidth={1.75} />}
        </button>
      </header>
      <main id="main">
        {error && <p className="notice">The family data could not be loaded. Please refresh.</p>}
        {locked && <AccessGate onUnlocked={load} />}
        {!family && !error && !locked && <p className="notice">Loading the family tree. The first visit after a quiet period can take up to a minute.</p>}
        {family && (
          <FamilyContext.Provider value={{ family, openPerson, openChat: (p) => { setChatPath(p); setChatOpen(true); } }}>
            <Suspense fallback={<p className="notice">Loading...</p>}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/branches" element={<Branches />} />
                <Route path="/tree" element={<TreePage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="*" element={<Home />} />
              </Routes>
            </Suspense>
            <PersonDrawer />
            <button className="chat-fab" aria-label="Suggest a correction" onClick={() => { setChatPath(null); setChatOpen((o) => !o); }}>
              <MessageSquarePlus size={24} strokeWidth={1.75} />
            </button>
            <Chatbot family={family} open={chatOpen} onClose={() => setChatOpen(false)} prefillPath={chatPath} />
          </FamilyContext.Provider>
        )}
      </main>
      <footer className="site-footer">
        <p>Bintukwanga family tree. A private family record.</p>
      </footer>
    </>
  );
}
