import { checkInteractivity } from "./check-interactivity.js";
const CASCADING_NON_INTERACTIVITY_CHECKS = /* @__PURE__ */ new Set([
  "disconnected",
  "hidden",
  "inert",
  "ariaHidden",
  "invisible"
]);
function markDOM(live, virtual, marks, checks) {
  const result = checkInteractivity(live, checks);
  marks.set(virtual, result);
  if (!result.isInteractive && result.reason && CASCADING_NON_INTERACTIVITY_CHECKS.has(result.reason)) return;
  let liveChild = live.firstElementChild;
  let virtualChild = virtual.firstElementChild;
  while (liveChild && virtualChild) {
    markDOM(liveChild, virtualChild, marks, checks);
    liveChild = liveChild.nextElementSibling;
    virtualChild = virtualChild.nextElementSibling;
  }
}
function restructureDOM(node, isRoot, marks) {
  const children = [];
  for (let child = node.firstElementChild; child; child = child.nextElementSibling) {
    children.push(child);
  }
  for (const child of children) {
    restructureDOM(child, false, marks);
  }
  if (isRoot) return;
  const result = marks.get(node) ?? { isInteractive: false };
  if (result.isInteractive) return;
  const parent = node.parentElement;
  if (!parent) return;
  while (node.firstElementChild) {
    parent.insertBefore(node.firstElementChild, node);
  }
  parent.removeChild(node);
}
function filterInteractive(dom, checks) {
  checks = {
    occluded: false,
    ...checks
  };
  const liveRoot = dom instanceof Document ? dom.documentElement : dom;
  const virtualRoot = liveRoot.cloneNode(true);
  const marks = /* @__PURE__ */ new Map();
  markDOM(liveRoot, virtualRoot, marks, checks);
  restructureDOM(virtualRoot, true, marks);
  return virtualRoot;
}
export {
  filterInteractive
};
