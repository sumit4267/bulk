import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

export function useRecipients(showToast) {
  const [recipientsText, setRecipientsText] = useState('');
  const [validCount, setValidCount] = useState(0);
  const [manifestMeta, setManifestMeta] = useState('No addresses parsed yet.');
  const [manifestState, setManifestState] = useState(''); // 'is-ready' | 'is-error' | ''
  const debounceRef = useRef(null);

  const previewRecipients = useCallback(async (raw) => {
    const text = raw.trim();
    if (!text) {
      setManifestMeta('No addresses parsed yet.');
      setManifestState('');
      setValidCount(0);
      return;
    }
    try {
      const data = await api.previewRecipients(text);
      setValidCount(data.validCount);
      let msg = `${data.validCount} valid address${data.validCount === 1 ? '' : 'es'}`;
      if (data.invalidCount) msg += ` · ${data.invalidCount} skipped (unparseable)`;
      if (data.exceedsMax) msg += ' · list truncated to max allowed';
      setManifestMeta(msg);
      setManifestState(data.validCount ? 'is-ready' : 'is-error');
    } catch (err) {
      setManifestMeta(err.message);
      setManifestState('is-error');
      setValidCount(0);
    }
  }, []);

  // Debounced re-parse whenever the pasted text changes, matching the
  // original 400ms debounce in script.js.
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => previewRecipients(recipientsText), 400);
    return () => clearTimeout(debounceRef.current);
  }, [recipientsText, previewRecipients]);

  const uploadRecipientsFile = useCallback(
    async (file) => {
      try {
        const data = await api.uploadRecipientsFile(file);
        setRecipientsText(data.rawText);
        showToast(
          `Loaded ${data.validCount} address${data.validCount === 1 ? '' : 'es'} from ${file.name} — names & companies auto-detected.`
        );
        await previewRecipients(data.rawText);
      } catch (err) {
        showToast(err.message, true);
      }
    },
    [previewRecipients, showToast]
  );

  return {
    recipientsText,
    setRecipientsText,
    validCount,
    manifestMeta,
    manifestState,
    uploadRecipientsFile,
  };
}
