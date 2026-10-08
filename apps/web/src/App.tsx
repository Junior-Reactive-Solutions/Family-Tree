import { lazy, Suspense, useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useSearchParams } from "react-router";
import { GitBranch, ListTree, MessageSquarePlus, Moon, Network, Sun } from "lucide-react";
import { FamilyContext } from "./lib/context";
import { loadFamily, type Family } from "./lib/data";
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
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem("theme") === "dark";
    } catch {
      return false;
    }
  });
  const [params, setParams] = useSearchParams();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPath, setChatPath] = useState<string | null>(null);

  useEffect(() => {
    loadFamily().then(setFamily).catch(() => setError(true));
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
      <header className="site-header">
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
      <main>
        {error && <p className="notice">The family data could not be loaded. Please refresh.</p>}
        {!family && !error && <p className="notice">Loading the family tree...</p>}
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
    </>
  );
}
