import { isElementOccluded } from "./util.occlusion.js";
const VISIBILITY_STYLE_OFF_VALUES = ["hidden", "collapse"];
const OVERFLOW_STYLE_CLIP_OFF_VALUES = ["hidden", "clip"];
const OVERFLOW_STYLE_SCROLL_OFF_VALUES = ["auto", "scroll"];
const CONTAINER_STYLE_POSITION_VALUES = ["relative", "absolute", "fixed", "sticky"];
const OPTION_TAG_NAMES = ["OPTION", "OPTGROUP"];
const MIN_OCCLUSION_SAMPLES = 1;
const MAX_OCCLUSION_SAMPLES = 32;
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
function closestComposed(element, predicate) {
  let currentElement = element;
  while (currentElement) {
    if (predicate(currentElement)) return currentElement;
    currentElement = getParentElement(currentElement);
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
function isBlockedByModal(element) {
  let hasModal;
  try {
    hasModal = !!document.querySelector("dialog:modal");
  } catch {
    return false;
  }
  if (!hasModal) return false;
  const hasModalAncestor = closestComposed(element, (element2) => {
    return element2.tagName.toUpperCase() === "DIALOG" && element2.matches(":modal");
  });
  return !hasModalAncestor;
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
    modalBlocked: true,
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
        currentElement = getParentElement(currentElement);
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
      currentElement = getParentElement(currentElement);
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
    if (closestComposed(element, (el) => el.getAttribute("aria-hidden") === "true")) {
      return {
        isInteractive: false,
        reason: "ariaHidden"
      };
    }
  }
  const style = getComputedStyle(element);
  if (checks.invisible || checks.unclickable) {
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
      let currentElement = element;
      while (currentElement) {
        const style2 = getComputedStyle(currentElement);
        if (style2.display === "none" || parseFloat(style2.opacity) === 0 || style2.contentVisibility === "hidden") {
          return {
            isInteractive: false,
            reason: "invisible"
          };
        }
        currentElement = getParentElement(currentElement);
      }
    }
  }
  if (checks.collapsed || checks.clipped || checks.offViewport || checks.occluded) {
    const geometryTarget = getGeometryTarget(element);
    const geometryStyle = geometryTarget === element ? style : getComputedStyle(geometryTarget);
    const rect = geometryTarget.getBoundingClientRect();
    if (checks.collapsed && (rect.width <= 0 || rect.height <= 0) && (geometryStyle.overflow !== "visible" || [...geometryTarget.childNodes].every((node) => node.nodeType === Node.TEXT_NODE && !node.textContent.trim().length))) {
      return {
        isInteractive: false,
        reason: "collapsed"
      };
    }
    if (checks.clipped) {
      const position = style.position;
      let currentElement = getParentElement(geometryTarget);
      let foundContainerBlock = position !== "absolute";
      if (position !== "fixed") {
        while (currentElement) {
          const style2 = getComputedStyle(currentElement);
          if (!foundContainerBlock) {
            if (CONTAINER_STYLE_POSITION_VALUES.includes(style2.position)) {
              foundContainerBlock = true;
            } else {
              currentElement = getParentElement(currentElement);
              continue;
            }
          }
          const clipsX = OVERFLOW_STYLE_CLIP_OFF_VALUES.includes(style2.overflowX);
          const clipsY = OVERFLOW_STYLE_CLIP_OFF_VALUES.includes(style2.overflowY);
          const scrollsX = OVERFLOW_STYLE_SCROLL_OFF_VALUES.includes(style2.overflowX);
          const scrollsY = OVERFLOW_STYLE_SCROLL_OFF_VALUES.includes(style2.overflowY);
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
      const occlusionSamples = Math.max(MIN_OCCLUSION_SAMPLES, Math.min(MAX_OCCLUSION_SAMPLES, Math.round(area / 4e3)));
      if (isElementOccluded(geometryTarget, occlusionSamples)) {
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
