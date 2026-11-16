/**
 * Prints whatever is inside the `.print-root` portal and nothing else. The page size is set for
 * this print only (a receipt is 80 mm wide; labels set their own size). The desktop app replaces
 * this with direct ESC/POS printing behind the same call (phase 7).
 */
export function printPortal(pageCss: string, onDone?: () => void): void {
  const style = document.createElement('style');
  style.textContent = pageCss;
  document.head.appendChild(style);
  document.body.classList.add('printing');
  const cleanup = () => {
    document.body.classList.remove('printing');
    style.remove();
    window.removeEventListener('afterprint', cleanup);
    onDone?.();
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}

export const RECEIPT_PAGE_CSS = '@page { size: 80mm auto; margin: 0; }';
