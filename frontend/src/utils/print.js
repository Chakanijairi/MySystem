/**
 * Print only the element matched by `selector`. Everything else on the page
 * is visually hidden during print via CSS (see index.css `.printing` rules).
 */
export function printElement(selector) {
  const el = typeof selector === 'string' ? document.querySelector(selector) : selector
  if (!el) {
    window.print()
    return
  }
  el.classList.add('print-active')
  document.body.classList.add('printing')

  let done = false
  function cleanup() {
    if (done) return
    done = true
    el.classList.remove('print-active')
    document.body.classList.remove('printing')
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  // Fallback in case afterprint never fires (e.g. some embedded environments).
  window.setTimeout(cleanup, 5000)
  window.print()
}
