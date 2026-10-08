import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, NavLink, Route, Routes, useSearchParams } from "react-router";
import { ArrowUpRight, GitBranch, House, ListTree, MessageSquarePlus, Moon, Sun } from "lucide-react";
import { FamilyContext } from "./lib/context";
import { AccessRequired, loadFamily, type Family } from "./lib/data";
import AccessGate from "./components/AccessGate";
import Loading from "./components/Loading";
import SearchBox from "./components/SearchBox";
import PersonDrawer from "./components/PersonDrawer";
import Home from "./pages/Home";
import Branches from "./pages/Branches";
import NotFound from "./pages/NotFound";

const TreePage = lazy(() => import("./pages/TreePage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const Chatbot = lazy(() => import("./components/Chatbot"));

export default function App() {
  const [family, setFamily] = useState<Family | null>(null);
  const [error, setError] = useState(false);
  const [locked, setLocked] = useState(false);
  const [slow, setSlow] = useState(false);
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
    setSlow(false);
    const t = setTimeout(() => setSlow(true), 2500);
    loadFamily()
      .then(setFamily)
      .catch((e) => (e instanceof AccessRequired ? setLocked(true) : setError(true)))
      .finally(() => clearTimeout(t));
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
          <img src="/favicon.svg" alt="" width={28} height={28} className="brand-mark" />
          <span>Bintukwanga Family</span>
        </Link>
        <nav aria-label="Main">
          <NavLink to="/" end>
            <House size={16} strokeWidth={1.75} aria-hidden="true" /> Home
          </NavLink>
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
        {error && (
          <div className="loading" role="alert">
            <p>The family data could not be loaded.</p>
            <button className="btn" onClick={load}>Try again</button>
          </div>
        )}
        {locked && <AccessGate onUnlocked={load} />}
        {!family && !error && !locked && <Loading slow={slow} />}
        {family && (
          <FamilyContext.Provider value={{ family, openPerson, openChat: (p) => { setChatPath(p); setChatOpen(true); } }}>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/branches" element={<Branches />} />
                <Route path="/tree" element={<TreePage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            <PersonDrawer />
            <button className="chat-fab" aria-label="Suggest a correction" onClick={() => { setChatPath(null); setChatOpen((o) => !o); }}>
              <MessageSquarePlus size={24} strokeWidth={1.75} />
            </button>
            {chatOpen && (
              <Suspense fallback={null}>
                <Chatbot family={family} open={chatOpen} onClose={() => setChatOpen(false)} prefillPath={chatPath} />
              </Suspense>
            )}
          </FamilyContext.Provider>
        )}
      </main>
      <footer className="site-footer">
        <div className="footer-inner">
          <p className="footer-family">
            <img src="/favicon.svg" alt="" width={20} height={20} />
            Bintukwanga Family Tree · A private family record
          </p>
          <p className="footer-credit">
            Designed and built by{" "}
            <a href="https://jrcom.vercel.app/" target="_blank" rel="noopener noreferrer">
              JuniorReactive
              <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>
        </div>
      </footer>
    </>
  );
}
