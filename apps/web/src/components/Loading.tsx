export default function Loading({ slow }: { slow?: boolean }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <img src="/favicon.svg" alt="" width={56} height={56} />
      <p>Loading the family tree</p>
      {slow && <p className="muted">The server was resting. The first visit after a quiet spell can take up to a minute.</p>}
    </div>
  );
}
