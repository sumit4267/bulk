import { useRef, useState } from 'react';

export default function RecipientsStep({ recipients }) {
  const { recipientsText, setRecipientsText, manifestMeta, manifestState, uploadRecipientsFile } = recipients;
  const inputRef = useRef(null);
  const [isDrag, setIsDrag] = useState(false);
  const [parsing, setParsing] = useState(false);

  async function handleFile(file) {
    setParsing(true);
    try {
      await uploadRecipientsFile(file);
    } finally {
      setParsing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDrag(false);
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  }

  function handleChange(e) {
    if (e.target.files.length) handleFile(e.target.files[0]);
  }

  return (
    <div className="step" data-step="2">
      <h2><span className="step__no">02</span> Build your HR manifest</h2>
      <p className="hint">Upload a CSV or Excel file of HR emails — names and companies are auto-detected from each address:</p>

      <div
        className={`dropzone dropzone--compact${isDrag ? ' is-drag' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setIsDrag(true); }}
        onDragLeave={() => setIsDrag(false)}
        onDrop={handleDrop}
      >
        <input type="file" ref={inputRef} accept=".csv,.xlsx,.xls" hidden onChange={handleChange} />
        <p>{parsing ? 'Parsing…' : (<>Drop a CSV/XLSX here, or <span className="link">browse</span></>)}</p>
        <p className="hint">Just an "email" column is enough — name &amp; company are guessed automatically</p>
      </div>

      <p className="hint">…or paste addresses manually, one per line. Name/company are auto-detected too, but you can override them, comma-separated:</p>
      <p className="hint hint--mono">hr@acme.com, Jane Doe, Acme Corp</p>
      <textarea
        rows={7}
        placeholder={'hr@acme.com\ncareers@globex.com\njobs@initech.com, Sam Lee'}
        value={recipientsText}
        onChange={(e) => setRecipientsText(e.target.value)}
      />
      <div className={`manifest__meta${manifestState ? ` ${manifestState}` : ''}`}>{manifestMeta}</div>
    </div>
  );
}
