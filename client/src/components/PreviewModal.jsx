export default function PreviewModal({ preview, onClose }) {
  if (!preview) return null;

  return (
    <div className="modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal__card">
        <button className="modal__close" type="button" aria-label="Close preview" onClick={onClose}>×</button>
        <p className="hint">Preview — rendered for a sample recipient (Jane Doe, Example Corp)</p>
        <div className="modal__subject">{preview.subject}</div>
        <div className="modal__body">{preview.body}</div>
      </div>
    </div>
  );
}
