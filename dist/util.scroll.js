const nativeScrollTop = (Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop") ?? Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTop"))?.set;
const nativeScrollLeft = (Object.getOwnPropertyDescriptor(Element.prototype, "scrollLeft") ?? Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollLeft"))?.set;
const nativeWindowScrollTo = window.scrollTo.bind(window);
const suppressedScrollPositions = /* @__PURE__ */ new Map();
function readScrollPosition(target) {
  return target === document ? [window.scrollX, window.scrollY] : [target.scrollLeft, target.scrollTop];
}
function suppressScrollEvent(event) {
  if (!event.isTrusted || !event.target) return;
  const position = suppressedScrollPositions.get(event.target);
  if (!position) return;
  const currentPosition = readScrollPosition(event.target);
  if (currentPosition[0] !== position[0] || currentPosition[1] !== position[1]) return;
  event.stopImmediatePropagation();
}
function suppressScrollEvents(target) {
  if (suppressedScrollPositions.has(target)) return;
  if (!suppressedScrollPositions.size) {
    window.addEventListener("scroll", suppressScrollEvent, true);
    window.addEventListener("scrollend", suppressScrollEvent, true);
    requestAnimationFrame(() => {
      window.removeEventListener("scroll", suppressScrollEvent, true);
      window.removeEventListener("scrollend", suppressScrollEvent, true);
      suppressedScrollPositions.clear();
    });
  }
  suppressedScrollPositions.set(target, readScrollPosition(target));
}
function computeScrollDelta(near, far, viewport) {
  if (near >= 0 && far <= viewport) return 0;
  if (near < 0) return near;
  if (far > viewport) return far - viewport;
  return 0;
}
function resolveParent(node) {
  if (node.assignedSlot) return node.assignedSlot;
  if (node.parentElement) return node.parentElement;
  const root = node.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}
function scrollWindowTo(left, top) {
  suppressScrollEvents(document);
  nativeWindowScrollTo({
    top,
    left,
    behavior: "instant"
  });
}
function scrollIntoViewSynchronously(element, policy = { containers: true, viewport: true }) {
  const restoreCbs = [];
  if (!nativeScrollLeft || !nativeScrollTop) return restoreCbs;
  const visited = /* @__PURE__ */ new Set();
  let nextElement = resolveParent(element);
  while (nextElement && policy.containers) {
    if (visited.has(nextElement)) break;
    visited.add(nextElement);
    const currentElement = nextElement;
    nextElement = resolveParent(currentElement);
    if (!(currentElement instanceof HTMLElement)) continue;
    const currentStyle = getComputedStyle(currentElement);
    const scrollableX = currentElement.scrollWidth > currentElement.clientWidth && (currentStyle.overflowX === "auto" || currentStyle.overflowX === "scroll");
    const scrollableY = currentElement.scrollHeight > currentElement.clientHeight && (currentStyle.overflowY === "auto" || currentStyle.overflowY === "scroll");
    if (!scrollableX && !scrollableY) continue;
    const previousLeft = currentElement.scrollLeft;
    const previousTop = currentElement.scrollTop;
    const ancestorRect = currentElement.getBoundingClientRect();
    const elementRect2 = element.getBoundingClientRect();
    const deltaX2 = scrollableX ? computeScrollDelta(
      elementRect2.left - ancestorRect.left,
      elementRect2.right - ancestorRect.left,
      currentElement.clientWidth
    ) : 0;
    const deltaY2 = scrollableY ? computeScrollDelta(
      elementRect2.top - ancestorRect.top,
      elementRect2.bottom - ancestorRect.top,
      currentElement.clientHeight
    ) : 0;
    if (deltaX2 !== 0 || deltaY2 !== 0) {
      suppressScrollEvents(currentElement);
      nativeScrollLeft.call(currentElement, previousLeft + deltaX2);
      nativeScrollTop.call(currentElement, previousTop + deltaY2);
      restoreCbs.push(() => {
        nativeScrollLeft.call(currentElement, previousLeft);
        nativeScrollTop.call(currentElement, previousTop);
      });
    }
  }
  if (!policy.viewport) return restoreCbs;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const elementRect = element.getBoundingClientRect();
  const deltaX = computeScrollDelta(elementRect.left, elementRect.right, viewportWidth);
  const deltaY = computeScrollDelta(elementRect.top, elementRect.bottom, viewportHeight);
  if (deltaX !== 0 || deltaY !== 0) {
    const previousX = window.scrollX;
    const previousY = window.scrollY;
    scrollWindowTo(previousX + deltaX, previousY + deltaY);
    restoreCbs.push(() => {
      scrollWindowTo(previousX, previousY);
    });
  }
  return restoreCbs;
}
export {
  computeScrollDelta,
  resolveParent,
  scrollIntoViewSynchronously,
  scrollWindowTo
};
