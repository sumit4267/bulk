export default function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`toast${toast.isError ? ' is-error' : ''}`}>
      {toast.message}
    </div>
  );
}
