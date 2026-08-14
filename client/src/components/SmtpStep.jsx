import { useState } from 'react';

export default function SmtpStep({ smtp }) {
  const {
    email, setEmail,
    password, setPassword,
    locked, verifying,
    resultText, resultState,
    verify, changeAccount,
  } = smtp;

  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="step" data-step="4">
      <h2><span className="step__no">04</span> SMTP sender</h2>
      <p className="hint">
        Enter the account to send from. No <code>.env</code> or code edits needed —
        credentials are verified live and used only for this session.
      </p>

      <div className={`smtpcard${locked ? ' is-locked' : ''}`}>
        <div className="smtpcard__row">
          <div className="smtpfield">
            <label htmlFor="smtpEmail">Email</label>
            <input
              id="smtpEmail"
              type="email"
              placeholder="you@gmail.com"
              autoComplete="username"
              disabled={locked}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="smtpfield">
            <label htmlFor="smtpPassword">SMTP / App password</label>
            <div className="smtpfield__pw">
              <input
                id="smtpPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••••"
                autoComplete="current-password"
                disabled={locked}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="smtpfield__eye"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
          </div>
        </div>

        <div className="smtpcard__actions">
          {!locked && (
            <button
              className="btn btn--verify"
              type="button"
              disabled={verifying}
              onClick={verify}
            >
              {verifying ? 'Verifying…' : 'Verify SMTP'}
            </button>
          )}
          {locked && (
            <button className="btn btn--linklike" type="button" onClick={changeAccount}>
              Use a different account
            </button>
          )}
        </div>

        <p className={`smtpresult${resultState ? ` is-${resultState}` : ''}`}>{resultText}</p>
      </div>
    </div>
  );
}
