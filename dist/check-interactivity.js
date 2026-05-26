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
const VISIBILITY_STYLE_OFF_VALUES = ["hidden", "collapse"];
const OVERFLOW_STYLE_CLIP_OFF_VALUES = ["hidden", "clip"];
const OVERFLOW_STYLE_SCROLL_OFF_VALUES = ["auto", "scroll"];
const MAX_OCCLUSION_SAMPLES = 32;
function readProperty(element, property) {
  if (!(element instanceof HTMLFormElement) || !Object.prototype.hasOwnProperty.call(element, property)) return element[property];
  const getter = Object.getOwnPropertyDescriptor(HTMLElement.prototype, property)?.get ?? Object.getOwnPropertyDescriptor(Element.prototype, property)?.get ?? Object.getOwnPropertyDescriptor(Node.prototype, property)?.get;
  return getter?.call(element);
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
        currentElement = readProperty(currentElement, "parentElement") ?? null;
        continue;
      }
      if (checks.hidden && readProperty(currentElement, "hidden") === true) {
        return {
          isInteractive: false,
          reason: "hidden"
        };
      }
      if (checks.inert && readProperty(currentElement, "inert") === true) {
        return {
          isInteractive: false,
          reason: "inert"
        };
      }
      currentElement = readProperty(currentElement, "parentElement") ?? null;
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
      if (checks.invisible && (style.display === "none" || parseFloat(style.opacity) === 0 || VISIBILITY_STYLE_OFF_VALUES.includes(style.visibility))) {
        return {
          isInteractive: false,
          reason: "invisible"
        };
      }
      currentElement = readProperty(currentElement, "parentElement") ?? null;
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
      let currentElement = readProperty(element, "parentElement") ?? null;
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
        currentElement = readProperty(currentElement, "parentElement") ?? null;
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
export {
  checkInteractivity
};
