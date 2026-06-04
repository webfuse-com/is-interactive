import { checkInteractivity } from "./check-interactivity.js";
const CASCADING_NON_INTERACTIVITY_CHECKS = /* @__PURE__ */ new Set([
  "disconnected",
  "hidden",
  "inert",
  "ariaHidden",
  "invisible"
]);
function cloneWithShadow(node) {
  const clone = node.cloneNode(false);
  const shadow = node.shadowRoot;
  if (shadow) {
    const clonedShadow = clone.attachShadow({
      mode: shadow.mode,
      serializable: true
    });
    for (let child = shadow.firstElementChild; child; child = child.nextElementSibling) {
      clonedShadow.appendChild(cloneWithShadow(child));
    }
  }
  for (const child of node.childNodes) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      clone.appendChild(cloneWithShadow(child));
    } else {
      clone.appendChild(child.cloneNode(true));
    }
  }
  return clone;
}
function removeVirtual(virtual) {
  const parent = virtual.parentElement ?? virtual.parentNode;
  parent?.removeChild(virtual);
}
function filterDOM(liveElement, virtualElement, isRoot, checks) {
  const result = checkInteractivity(liveElement, checks);
  if (!result.isInteractive && result.reason && CASCADING_NON_INTERACTIVITY_CHECKS.has(result.reason)) {
    if (!isRoot) removeVirtual(virtualElement);
    return false;
  }
  const pairs = [];
  const liveShadow = liveElement.shadowRoot;
  const virtualShadow = virtualElement.shadowRoot;
  if (liveShadow && virtualShadow) {
    let liveChild2 = liveShadow.firstElementChild;
    let virtualChild2 = virtualShadow.firstElementChild;
    while (liveChild2 && virtualChild2) {
      pairs.push([liveChild2, virtualChild2]);
      liveChild2 = liveChild2.nextElementSibling;
      virtualChild2 = virtualChild2.nextElementSibling;
    }
  }
  let liveChild = liveElement.firstElementChild;
  let virtualChild = virtualElement.firstElementChild;
  while (liveChild && virtualChild) {
    pairs.push([liveChild, virtualChild]);
    liveChild = liveChild.nextElementSibling;
    virtualChild = virtualChild.nextElementSibling;
  }
  let hasInteractiveDescendant = false;
  for (const [l, v] of pairs) {
    if (filterDOM(l, v, false, checks)) {
      hasInteractiveDescendant = true;
    }
  }
  const keep = result.isInteractive || hasInteractiveDescendant;
  if (isRoot) return keep;
  if (!keep) removeVirtual(virtualElement);
  return keep;
}
function filterInteractive(dom, checks, virtualDOM) {
  checks = {
    occluded: false,
    ...checks
  };
  const liveRoot = dom instanceof Document ? dom.documentElement : dom;
  const virtualRoot = virtualDOM ? virtualDOM instanceof Document ? virtualDOM.documentElement : virtualDOM : cloneWithShadow(liveRoot);
  filterDOM(liveRoot, virtualRoot, true, checks);
  return virtualRoot;
}
export {
  filterInteractive
};
