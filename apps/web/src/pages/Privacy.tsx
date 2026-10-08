import { Link } from "react-router";
import { useTitle } from "../lib/useTitle";

/** Readable without the access code. Keep it plain and accurate to what the code actually does. */
export default function Privacy() {
  useTitle("Privacy");
  return (
    <article className="container prose">
      <h1>Privacy</h1>
      <p className="lead">
        This site is a private record of the Bintukwanga family, shared with relatives through an access code. This page
        explains what it holds, who can see it, and how to change or remove information.
      </p>

      <h2>What the family tree holds</h2>
      <ul>
        <li>Names, alternative spellings, titles and family relationships of family members and their spouses.</li>
        <li>Whether a person is living or late, and their place in the family (generation and branch).</li>
        <li>No addresses, phone numbers, birth dates, photos or identity numbers are published.</li>
      </ul>
      <p>
        The information was gathered by the family. Some details, such as gender, were estimated from first names and
        are marked for the family to confirm.
      </p>

      <h2>Who can see it</h2>
      <ul>
        <li>Only people who enter the family access code. Without it, no names are shown.</li>
        <li>Search engines are asked not to index the site, and the tree is not listed publicly.</li>
        <li>Family administrators can see suggestions and edit records after signing in.</li>
      </ul>

      <h2>Suggestions you send</h2>
      <p>
        The suggestion box stores the category, the person it is about (if chosen), your message, and your name and
        contact details only if you give them. To limit spam, it also stores a one-way scrambled (hashed) form of your
        internet address. Your actual address is never stored. Suggestions are used only to correct and improve the
        family record.
      </p>

      <h2>Cookies and browser storage</h2>
      <ul>
        <li>
          <strong>Family access</strong>: remembers that this browser entered the code, for 30 days.
        </li>
        <li>
          <strong>Admin session</strong>: keeps administrators signed in for up to 8 hours.
        </li>
        <li>
          <strong>Preferences</strong>: your light or dark theme, kept in your browser. A copy of the tree is cached in
          the browser tab for 10 minutes so pages load quickly.
        </li>
      </ul>
      <p>There are no advertising or tracking cookies and no analytics.</p>

      <h2>Where the data is kept</h2>
      <p>The site uses these service providers to run:</p>
      <ul>
        <li>Vercel: hosts the website pages.</li>
        <li>Render (with Cloudflare in front): runs the server that answers requests.</li>
        <li>Neon: stores the family database.</li>
      </ul>

      <h2>Children</h2>
      <p>
        The tree includes children as part of their family. Only their names and relationships are recorded, and only
        people with the access code can see them.
      </p>

      <h2>Corrections and removal</h2>
      <p>
        Anyone in the tree, or a parent or guardian of a child in it, can ask for details to be corrected or removed.
        Use the suggestion button on any page after entering the code, or contact the family administrators. The site is
        maintained by{" "}
        <a href="https://jrcom.vercel.app/" target="_blank" rel="noopener noreferrer">
          JuniorReactive<span className="sr-only"> (opens in a new tab)</span>
        </a>
        , who can pass on requests.
      </p>

      <p className="muted">Last updated 8 October 2026.</p>
      <p>
        <Link to="/">Back to the family tree</Link>
      </p>
    </article>
  );
}
