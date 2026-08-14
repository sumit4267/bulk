export default function Letterhead({ smtpVerified }) {
  return (
    <header className="letterhead">
      <div className="letterhead__mark">✉</div>
      <div className="letterhead__text">
        <h1>Resume Mailer Pro</h1>
        <p className="letterhead__sub">Dispatch Desk — one resume, one inbox at a time</p>
      </div>
      <div className="letterhead__status">
        <span className={`dot${smtpVerified ? ' dot--ok' : ' dot--error'}`} />
        {smtpVerified ? ' SMTP Verified' : ' SMTP not verified'}
      </div>
    </header>
  );
}
