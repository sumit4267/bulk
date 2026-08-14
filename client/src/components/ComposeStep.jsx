import { api } from '../api.js';

export default function ComposeStep({ subject, setSubject, body, setBody, onPreview, showToast }) {
  async function handlePreviewClick() {
    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();
    if (!trimmedSubject || !trimmedBody) {
      showToast('Write a subject and letter body first.', true);
      return;
    }
    try {
      const data = await api.previewEmail(trimmedSubject, trimmedBody);
      onPreview(data.subject, data.body);
    } catch (err) {
      showToast(err.message, true);
    }
  }

  return (
    <div className="step" data-step="3">
      <h2><span className="step__no">03</span> Write the letter once</h2>
      <p className="hint">
        Use <code>{'{{HR_NAME}}'}</code> and <code>{'{{COMPANY_NAME}}'}</code> (or{' '}
        <code>{'{{name}}'}</code>, <code>{'{{company}}'}</code>, <code>{'{{email}}'}</code>) — each
        dispatch is auto-personalized and rendered individually.
      </p>
      <input
        type="text"
        placeholder="Subject — e.g. Application for Software Engineer role"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />
      <textarea
        rows={10}
        placeholder={
          'Dear {{HR_NAME}},\n\nI hope you are doing well. I am writing to express my interest in opportunities at {{COMPANY_NAME}}. Please find my resume attached.\n\nThank you for your time and consideration.\n\nRegards,\nYour Name'
        }
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <button className="btn btn--ghost" type="button" onClick={handlePreviewClick}>
        Preview one letter
      </button>
    </div>
  );
}
