const nativeScrollTop = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop").set;
const nativeScrollLeft = Object.getOwnPropertyDescriptor(Element.prototype, "scrollLeft").set;
const nativeWindowScrollTo = window.scrollTo.bind(window);
function computeScrollDelta(near, far, viewport) {
  if (near >= 0 && far <= viewport) return 0;
  if (near < 0) return near;
  if (far > viewport) return far - viewport;
  return 0;
}
function resolveParent(node) {
  if (node.parentElement) return node.parentElement;
  const root = node.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}
function scrollIntoViewSynchronously(element) {
  const restoreCbs = [];
  let nextElement = resolveParent(element);
  while (nextElement) {
    const currentElement = nextElement;
    nextElement = resolveParent(currentElement);
    if (!(currentElement instanceof HTMLElement)) continue;
    const isScrollable = currentElement.scrollHeight > currentElement.clientHeight || currentElement.scrollWidth > currentElement.clientWidth;
    if (!isScrollable) continue;
    const previousLeft = currentElement.scrollLeft;
    const previousTop = currentElement.scrollTop;
    const ancestorRect = currentElement.getBoundingClientRect();
    const elementRect2 = element.getBoundingClientRect();
    const deltaX2 = computeScrollDelta(
      elementRect2.left - ancestorRect.left,
      elementRect2.right - ancestorRect.left,
      currentElement.clientWidth
    );
    const deltaY2 = computeScrollDelta(
      elementRect2.top - ancestorRect.top,
      elementRect2.bottom - ancestorRect.top,
      currentElement.clientHeight
    );
    if (deltaX2 !== 0 || deltaY2 !== 0) {
      nativeScrollLeft.call(currentElement, previousLeft + deltaX2);
      nativeScrollTop.call(currentElement, previousTop + deltaY2);
      restoreCbs.push(() => {
        nativeScrollLeft.call(currentElement, previousLeft);
        nativeScrollTop.call(currentElement, previousTop);
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
    nativeWindowScrollTo({
      top: previousY + deltaY,
      left: previousX + deltaX,
      behavior: "instant"
    });
    restoreCbs.push(() => {
      nativeWindowScrollTo({
        top: previousY,
        left: previousX,
        behavior: "instant"
      });
    });
  }
  return restoreCbs;
}
export {
  scrollIntoViewSynchronously
};
