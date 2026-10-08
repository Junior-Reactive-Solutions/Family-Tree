import { Link } from "react-router";
import { useTitle } from "../lib/useTitle";

export default function NotFound() {
  useTitle("Page not found");
  return (
    <section className="container narrow loading">
      <h1>Page not found</h1>
      <p className="muted">That page does not exist. The family is still here.</p>
      <Link className="btn" to="/">Go to the home page</Link>
    </section>
  );
}
