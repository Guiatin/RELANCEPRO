export function readCookie(name) {
  if (typeof document === 'undefined') return null;

  const prefix = `${name}=`;
  const entry = document.cookie.split('; ').find((cookie) => cookie.startsWith(prefix));

  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
}
