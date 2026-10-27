"use strict";
(() => {
  // src/util.scroll.ts
  var nativeScrollTop = (Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop") ?? Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTop"))?.set;
  var nativeScrollLeft = (Object.getOwnPropertyDescriptor(Element.prototype, "scrollLeft") ?? Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollLeft"))?.set;
  var nativeWindowScrollTo = window.scrollTo.bind(window);
  var suppressedScrollPositions = /* @__PURE__ */ new Map();
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

  // src/util.occlusion.ts
  var MIN_BOX_SIZE = 1;
  var SCROLL_OVERFLOW_VALUES = ["auto", "scroll"];
  var CONTAINER_POSITION_VALUES = ["relative", "absolute", "fixed", "sticky"];
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
    let isOccluded2 = false;
    try {
      const rect = element.getBoundingClientRect();
      const viewportBox = [0, 0, viewportWidth, viewportHeight];
      const clipBox = scrollPolicy.containers ? viewportBox : getScrollContainerClipBox(element, viewportBox);
      isOccluded2 = !clipBox || !isElementOnHit(element, rect, samples, clipBox);
    } finally {
      for (let index = scrollRestoreCbs.length - 1; index >= 0; index--) {
        scrollRestoreCbs[index]();
      }
    }
    return isOccluded2;
  }

  // src/check-interactivity.ts
  var VISIBILITY_STYLE_OFF_VALUES = ["hidden", "collapse"];
  var OVERFLOW_STYLE_CLIP_OFF_VALUES = ["hidden", "clip"];
  var OVERFLOW_STYLE_SCROLL_OFF_VALUES = ["auto", "scroll"];
  var CONTAINER_STYLE_POSITION_VALUES = ["relative", "absolute", "fixed", "sticky"];
  var OPTION_TAG_NAMES = ["OPTION", "OPTGROUP"];
  var MIN_OCCLUSION_SAMPLES = 16;
  var MAX_OCCLUSION_SAMPLES = 42;
  var DEFAULT_INTERACTIVITY_CHECKS = {
    disconnected: true,
    modalBlocked: true,
    hidden: true,
    inert: true,
    disabled: true,
    invisible: true,
    unclickable: true,
    unrendered: true,
    collapsed: true,
    clipped: true,
    occluded: true,
    // false
    offScrolled: false,
    // consider full document
    offViewport: false,
    // consider full document
    ariaHidden: false
    // might be exclusive to non-GUI navigation
  };
  var DEFAULT_INTERACTIVITY_OPTIONS = {
    skipParentChecks: false
  };
  function readProperty(element, property) {
    if (!(element instanceof HTMLFormElement) || !Object.prototype.hasOwnProperty.call(element, property)) return element[property];
    const getter = Object.getOwnPropertyDescriptor(HTMLElement.prototype, property)?.get ?? Object.getOwnPropertyDescriptor(Element.prototype, property)?.get ?? Object.getOwnPropertyDescriptor(Node.prototype, property)?.get;
    return getter?.call(element);
  }
  function getParentElement(element) {
    if (!element) return null;
    const slot = readProperty(element, "assignedSlot");
    if (slot) return slot;
    const parent = readProperty(element, "parentElement");
    if (parent) return parent;
    const root = element.getRootNode();
    if (root?.host instanceof Element) {
      return root.host;
    }
    return null;
  }
  function isUnrenderedByParent(element, parent) {
    if (!parent || readProperty(element, "parentElement") !== parent) return false;
    if (readProperty(parent, "shadowRoot") && !readProperty(element, "assignedSlot")) {
      return true;
    }
    return parent.tagName === "DETAILS" && !parent.open && element !== parent.querySelector(":scope > summary");
  }
  function closestComposed(element, predicate, skipParents = false) {
    let currentElement = element;
    while (currentElement) {
      if (predicate(currentElement)) return currentElement;
      currentElement = skipParents ? null : getParentElement(currentElement);
    }
    return null;
  }
  function getGeometryTarget(element) {
    if (!OPTION_TAG_NAMES.includes(element.tagName)) return element;
    const select = element.closest("select");
    if (!select) return element;
    if (select.multiple || select.size > 1) return element;
    return select;
  }
  var cachedHasModalDialog = null;
  function isOccluded(element, scrollPolicy) {
    const geometryTarget = getGeometryTarget(element);
    const rect = geometryTarget.getBoundingClientRect();
    const occlusionSamples = Math.max(
      MIN_OCCLUSION_SAMPLES,
      Math.min(MAX_OCCLUSION_SAMPLES, Math.round(rect.width * rect.height / 4e3))
    );
    return isElementOccluded(geometryTarget, occlusionSamples, scrollPolicy);
  }
  function containsModalDialog(root) {
    if (root.querySelector("dialog:modal")) return true;
    for (const element of root.querySelectorAll("*")) {
      if (element.shadowRoot && containsModalDialog(element.shadowRoot)) return true;
    }
    return false;
  }
  function hasModalDialog() {
    try {
      return containsModalDialog(document);
    } catch {
      return false;
    }
  }
  function withModalDialogPresence(hasModal, callback) {
    cachedHasModalDialog = hasModal;
    try {
      return callback();
    } finally {
      cachedHasModalDialog = null;
    }
  }
  function isBlockedByModal(element) {
    if (!(cachedHasModalDialog ?? hasModalDialog())) return false;
    const hasModalAncestor = closestComposed(element, (element2) => {
      return element2.tagName.toUpperCase() === "DIALOG" && element2.matches(":modal");
    });
    return !hasModalAncestor;
  }
  function checkInteractivity(element, checks = {}, options = {}) {
    if (element?.nodeType !== 1) {
      return {
        isInteractive: false,
        reason: "notElement"
      };
    }
    checks = {
      ...DEFAULT_INTERACTIVITY_CHECKS,
      ...checks ?? {}
    };
    options = {
      ...DEFAULT_INTERACTIVITY_OPTIONS,
      ...options ?? {}
    };
    if (checks.disconnected) {
      if (readProperty(element, "isConnected") !== true) {
        return {
          isInteractive: false,
          reason: "disconnected"
        };
      }
    }
    if (checks.modalBlocked) {
      if (isBlockedByModal(element)) {
        return {
          isInteractive: false,
          reason: "modalBlocked"
        };
      }
    }
    if (checks.inert || checks.hidden) {
      let currentElement = element;
      while (currentElement) {
        if (!(currentElement instanceof HTMLElement)) {
          currentElement = options.skipParentChecks ? null : getParentElement(currentElement);
          continue;
        }
        if (checks.hidden && readProperty(currentElement, "hidden") === true) {
          const style2 = getComputedStyle(currentElement);
          if (style2.display === "none") {
            return {
              isInteractive: false,
              reason: "hidden"
            };
          }
          ;
        }
        if (checks.inert && readProperty(currentElement, "inert") === true) {
          return {
            isInteractive: false,
            reason: "inert"
          };
        }
        currentElement = options.skipParentChecks ? null : getParentElement(currentElement);
      }
    }
    if (checks.disabled) {
      if (element.matches(":disabled")) {
        return {
          isInteractive: false,
          reason: "disabled"
        };
      }
      if (closestComposed(element, (el) => el.getAttribute("aria-disabled") === "true")) {
        return {
          isInteractive: false,
          reason: "disabled"
        };
      }
    }
    if (checks.ariaHidden) {
      if (closestComposed(element, (el) => el.getAttribute("aria-hidden") === "true", options.skipParentChecks)) {
        return {
          isInteractive: false,
          reason: "ariaHidden"
        };
      }
    }
    const style = getComputedStyle(element);
    if (checks.invisible || checks.unclickable || checks.unrendered) {
      if (checks.unclickable) {
        if (style.pointerEvents === "none") {
          return {
            isInteractive: false,
            reason: "unclickable"
          };
        }
      }
      if (checks.invisible) {
        if (VISIBILITY_STYLE_OFF_VALUES.includes(style.visibility)) {
          return {
            isInteractive: false,
            reason: "invisible"
          };
        }
      }
      if (checks.unrendered) {
        let currentElement = element;
        while (currentElement) {
          const style2 = getComputedStyle(currentElement);
          const parentElement = getParentElement(currentElement);
          if (style2.display === "none" || parseFloat(style2.opacity) === 0 || style2.contentVisibility === "hidden" || isUnrenderedByParent(currentElement, parentElement)) {
            return {
              isInteractive: false,
              reason: "unrendered"
            };
          }
          currentElement = options.skipParentChecks ? null : parentElement;
        }
      }
    }
    if (checks.collapsed || checks.clipped || checks.offScrolled || checks.offViewport || checks.occluded) {
      const geometryTarget = getGeometryTarget(element);
      const geometryStyle = geometryTarget === element ? style : getComputedStyle(geometryTarget);
      const rect = geometryTarget.getBoundingClientRect();
      if (checks.collapsed && (rect.width <= 0 || rect.height <= 0) && (geometryStyle.overflow !== "visible" || [...geometryTarget.childNodes].every((node) => node.nodeType === Node.TEXT_NODE && !node.textContent.trim().length))) {
        return {
          isInteractive: false,
          reason: "collapsed"
        };
      }
      if (checks.clipped || checks.offScrolled) {
        let currentElement = getParentElement(geometryTarget);
        let needsContainingBlock = geometryStyle.position === "absolute";
        let isScrolledOut = false;
        let effectiveTop = rect.top;
        let effectiveBottom = rect.bottom;
        let effectiveLeft = rect.left;
        let effectiveRight = rect.right;
        let escapesAncestorClip = geometryStyle.position === "fixed";
        if (!escapesAncestorClip) {
          try {
            escapesAncestorClip = geometryTarget.matches(":modal, :popover-open, :fullscreen");
          } catch {
          }
        }
        if (!escapesAncestorClip) {
          while (currentElement) {
            const style2 = getComputedStyle(currentElement);
            const position = style2.position;
            const isContainingBlock = CONTAINER_STYLE_POSITION_VALUES.includes(position);
            if (needsContainingBlock && !isContainingBlock) {
              currentElement = getParentElement(currentElement);
              continue;
            }
            needsContainingBlock = false;
            const clipsX = OVERFLOW_STYLE_CLIP_OFF_VALUES.includes(style2.overflowX);
            const clipsY = OVERFLOW_STYLE_CLIP_OFF_VALUES.includes(style2.overflowY);
            const scrollsX = OVERFLOW_STYLE_SCROLL_OFF_VALUES.includes(style2.overflowX);
            const scrollsY = OVERFLOW_STYLE_SCROLL_OFF_VALUES.includes(style2.overflowY);
            if (clipsX || clipsY || scrollsX || scrollsY) {
              const ancestorRect = currentElement.getBoundingClientRect();
              const boxTop = ancestorRect.top + currentElement.clientTop;
              const boxBottom = boxTop + currentElement.clientHeight;
              const boxLeft = ancestorRect.left + currentElement.clientLeft;
              const boxRight = boxLeft + currentElement.clientWidth;
              if (checks.clipped && (clipsX && (effectiveLeft >= boxRight || effectiveRight <= boxLeft) || clipsY && (effectiveTop >= boxBottom || effectiveBottom <= boxTop))) {
                return {
                  isInteractive: false,
                  reason: "clipped"
                };
              }
              if (scrollsX || scrollsY) {
                const localTop = effectiveTop - boxTop + currentElement.scrollTop;
                const localBottom = effectiveBottom - boxTop + currentElement.scrollTop;
                const localLeft = effectiveLeft - boxLeft + currentElement.scrollLeft;
                const localRight = effectiveRight - boxLeft + currentElement.scrollLeft;
                if (checks.clipped) {
                  if (scrollsY && (localBottom <= 0 || localTop >= currentElement.scrollHeight) || scrollsX && (localRight <= 0 || localLeft >= currentElement.scrollWidth)) {
                    return {
                      isInteractive: false,
                      reason: "clipped"
                    };
                  }
                }
                if (scrollsX && (effectiveLeft >= boxRight || effectiveRight <= boxLeft) || scrollsY && (effectiveTop >= boxBottom || effectiveBottom <= boxTop)) {
                  isScrolledOut = true;
                  effectiveTop = boxTop;
                  effectiveBottom = boxBottom;
                  effectiveLeft = boxLeft;
                  effectiveRight = boxRight;
                }
              }
            }
            let isViewportClipped = position === "fixed";
            if (!isViewportClipped) {
              try {
                isViewportClipped = currentElement.matches(":modal, :popover-open, :fullscreen");
              } catch {
              }
            }
            if (isViewportClipped) break;
            if (position === "absolute") {
              needsContainingBlock = true;
            }
            currentElement = getParentElement(currentElement);
          }
        }
        if (checks.clipped) {
          if (geometryStyle.position === "fixed") {
            const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
            if (effectiveTop >= viewportHeight || effectiveBottom <= 0 || effectiveLeft >= viewportWidth || effectiveRight <= 0) {
              return {
                isInteractive: false,
                reason: "clipped"
              };
            }
          } else {
            const scrollWidth = Math.max(document.documentElement.scrollWidth, document.documentElement.clientWidth);
            const scrollHeight = Math.max(document.documentElement.scrollHeight, document.documentElement.clientHeight);
            const top = effectiveTop + window.scrollY;
            const bottom = effectiveBottom + window.scrollY;
            const left = effectiveLeft + window.scrollX;
            const right = effectiveRight + window.scrollX;
            if (top >= scrollHeight || bottom <= 0 || left >= scrollWidth || right <= 0) {
              return {
                isInteractive: false,
                reason: "clipped"
              };
            }
          }
        }
        if (checks.offScrolled && isScrolledOut) {
          return {
            isInteractive: false,
            reason: "offScrolled"
          };
        }
      }
      if (checks.offViewport) {
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        if (rect.top >= viewportHeight || rect.bottom <= 0 || rect.left >= viewportWidth || rect.right <= 0) {
          return {
            isInteractive: false,
            reason: "offViewport"
          };
        }
      }
      if (checks.occluded) {
        const scrollPolicy = {
          containers: !checks.offScrolled,
          viewport: !checks.offViewport
        };
        if (isOccluded(element, scrollPolicy)) {
          return {
            isInteractive: false,
            reason: "occluded"
          };
        }
      }
    }
    return {
      isInteractive: true
    };
  }

  // src/filter-interactive.ts
  var CASCADING_NON_INTERACTIVITY_CHECKS = /* @__PURE__ */ new Set([
    "disconnected",
    "hidden",
    "inert",
    "ariaHidden",
    "unrendered"
  ]);
  var POST_CASCADING_INTERACTIVITY_CHECKS = /* @__PURE__ */ new Set([
    "collapsed",
    "clipped",
    "offScrolled",
    "offViewport",
    "occluded"
  ]);
  var DEFAULT_FILTER_OVERRIDE_INTERACTIVITY_CHECKS = new Map(
    Object.entries({
      // Do not filter 'styled' inputs (commonly deliberately hidden or occluded by click-through custom UI)
      "input": {
        clipped: false,
        collapsed: false,
        invisible: false,
        occluded: false,
        unrendered: false
      },
      "select": {
        clipped: false,
        collapsed: false,
        invisible: false,
        occluded: false,
        unrendered: false
      }
    })
  );
  function pickCascading(overrides) {
    return Object.fromEntries(
      Object.entries(overrides).filter((entry) => CASCADING_NON_INTERACTIVITY_CHECKS.has(entry[0]))
    );
  }
  function pickEnabledCascading(checks) {
    const effectiveChecks = {
      ...DEFAULT_INTERACTIVITY_CHECKS,
      ...checks
    };
    return [...CASCADING_NON_INTERACTIVITY_CHECKS].filter((check) => effectiveChecks[check]);
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
  function cloneWithShadow(node, targetDocument) {
    const clone = targetDocument.importNode(node, false);
    const shadow = node.shadowRoot;
    if (shadow) {
      const clonedShadow = clone.attachShadow({
        mode: shadow.mode,
        serializable: true
      });
      for (let child = shadow.firstElementChild; child; child = child.nextElementSibling) {
        clonedShadow.appendChild(cloneWithShadow(child, targetDocument));
      }
    }
    for (const child of node.childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        clone.appendChild(cloneWithShadow(child, targetDocument));
      } else {
        clone.appendChild(targetDocument.importNode(child, true));
      }
    }
    return clone;
  }
  function removeVirtual(virtual) {
    const parent = virtual.parentElement ?? virtual.parentNode;
    parent?.removeChild(virtual);
  }
  function filterDOM(liveElement, virtualElement, isRoot, checks, inheritedChecks, elementOverrideChecks, rescueSelectors, parentVerifiedChecks, onNonInteractive) {
    const overrides = elementOverrideChecks.get(liveElement.tagName.toLowerCase()) ?? {};
    const applicableChecks = {
      ...checks,
      ...inheritedChecks,
      ...overrides
    };
    const descendantChecks = Object.keys(overrides).length ? { ...inheritedChecks, ...pickCascading(overrides) } : inheritedChecks;
    const enabledCascadingChecks = pickEnabledCascading(applicableChecks);
    const skipParentChecks = !liveElement.assignedSlot && enabledCascadingChecks.every((check) => parentVerifiedChecks.has(check));
    const result = checkInteractivity(liveElement, applicableChecks, { skipParentChecks });
    const verifiedChecks = result.isInteractive || !!result.reason && POST_CASCADING_INTERACTIVITY_CHECKS.has(result.reason) ? new Set(enabledCascadingChecks) : /* @__PURE__ */ new Set();
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
      if (filterDOM(liveElement2, virtualElement2, false, checks, descendantChecks, elementOverrideChecks, rescueSelectors, verifiedChecks, onNonInteractive)) {
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
    const hasModal = hasModalDialog();
    if (!hasModal) {
      checks = {
        ...checks,
        modalBlocked: false
      };
      elementOverrideChecks = new Map(
        [...elementOverrideChecks].map((entry) => [entry[0], { ...entry[1], modalBlocked: false }])
      );
    }
    const rescueSelectors = collectRescueSelectors(elementOverrideChecks);
    const liveRoot = dom instanceof Document ? dom.documentElement : dom;
    const virtualRoot = virtualDOM ? virtualDOM instanceof Document ? virtualDOM.documentElement : virtualDOM : cloneWithShadow(liveRoot, document.implementation.createHTMLDocument(""));
    withModalDialogPresence(hasModal, () => {
      filterDOM(liveRoot, virtualRoot, true, checks, {}, elementOverrideChecks, rescueSelectors, /* @__PURE__ */ new Set(), onNonInteractive);
    });
    return virtualRoot;
  }

  // src/api.browser.ts
  window.IsInteractive = {
    checkInteractivity,
    filterInteractive
  };
})();
