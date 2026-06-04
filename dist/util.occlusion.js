import { scrollIntoViewSynchronously } from "./util.scroll.js";
function generateSamplePoints(rect, samples) {
  const sampleCount = Math.max(1, Math.floor(samples));
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const samplePoints = [[centerX, centerY]];
  if (sampleCount === 1) return samplePoints;
  const aspectRatio = rect.width / Math.max(1, rect.height);
  const gridY = Math.max(1, Math.round(Math.sqrt(sampleCount / aspectRatio)));
  const gridX = Math.max(1, Math.ceil(sampleCount / gridY));
  const left = rect.left + 1;
  const right = rect.right - 1;
  const top = rect.top + 1;
  const bottom = rect.bottom - 1;
  const stepX = gridX > 1 ? (right - left) / (gridX - 1) : 0;
  const stepY = gridY > 1 ? (bottom - top) / (gridY - 1) : 0;
  const candidates = [];
  for (let row = 0; row < gridY; row++) {
    for (let col = 0; col < gridX; col++) {
      const x = gridX > 1 ? left + col * stepX : centerX;
      const y = gridY > 1 ? top + row * stepY : centerY;
      const dx = x - centerX;
      const dy = y - centerY;
      const distanceSquared = dx * dx + dy * dy;
      candidates.push([x, y, distanceSquared]);
    }
  }
  candidates.sort((a, b) => {
    return a[2] - b[2];
  });
  for (let i = 0; i < candidates.length; i++) {
    if (samplePoints.length >= sampleCount) break;
    const x = candidates[i][0];
    const y = candidates[i][1];
    if (Math.abs(x - centerX) < 0.5 && Math.abs(y - centerY) < 0.5) continue;
    samplePoints.push([x, y]);
  }
  return samplePoints;
}
function composedContains(ancestor, node) {
  while (node) {
    if (node === ancestor) return true;
    const parent = node.parentNode;
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
function isElementOnHit(element, rect, samples, viewportWidth, viewportHeight) {
  const points = generateSamplePoints(rect, samples);
  for (const point of points) {
    const x = point[0];
    const y = point[1];
    if (x < 0 || y < 0 || x >= viewportWidth || y >= viewportHeight) continue;
    const stack = document.elementsFromPoint(x, y) ?? [];
    if (stack.length === 0) continue;
    const hitElement = stack[0];
    if (hitElement === element || composedContains(element, hitElement) || composedContains(hitElement, element)) return true;
  }
  return false;
}
function isElementOccluded(element, samples) {
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const scrollRestoreCbs = scrollIntoViewSynchronously(element);
  let isOccluded = false;
  try {
    const rect = element.getBoundingClientRect();
    isOccluded = !isElementOnHit(element, rect, samples, viewportWidth, viewportHeight);
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
