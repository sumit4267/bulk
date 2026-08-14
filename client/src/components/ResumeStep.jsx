import { useRef, useState } from 'react';
import { api } from '../api.js';

export default function ResumeStep({ uploadedFile, setUploadedFile, showToast }) {
  const inputRef = useRef(null);
  const [isDrag, setIsDrag] = useState(false);

  async function uploadResume(file) {
    try {
      const data = await api.uploadResume(file);
      setUploadedFile({ filePath: data.filePath, originalName: data.originalName, sizeKb: data.sizeKb });
      showToast('Resume attached.');
    } catch (err) {
      showToast(err.message, true);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDrag(false);
    if (e.dataTransfer.files.length) uploadResume(e.dataTransfer.files[0]);
  }

  function handleChange(e) {
    if (e.target.files.length) uploadResume(e.target.files[0]);
  }

  function remove() {
    setUploadedFile(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="step" data-step="1">
      <h2><span className="step__no">01</span> Attach your resume</h2>

      {!uploadedFile && (
        <div
          className={`dropzone${isDrag ? ' is-drag' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
          onDragOver={(e) => { e.preventDefault(); setIsDrag(true); }}
          onDragLeave={() => setIsDrag(false)}
          onDrop={handleDrop}
        >
          <input type="file" ref={inputRef} accept=".pdf,.doc,.docx" hidden onChange={handleChange} />
          <p>Drop your resume here, or <span className="link">browse</span></p>
          <p className="hint">PDF, DOC, or DOCX — up to 5MB</p>
        </div>
      )}

      {uploadedFile && (
        <div className="filecard">
          <span className="filecard__icon">📎</span>
          <span className="filecard__name">{uploadedFile.originalName} · {uploadedFile.sizeKb} KB</span>
          <button className="filecard__remove" type="button" aria-label="Remove resume" onClick={remove}>×</button>
        </div>
      )}
    </div>
  );
}
