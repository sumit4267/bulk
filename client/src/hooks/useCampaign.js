import { useCallback, useRef, useState } from 'react';
import { api } from '../api.js';

export function useCampaign(showToast) {
  const [jobId, setJobId] = useState(null);
  const [sending, setSending] = useState(false);
  const [stats, setStats] = useState({ sent: 0, failed: 0, total: 0 });
  const [ticker, setTicker] = useState([]); // [{ key, email, status, error }]
  const pollTimerRef = useRef(null);
  const seenRef = useRef(new Set());

  const resetTicker = useCallback(() => {
    setStats({ sent: 0, failed: 0, total: 0 });
    setTicker([]);
    seenRef.current = new Set();
  }, []);

  const mergeResults = useCallback((recentResults) => {
    if (!recentResults || !recentResults.length) return;
    const additions = [];
    for (const r of recentResults) {
      const key = `${r.email}-${r.status}`;
      if (seenRef.current.has(key)) continue;
      seenRef.current.add(key);
      additions.push({ key, email: r.email, status: r.status, error: r.error });
    }
    if (additions.length) setTicker((prev) => [...prev, ...additions]);
  }, []);

  const pollStatus = useCallback(
    async (id) => {
      try {
        const data = await api.campaignStatus(id);
        setStats({ sent: data.sent, failed: data.failed, total: data.total });
        mergeResults(data.recentResults);

        if (data.status === 'completed' || data.status === 'cancelled' || data.status === 'failed') {
          setSending(false);
          if (data.status === 'completed') showToast(`Dispatch complete — ${data.sent} sent, ${data.failed} failed.`);
          if (data.status === 'cancelled') showToast('Dispatch halted.');
          if (data.status === 'failed') showToast(data.error || 'Dispatch failed.', true);
          setJobId(null);
          return;
        }

        pollTimerRef.current = setTimeout(() => pollStatus(id), 1500);
      } catch (err) {
        showToast(err.message, true);
        setSending(false);
        setJobId(null);
      }
    },
    [mergeResults, showToast]
  );

  const start = useCallback(
    async (payload) => {
      setSending(true);
      resetTicker();
      try {
        const data = await api.startCampaign(payload);
        setJobId(data.jobId);
        setStats((s) => ({ ...s, total: data.totalRecipients }));
        pollStatus(data.jobId);
      } catch (err) {
        showToast(err.message, true);
        setSending(false);
      }
    },
    [pollStatus, resetTicker, showToast]
  );

  const cancel = useCallback(async () => {
    if (!jobId) return;
    await api.cancelCampaign(jobId).catch(() => {});
    showToast('Halt requested — finishing the letter in flight.');
  }, [jobId, showToast]);

  return { jobId, sending, stats, ticker, start, cancel };
}
