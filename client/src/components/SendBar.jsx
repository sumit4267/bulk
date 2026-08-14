export default function SendBar({ ready, sending, validCount, etaMinutes, onSend }) {
  return (
    <>
      <button className="btn btn--send" type="button" disabled={!ready || sending} onClick={onSend}>
        {sending ? 'Sending…' : (<>Seal &amp; send to <span>{validCount}</span> addresses</>)}
      </button>
      {ready && !sending && (
        <p className="hint hint--warn">
          Sends are paced with a human-like delay between letters. Estimated time: ~{etaMinutes} minute{etaMinutes === 1 ? '' : 's'}.
        </p>
      )}
    </>
  );
}
