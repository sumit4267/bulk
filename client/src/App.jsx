import { useMemo, useState } from 'react';
import { useToast } from './hooks/useToast.js';
import { useSmtp } from './hooks/useSmtp.js';
import { useRecipients } from './hooks/useRecipients.js';
import { useCampaign } from './hooks/useCampaign.js';

import Letterhead from './components/Letterhead.jsx';
import ResumeStep from './components/ResumeStep.jsx';
import RecipientsStep from './components/RecipientsStep.jsx';
import ComposeStep from './components/ComposeStep.jsx';
import SmtpStep from './components/SmtpStep.jsx';
import SendBar from './components/SendBar.jsx';
import ManifestPanel from './components/ManifestPanel.jsx';
import PreviewModal from './components/PreviewModal.jsx';
import Toast from './components/Toast.jsx';

export default function App() {
  const { toast, showToast } = useToast();
  const smtp = useSmtp(showToast);
  const recipients = useRecipients(showToast);
  const campaign = useCampaign(showToast);

  const [uploadedFile, setUploadedFile] = useState(null); // { filePath, originalName, sizeKb }
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState(null); // { subject, body } | null

  const ready = recipients.validCount > 0 && subject.trim() !== '' && body.trim() !== '' && smtp.verified;
  const etaMinutes = useMemo(
    () => Math.max(1, Math.ceil((recipients.validCount * smtp.sendDelayMs) / 60000)),
    [recipients.validCount, smtp.sendDelayMs]
  );

  async function handleSend() {
    if (!ready || campaign.sending) return;
    const confirmed = window.confirm(
      `You're about to send ${recipients.validCount} individual, personalized emails. Continue?`
    );
    if (!confirmed) return;

    const payload = {
      recipients: recipients.recipientsText.trim(),
      subject: subject.trim(),
      body: body.trim(),
    };
    if (uploadedFile) {
      payload.resumeFile = uploadedFile.filePath;
      payload.resumeOriginalName = uploadedFile.originalName;
    }

    campaign.start(payload);
  }

  return (
    <div className="desk">
      <Letterhead smtpVerified={smtp.verified} />

      <div className="deskgrid">
        <section className="panel compose">
          <ResumeStep uploadedFile={uploadedFile} setUploadedFile={setUploadedFile} showToast={showToast} />
          <RecipientsStep recipients={recipients} />
          <ComposeStep
            subject={subject}
            setSubject={setSubject}
            body={body}
            setBody={setBody}
            onPreview={(s, b) => setPreview({ subject: s, body: b })}
            showToast={showToast}
          />
          <SmtpStep smtp={smtp} />

          <SendBar
            ready={ready}
            sending={campaign.sending}
            validCount={recipients.validCount}
            etaMinutes={etaMinutes}
            onSend={handleSend}
          />
        </section>

        <ManifestPanel campaign={campaign} />
      </div>

      <PreviewModal preview={preview} onClose={() => setPreview(null)} />
      <Toast toast={toast} />
    </div>
  );
}
