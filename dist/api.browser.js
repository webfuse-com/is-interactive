"use strict";
(() => {
  // src/util.scroll.ts
  var nativeScrollTop = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop").set;
  var nativeScrollLeft = Object.getOwnPropertyDescriptor(Element.prototype, "scrollLeft").set;
  var nativeWindowScrollTo = window.scrollTo.bind(window);
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

  // src/util.occlusion.ts
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
  function isElementOnHit(element, rect, samples, viewportWidth, viewportHeight) {
    const root = element.getRootNode();
    const points = generateSamplePoints(rect, samples);
    for (const point of points) {
      const x = point[0];
      const y = point[1];
      if (x < 0 || y < 0 || x >= viewportWidth || y >= viewportHeight) continue;
      const stack = root.elementsFromPoint(x, y) ?? [];
      if (stack.length === 0) continue;
      const hitElement = stack[0];
      if (hitElement === element || element.contains(hitElement) || hitElement.contains(element)) return true;
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

  // src/check-interactivity.ts
  var DISABLEABLE_TAG_NAMES = [
    "BUTTON",
    "INPUT",
    "SELECT",
    "TEXTAREA",
    "OPTGROUP",
    "OPTION",
    "FIELDSET"
  ];
  var VISIBILITY_STYLE_OFF_VALUES = ["hidden", "collapse"];
  var OVERFLOW_STYLE_CLIP_OFF_VALUES = ["hidden", "clip"];
  var OVERFLOW_STYLE_SCROLL_OFF_VALUES = ["auto", "scroll"];
  var MAX_OCCLUSION_SAMPLES = 32;
  function readProperty(element, property) {
    if (!(element instanceof HTMLFormElement) || !Object.prototype.hasOwnProperty.call(element, property)) return element[property];
    const getter = Object.getOwnPropertyDescriptor(HTMLElement.prototype, property)?.get ?? Object.getOwnPropertyDescriptor(Element.prototype, property)?.get ?? Object.getOwnPropertyDescriptor(Node.prototype, property)?.get;
    return getter?.call(element);
  }
  function getParentElement(element) {
    if (!element) return null;
    const parent = readProperty(element, "parentElement");
    if (parent) return parent;
    const root = element.getRootNode();
    if (root?.host instanceof Element) {
      return root.host;
    }
    return null;
  }
  function checkInteractivity(element, checks = {}) {
    if (element?.nodeType !== 1) {
      return {
        isInteractive: false,
        reason: "notElement"
      };
    }
    checks = {
      disconnected: true,
      hidden: true,
      inert: true,
      disabled: true,
      ariaHidden: true,
      invisible: true,
      unclickable: true,
      collapsed: true,
      clipped: true,
      occluded: true,
      offViewport: false,
      ...checks ?? {}
    };
    if (checks.disconnected) {
      if (readProperty(element, "isConnected") !== true) {
        return {
          isInteractive: false,
          reason: "disconnected"
        };
      }
    }
    if (checks.inert || checks.hidden) {
      let currentElement = element;
      while (currentElement) {
        if (!(currentElement instanceof HTMLElement)) {
          currentElement = getParentElement(currentElement);
          continue;
        }
        if (checks.hidden && readProperty(currentElement, "hidden") === true) {
          const style = getComputedStyle(currentElement);
          if (style.display === "none") {
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
        currentElement = getParentElement(currentElement);
      }
    }
    if (checks.disabled) {
      if (DISABLEABLE_TAG_NAMES.includes(element.tagName) && element.disabled) {
        return {
          isInteractive: false,
          reason: "disabled"
        };
      }
      if (element.closest('[aria-disabled="true"]')) {
        return {
          isInteractive: false,
          reason: "disabled"
        };
      }
      const fieldsetElement = element.closest("fieldset[disabled]");
      if (fieldsetElement && !element.closest("legend")?.parentElement?.isSameNode(fieldsetElement)) {
        return {
          isInteractive: false,
          reason: "disabled"
        };
      }
    }
    if (checks.ariaHidden) {
      if (element.closest('[aria-hidden="true"]')) {
        return {
          isInteractive: false,
          reason: "ariaHidden"
        };
      }
    }
    if (checks.invisible || checks.unclickable) {
      if (checks.unclickable) {
        const style = getComputedStyle(element);
        if (style.pointerEvents === "none") {
          return {
            isInteractive: false,
            reason: "unclickable"
          };
        }
      }
      let currentElement = element;
      while (currentElement) {
        const style = getComputedStyle(currentElement);
        if (checks.invisible && (style.display === "none" || parseFloat(style.opacity) === 0 || VISIBILITY_STYLE_OFF_VALUES.includes(style.visibility) || style.contentVisibility === "hidden")) {
          return {
            isInteractive: false,
            reason: "invisible"
          };
        }
        currentElement = getParentElement(currentElement);
      }
    }
    if (checks.collapsed || checks.clipped || checks.offViewport || checks.occluded) {
      const rect = element.getBoundingClientRect();
      if (checks.collapsed && (rect.width <= 0 || rect.height <= 0)) {
        return {
          isInteractive: false,
          reason: "collapsed"
        };
      }
      if (checks.clipped) {
        let currentElement = getParentElement(element);
        while (currentElement) {
          const style = getComputedStyle(currentElement);
          const clipsX = OVERFLOW_STYLE_CLIP_OFF_VALUES.includes(style.overflowX);
          const clipsY = OVERFLOW_STYLE_CLIP_OFF_VALUES.includes(style.overflowY);
          const scrollsX = OVERFLOW_STYLE_SCROLL_OFF_VALUES.includes(style.overflowX);
          const scrollsY = OVERFLOW_STYLE_SCROLL_OFF_VALUES.includes(style.overflowY);
          if (clipsX || clipsY) {
            const ancestorRect = currentElement.getBoundingClientRect();
            if (clipsY && (rect.bottom <= ancestorRect.top || rect.top >= ancestorRect.bottom) || clipsX && (rect.right <= ancestorRect.left || rect.left >= ancestorRect.right)) {
              return {
                isInteractive: false,
                reason: "clipped"
              };
            }
          }
          if (scrollsX || scrollsY) {
            const ancestorRect = currentElement.getBoundingClientRect();
            const localTop = rect.top - ancestorRect.top + currentElement.scrollTop;
            const localBottom = rect.bottom - ancestorRect.top + currentElement.scrollTop;
            const localLeft = rect.left - ancestorRect.left + currentElement.scrollLeft;
            const localRight = rect.right - ancestorRect.left + currentElement.scrollLeft;
            if (scrollsY && (localBottom <= 0 || localTop >= currentElement.scrollHeight) || scrollsX && (localRight <= 0 || localLeft >= currentElement.scrollWidth)) {
              return {
                isInteractive: false,
                reason: "clipped"
              };
            }
          }
          currentElement = getParentElement(currentElement);
        }
      }
      if (checks.offViewport) {
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        if (rect.bottom <= 0 || rect.right <= 0 || rect.left >= viewportWidth || rect.top >= viewportHeight) {
          return {
            isInteractive: false,
            reason: "offViewport"
          };
        }
      }
      if (checks.occluded) {
        const area = rect.width * rect.height;
        const occlusionSamples = Math.max(1, Math.min(MAX_OCCLUSION_SAMPLES, Math.round(area / 4e3)));
        if (isElementOccluded(element, occlusionSamples)) {
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

  // src/api.browser.ts
  window.IsInteractive = {
    checkInteractivity,
    filterInteractive
  };
})();
