import { isElementOccluded } from "./util.occlusion.js";
const DISABLEABLE_TAG_NAMES = [
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
      if (checks.invisible && (style.display === "none" || invisibilityValues.includes(style.visibility))) {
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
export {
  checkInteractivity
};
