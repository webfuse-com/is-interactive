"use strict";
(() => {
  // src/util.scroll.ts
  function computeScrollDelta(near, far, viewport) {
    if (near >= 0 && far <= viewport) return 0;
    if (near < 0) return near;
    if (far > viewport) return far - viewport;
    return 0;
  }
  function scrollIntoViewSynchronously(element) {
    const restoreCbs = [];
    let currentElement = element.parentElement;
    while (currentElement) {
      if (!(currentElement instanceof HTMLElement) || (currentElement.scrollHeight > currentElement.clientHeight || currentElement.scrollWidth > currentElement.clientWidth)) continue;
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
      const ancestorElement = currentElement;
      if (deltaX2 !== 0 || deltaY2 !== 0) {
        currentElement.scrollLeft = previousLeft + deltaX2;
        currentElement.scrollTop = previousTop + deltaY2;
        restoreCbs.push(() => {
          ancestorElement.scrollLeft = previousLeft;
          ancestorElement.scrollTop = previousTop;
        });
      }
      currentElement = currentElement.parentElement;
    }
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const elementRect = element.getBoundingClientRect();
    const deltaX = computeScrollDelta(elementRect.left, elementRect.right, viewportWidth);
    const deltaY = computeScrollDelta(elementRect.top, elementRect.bottom, viewportHeight);
    if (deltaX !== 0 || deltaY !== 0) {
      const previousX = window.scrollX;
      const previousY = window.scrollY;
      window.scrollTo(previousX + deltaX, previousY + deltaY);
      restoreCbs.push(() => {
        window.scrollTo(previousX, previousY);
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

  // src/is-interactive.ts
  var DISABLEABLE_TAG_NAMES = [
    "BUTTON",
    "INPUT",
    "SELECT",
    "TEXTAREA",
    "OPTGROUP",
    "OPTION",
    "FIELDSET"
  ];
  function checkInteractivity(element, options = {}) {
    if (!element || element.nodeType !== 1) {
      return {
        isInteractive: false,
        reason: "notElement"
      };
    }
    const optionsWithDefaults = {
      checks: {
        disconnected: true,
        hidden: true,
        inert: true,
        disabled: true,
        ariaHidden: true,
        invisible: true,
        unclickable: true,
        collapsed: true,
        offViewport: true,
        occluded: true,
        ...options.checks ?? {}
      },
      occlusionSamples: 5
    };
    const checks = optionsWithDefaults.checks;
    if (checks.disconnected) {
      if (!element.isConnected) {
        return {
          isInteractive: false,
          reason: "disconnected"
        };
      }
    }
    if (checks.inert || checks.hidden) {
      let currentElement = element;
      while (currentElement) {
        if (!(currentElement instanceof HTMLElement)) continue;
        if (checks.hidden && currentElement.hidden) {
          return {
            isInteractive: false,
            reason: "hidden"
          };
        }
        if (checks.inert && currentElement?.inert) {
          return {
            isInteractive: false,
            reason: "inert"
          };
        }
        currentElement = currentElement.parentElement;
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
      const invisibilityValues = ["hidden", "collapse"];
      let currentElement = element;
      while (currentElement) {
        const style = getComputedStyle(currentElement);
        if (checks.invisible && (style.display === "none" || parseFloat(style.opacity) === 0 || invisibilityValues.includes(style.visibility))) {
          return {
            isInteractive: false,
            reason: "invisible"
          };
        }
        currentElement = currentElement.parentElement;
      }
    }
    if (checks.collapsed || checks.offViewport || checks.occluded) {
      const rect = element.getBoundingClientRect();
      if (checks.collapsed && (rect.width <= 0 || rect.height <= 0)) {
        return {
          isInteractive: false,
          reason: "collapsed"
        };
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
      if (checks.occluded && isElementOccluded(element, optionsWithDefaults.occlusionSamples)) {
        return {
          isInteractive: false,
          reason: "occluded"
        };
      }
    }
    return {
      isInteractive: true
    };
  }

  // src/api.browser.ts
  window.checkInteractivity = checkInteractivity;
})();
