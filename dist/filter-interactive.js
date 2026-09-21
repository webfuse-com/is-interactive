import { checkInteractivity } from "./check-interactivity.js";
const CASCADING_NON_INTERACTIVITY_CHECKS = /* @__PURE__ */ new Set([
  "disconnected",
  "hidden",
  "inert",
  "ariaHidden",
  "invisible"
]);
const DEFAULT_FILTER_OVERRIDE_INTERACTIVITY_CHECKS = new Map(
  Object.entries({
    // Do not filter 'styled' inputs (commonly deliberately hidden or occluded by click-through custom UI)
    "input": {
      clipped: false,
      collapsed: false,
      invisible: false,
      occluded: false
    },
    "select": {
      clipped: false,
      collapsed: false,
      invisible: false,
      occluded: false
    }
  })
);
function pickCascading(overrides) {
  return Object.fromEntries(
    Object.entries(overrides).filter((entry) => CASCADING_NON_INTERACTIVITY_CHECKS.has(entry[0]))
  );
}
function collectRescueSelectors(elementOverrideChecks) {
  const tagNamesByReason = /* @__PURE__ */ new Map();
  for (const [tagName, overrides] of elementOverrideChecks) {
    for (const [check, isEnabled] of Object.entries(pickCascading(overrides))) {
      if (isEnabled !== false) continue;
      const tagNames = tagNamesByReason.get(check) ?? [];
      tagNames.push(tagName);
      tagNamesByReason.set(check, tagNames);
    }
  }
  return new Map(
    [...tagNamesByReason].map((entry) => [entry[0], entry[1].join(",")])
  );
}
function containsDeep(root, selector) {
  if (root.querySelector(selector)) return true;
  const shadow = root instanceof Element ? root.shadowRoot : null;
  if (shadow && containsDeep(shadow, selector)) return true;
  for (const descendant of root.querySelectorAll("*")) {
    if (descendant.shadowRoot && containsDeep(descendant.shadowRoot, selector)) return true;
  }
  return false;
}
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
function filterDOM(liveElement, virtualElement, isRoot, checks, inheritedChecks, elementOverrideChecks, rescueSelectors, onNonInteractive) {
  const overrides = elementOverrideChecks.get(liveElement.tagName.toLowerCase()) ?? {};
  const applicableChecks = {
    ...checks,
    ...inheritedChecks,
    ...overrides
  };
  const descendantChecks = Object.keys(overrides).length ? { ...inheritedChecks, ...pickCascading(overrides) } : inheritedChecks;
  const result = checkInteractivity(liveElement, applicableChecks);
  if (onNonInteractive && !result.isInteractive) {
    onNonInteractive(liveElement, result.reason);
  }
  if (!result.isInteractive && result.reason && CASCADING_NON_INTERACTIVITY_CHECKS.has(result.reason)) {
    const rescueSelector = rescueSelectors.get(result.reason);
    if (!rescueSelector || !containsDeep(liveElement, rescueSelector)) {
      if (!isRoot) {
        removeVirtual(virtualElement);
      }
      return false;
    }
  }
  if (liveElement instanceof HTMLSelectElement && !liveElement.multiple && liveElement.size <= 1) {
    if (isRoot) return result.isInteractive;
    if (!result.isInteractive) {
      removeVirtual(virtualElement);
    }
    return result.isInteractive;
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
  for (const [liveElement2, virtualElement2] of pairs) {
    if (filterDOM(liveElement2, virtualElement2, false, checks, descendantChecks, elementOverrideChecks, rescueSelectors, onNonInteractive)) {
      hasInteractiveDescendant = true;
    }
  }
  const keep = result.isInteractive || hasInteractiveDescendant;
  if (isRoot) return keep;
  if (!keep) removeVirtual(virtualElement);
  return keep;
}
function filterInteractive(dom, checks = {}, elementOverrideChecks = DEFAULT_FILTER_OVERRIDE_INTERACTIVITY_CHECKS, virtualDOM, onNonInteractive) {
  elementOverrideChecks = new Map(
    Object.entries(elementOverrideChecks).map((entry) => [entry[0].toLowerCase(), entry[1]])
  );
  const rescueSelectors = collectRescueSelectors(elementOverrideChecks);
  const liveRoot = dom instanceof Document ? dom.documentElement : dom;
  const virtualRoot = virtualDOM ? virtualDOM instanceof Document ? virtualDOM.documentElement : virtualDOM : cloneWithShadow(liveRoot);
  filterDOM(liveRoot, virtualRoot, true, checks, {}, elementOverrideChecks, rescueSelectors, onNonInteractive);
  return virtualRoot;
}
export {
  filterInteractive
};
