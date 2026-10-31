import type { ReactNode } from 'react';
export const captureTitleClass = 'text-lg font-bold text-slate-900 focus:outline-none';
export const captureSubtitleClass = 'text-sm text-slate-500 mt-1';
export const captureFooterClass = 'cxp-dialog-footer flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 mt-6 pt-4';
export function CxpCaptureSectionHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-bold text-slate-900 mb-3">{children}</h3>;
}
