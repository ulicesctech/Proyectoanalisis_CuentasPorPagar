let epoch = 0;
const cleaners = new Set<() => void>();
export const sessionEpoch = () => epoch;
export const registerSessionCleaner = (clean: () => void) => { cleaners.add(clean); };
export function clearSessionScope() {
  epoch += 1;
  cleaners.forEach(clean => clean());
  if (typeof window === 'undefined') return;
  for (const storage of [window.sessionStorage, window.localStorage]) {
    for (const key of Object.keys(storage)) if (/^cxp[.:]/i.test(key)) storage.removeItem(key);
  }
}
