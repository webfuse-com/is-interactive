import { checkInteractivity } from "./check-interactivity.js";
const CASCADING_NON_INTERACTIVITY_CHECKS = /* @__PURE__ */ new Set([
  "disconnected",
  "hidden",
  "inert",
  "ariaHidden",
  "invisible"
]);
function filterDOM(live, virtual, isRoot, checks) {
  const result = checkInteractivity(live, checks);
  if (!result.isInteractive && result.reason && CASCADING_NON_INTERACTIVITY_CHECKS.has(result.reason)) {
    if (!isRoot) {
      virtual.parentElement?.removeChild(virtual);
    }
    return false;
  }
  const pairs = [];
  let liveChild = live.firstElementChild;
  let virtualChild = virtual.firstElementChild;
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
  if (!keep) {
    virtual.parentElement?.removeChild(virtual);
  }
  return keep;
}
function filterInteractive(dom, checks, virtualRoot) {
  checks = {
    occluded: false,
    ...checks
  };
  const liveRoot = dom instanceof Document ? dom.documentElement : dom;
  virtualRoot ??= liveRoot.cloneNode(true);
  filterDOM(liveRoot, virtualRoot, true, checks);
  return virtualRoot;
}
export {
  filterInteractive
};
