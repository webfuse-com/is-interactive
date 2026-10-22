import { resolveParent, scrollIntoViewSynchronously } from "./util.scroll.js";
const MIN_BOX_SIZE = 1;
const SCROLL_OVERFLOW_VALUES = ["auto", "scroll"];
const CONTAINER_POSITION_VALUES = ["relative", "absolute", "fixed", "sticky"];
function createBox(left, top, right, bottom) {
  return right - left >= MIN_BOX_SIZE && bottom - top >= MIN_BOX_SIZE ? [left, top, right, bottom] : null;
}
function intersectBoxes(a, b) {
  return createBox(Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3]));
}
function getBoxArea(box) {
  return (box[2] - box[0]) * (box[3] - box[1]);
}
function subtractBox(box, cut) {
  return [
    createBox(box[0], box[1], box[2], cut[1]),
    createBox(box[0], cut[3], box[2], box[3]),
    createBox(box[0], cut[1], cut[0], cut[3]),
    createBox(cut[2], cut[1], box[2], cut[3])
  ].filter((box2) => !!box2);
}
function getCoveredBox(occluder, x, y, box) {
  for (const rect of occluder?.getClientRects() ?? []) {
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) continue;
    const coveredBox = intersectBoxes([rect.left, rect.top, rect.right, rect.bottom], box);
    if (coveredBox) return coveredBox;
  }
  const width = (box[2] - box[0]) / 4;
  const height = (box[3] - box[1]) / 4;
  return intersectBoxes([x - width, y - height, x + width, y + height], box) ?? box;
}
function getScrollContainerClipBox(element, viewportBox) {
  let clipBox = viewportBox;
  let position = getComputedStyle(element).position;
  if (position === "fixed") return clipBox;
  let needsContainingBlock = position === "absolute";
  for (let ancestor = resolveParent(element); ancestor && clipBox; ancestor = resolveParent(ancestor)) {
    const style = getComputedStyle(ancestor);
    position = style.position;
    if (needsContainingBlock && !CONTAINER_POSITION_VALUES.includes(position)) continue;
    needsContainingBlock = position === "absolute";
    const scrollsX = SCROLL_OVERFLOW_VALUES.includes(style.overflowX);
    const scrollsY = SCROLL_OVERFLOW_VALUES.includes(style.overflowY);
    if (scrollsX || scrollsY) {
      const ancestorRect = ancestor.getBoundingClientRect();
      const left = ancestorRect.left + ancestor.clientLeft;
      const top = ancestorRect.top + ancestor.clientTop;
      clipBox = intersectBoxes(clipBox, [
        scrollsX ? left : -Infinity,
        scrollsY ? top : -Infinity,
        scrollsX ? left + ancestor.clientWidth : Infinity,
        scrollsY ? top + ancestor.clientHeight : Infinity
      ]);
    }
    if (position === "fixed") break;
  }
  return clipBox;
}
function composedContains(ancestor, node) {
  const visited = /* @__PURE__ */ new Set();
  while (node) {
    if (node === ancestor) return true;
    if (visited.has(node)) break;
    visited.add(node);
    const parent = node.assignedSlot ?? node.parentNode;
    if (parent) {
      node = parent;
      continue;
    }
    if (node.host instanceof Element) {
      node = node.host;
      continue;
    }
    break;
  }
  return false;
}
function isRelatedHit(element, hitElement) {
  return !!hitElement && (hitElement === element || composedContains(element, hitElement) || composedContains(hitElement, element));
}
function isElementOnHit(element, rect, samples, clipBox) {
  const elementRoot = element.getRootNode();
  const root = elementRoot instanceof ShadowRoot ? elementRoot : document;
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  if (rect.width < MIN_BOX_SIZE || rect.height < MIN_BOX_SIZE) {
    return centerX >= clipBox[0] && centerY >= clipBox[1] && centerX < clipBox[2] && centerY < clipBox[3] && isRelatedHit(element, root.elementFromPoint(centerX, centerY));
  }
  const visibleBox = intersectBoxes([rect.left, rect.top, rect.right, rect.bottom], clipBox);
  if (!visibleBox) return false;
  const boxes = [visibleBox];
  const coveredBoxes = [];
  const hits = /* @__PURE__ */ new Map();
  let remainingHitTests = Math.max(1, Math.floor(samples));
  const hitTest = (x, y) => {
    const key = `${Math.round(x)},${Math.round(y)}`;
    if (!hits.has(key)) {
      remainingHitTests--;
      hits.set(key, root.elementFromPoint(x, y));
    }
    return hits.get(key) ?? null;
  };
  while (boxes.length && remainingHitTests > 0) {
    boxes.sort((a, b) => getBoxArea(b) - getBoxArea(a));
    const box = boxes.shift();
    const x = (box[0] + box[2]) / 2;
    const y = (box[1] + box[3]) / 2;
    const hitElement = hitTest(x, y);
    if (isRelatedHit(element, hitElement)) return true;
    const coveredBox = getCoveredBox(hitElement, x, y, box);
    coveredBoxes.push(coveredBox);
    boxes.push(...subtractBox(box, coveredBox));
  }
  for (const coveredBox of coveredBoxes) {
    if (coveredBox[2] - coveredBox[0] < 2 || coveredBox[3] - coveredBox[1] < 2) continue;
    const corners = [
      [coveredBox[0] + 1, coveredBox[1] + 1],
      [coveredBox[2] - 1, coveredBox[1] + 1],
      [coveredBox[0] + 1, coveredBox[3] - 1],
      [coveredBox[2] - 1, coveredBox[3] - 1]
    ];
    for (const corner of corners) {
      if (remainingHitTests <= 0) return false;
      if (isRelatedHit(element, hitTest(corner[0], corner[1]))) return true;
    }
  }
  return false;
}
function isElementOccluded(element, samples, scrollPolicy = { containers: true, viewport: true }) {
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const scrollRestoreCbs = scrollIntoViewSynchronously(element, scrollPolicy);
  let isOccluded = false;
  try {
    const rect = element.getBoundingClientRect();
    const viewportBox = [0, 0, viewportWidth, viewportHeight];
    const clipBox = scrollPolicy.containers ? viewportBox : getScrollContainerClipBox(element, viewportBox);
    isOccluded = !clipBox || !isElementOnHit(element, rect, samples, clipBox);
  } finally {
    for (let index = scrollRestoreCbs.length - 1; index >= 0; index--) {
      scrollRestoreCbs[index]();
    }
  }
  return isOccluded;
}
export {
  isElementOccluded
};
