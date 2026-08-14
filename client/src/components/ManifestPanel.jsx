export default function ManifestPanel({ campaign }) {
  const { sending, stats, ticker, cancel } = campaign;
  const pct = stats.total ? Math.round(((stats.sent + stats.failed) / stats.total) * 100) : 0;

  return (
    <section className="panel manifestpanel">
      <h2 className="manifestpanel__title">Dispatch manifest</h2>

      <div className="progressbar">
        <div className="progressbar__fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="progressstats">
        <span><strong>{stats.sent}</strong> sent</span>
        <span><strong>{stats.failed}</strong> failed</span>
        <span><strong>{stats.total}</strong> total</span>
      </div>

      {sending && (
        <button className="btn btn--cancel" type="button" onClick={cancel}>
          Halt dispatch
        </button>
      )}

      <ol className="ticker">
        {ticker.length === 0 && (
          <li className="ticker__empty">No letters sent yet. This ledger fills in as each one goes out.</li>
        )}
        {ticker.map((r) => (
          <li key={r.key} className={r.status === 'sent' ? 'is-sent' : 'is-failed'}>
            <span className="ticker__mark">{r.status === 'sent' ? '✓' : '✕'}</span>
            <span className="ticker__email">{r.email}</span>
            {r.error && <span className="ticker__note">{r.error}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
