function computeScrollDelta(near, far, viewport) {
  if (near >= 0 && far <= viewport) return 0;
  if (near < 0) return near;
  if (far > viewport) return far - viewport;
  return 0;
}
function scrollIntoViewSynchronously(element) {
  const restoreCbs = [];
  let currentElement = element.parentElement;
  while (currentElement) {
    const el = currentElement;
    currentElement = currentElement.parentElement;
    if (!(el instanceof HTMLElement)) continue;
    const isScrollable = el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth;
    if (!isScrollable) continue;
    const previousLeft = el.scrollLeft;
    const previousTop = el.scrollTop;
    const ancestorRect = el.getBoundingClientRect();
    const elementRect2 = element.getBoundingClientRect();
    const deltaX2 = computeScrollDelta(
      elementRect2.left - ancestorRect.left,
      elementRect2.right - ancestorRect.left,
      el.clientWidth
    );
    const deltaY2 = computeScrollDelta(
      elementRect2.top - ancestorRect.top,
      elementRect2.bottom - ancestorRect.top,
      el.clientHeight
    );
    if (deltaX2 !== 0 || deltaY2 !== 0) {
      el.scrollLeft = previousLeft + deltaX2;
      el.scrollTop = previousTop + deltaY2;
      restoreCbs.push(() => {
        el.scrollLeft = previousLeft;
        el.scrollTop = previousTop;
      });
    }
  }
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const elementRect = element.getBoundingClientRect();
  const deltaX = computeScrollDelta(elementRect.left, elementRect.right, viewportWidth);
  const deltaY = computeScrollDelta(elementRect.top, elementRect.bottom, viewportHeight);
  if (deltaX !== 0 || deltaY !== 0) {
    const previousX = window.scrollX;
    const previousY = window.scrollY;
    window.scrollTo(previousX + deltaX, previousY + deltaY);
    restoreCbs.push(() => {
      window.scrollTo(previousX, previousY);
    });
  }
  return restoreCbs;
}
export {
  scrollIntoViewSynchronously
};
