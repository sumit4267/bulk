import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

// Mirrors the original script.js SMTP flow:
//  - on load, check /api/smtp-status (session cookie or .env fallback)
//  - Verify SMTP posts { email, password } and never gets the password back
//  - on success the form locks and "Use a different account" clears it
export function useSmtp(showToast) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verified, setVerified] = useState(false);
  const [locked, setLocked] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resultText, setResultText] = useState('');
  const [resultState, setResultState] = useState(''); // 'ok' | 'fail' | 'pending' | ''
  const [sendDelayMs, setSendDelayMs] = useState(3000);

  useEffect(() => {
    let cancelled = false;

    api
      .health()
      .catch(() => showToast('Cannot reach server.', true));

    api
      .smtpStatus()
      .then((data) => {
        if (cancelled) return;
        if (typeof data.sendDelayMs === 'number') setSendDelayMs(data.sendDelayMs);
        setVerified(!!data.verified);

        if (data.verified && data.sender) {
          if (data.source === 'session') {
            setEmail(data.sender);
            setLocked(true);
            setResultText('✓ SMTP Verified');
            setResultState('ok');
          } else {
            setEmail(data.sender);
            setResultText(`✓ Using server-configured sender (${data.sender}) — verify below to switch accounts`);
            setResultState('ok');
          }
        } else if (data.sender || data.error) {
          setResultText(`✕ ${data.error || 'Verification failed'}`);
          setResultState('fail');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setVerified(false);
        setResultText('Could not reach /api/smtp-status');
        setResultState('fail');
      });

    return () => {
      cancelled = true;
    };
  }, [showToast]);

  const verify = useCallback(async () => {
    if (!email.trim() || !password) {
      showToast('Enter both an email and a password.', true);
      return;
    }
    setVerifying(true);
    setResultText('Checking with the SMTP server…');
    setResultState('pending');

    try {
      const data = await api.smtpVerify(email.trim(), password);
      if (data.verified) {
        setVerified(true);
        setResultText('✓ SMTP Verified');
        setResultState('ok');
        setLocked(true);
        setEmail(data.email || email.trim());
        setPassword(''); // never retained after a successful verify
        showToast('SMTP verified — this account will be used for sending.');
      } else {
        setVerified(false);
        setResultText('✕ Verification Failed');
        setResultState('fail');
        showToast(data.error || 'SMTP verification failed.', true);
      }
    } catch {
      setVerified(false);
      setResultText('✕ Verification Failed');
      setResultState('fail');
      showToast('Could not reach the server to verify SMTP.', true);
    } finally {
      setVerifying(false);
    }
  }, [email, password, showToast]);

  const changeAccount = useCallback(async () => {
    try {
      await api.smtpLogout();
    } catch {
      // non-fatal — reset the form locally regardless
    }
    setVerified(false);
    setEmail('');
    setPassword('');
    setResultText('');
    setResultState('');
    setLocked(false);
  }, []);

  return {
    email,
    setEmail,
    password,
    setPassword,
    verified,
    locked,
    verifying,
    resultText,
    resultState,
    sendDelayMs,
    verify,
    changeAccount,
  };
}
