const nativeScrollTop = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop")!.set!;
const nativeScrollLeft = Object.getOwnPropertyDescriptor(Element.prototype, "scrollLeft")!.set!;
const nativeWindowScrollTo = window.scrollTo.bind(window);


function computeScrollDelta(near: number, far: number, viewport: number): number {
    if(near >= 0 && far <= viewport) return 0;

    if(near < 0) return near;

    if(far > viewport) return far - viewport;

    return 0;
}

function resolveParent(node: Element): Element | null {
    if(node.parentElement) return node.parentElement;

    const root = node.getRootNode();

    return (root instanceof ShadowRoot)
        ? root.host
        : null;
}

/**
 * Scrolls an element into view by adjusting every scrollable ancestor the minimum amount.
 * Returns an array of restore functions.
 * Using scroll and restore synchronously in the same tick (with instant scrolling), there
 * is no page re-paint happening between scroll and restore; invisible scroll, but element
 * is in viewport for processing.
 */
export function scrollIntoViewSynchronously(element: Element): (() => void)[] {
    const restoreCbs: (() => void)[] = [];

    let nextElement: Element | null = resolveParent(element);

    while (nextElement) {
        const currentElement: Element = nextElement;

        nextElement = resolveParent(currentElement);

        if(!(currentElement instanceof HTMLElement)) continue;

        const isScrollable = (
               (currentElement.scrollHeight > currentElement.clientHeight)
            || (currentElement.scrollWidth  > currentElement.clientWidth)
        );
        if(!isScrollable) continue;

        const previousLeft: number = currentElement.scrollLeft;
        const previousTop: number = currentElement.scrollTop;

        const ancestorRect: DOMRect = currentElement.getBoundingClientRect();
        const elementRect: DOMRect = element.getBoundingClientRect();

        const deltaX = computeScrollDelta(
            elementRect.left - ancestorRect.left,
            elementRect.right - ancestorRect.left,
            currentElement.clientWidth
        );
        const deltaY = computeScrollDelta(
            elementRect.top - ancestorRect.top,
            elementRect.bottom - ancestorRect.top,
            currentElement.clientHeight
        );

        if((deltaX !== 0) || (deltaY !== 0)) {
            nativeScrollLeft.call(currentElement, previousLeft + deltaX);
            nativeScrollTop.call(currentElement, previousTop + deltaY);

            restoreCbs
                .push(() => {
                    nativeScrollLeft.call(currentElement, previousLeft);
                    nativeScrollTop.call(currentElement, previousTop);
                });
        }
    }

    // window-level
    const viewportWidth: number = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight: number = window.innerHeight || document.documentElement.clientHeight;

    const elementRect: DOMRect = element.getBoundingClientRect();

    const deltaX: number = computeScrollDelta(elementRect.left, elementRect.right, viewportWidth);
    const deltaY: number = computeScrollDelta(elementRect.top, elementRect.bottom, viewportHeight);

    if((deltaX !== 0) || (deltaY !== 0)) {
        const previousX: number = window.scrollX;
        const previousY: number = window.scrollY;

        nativeWindowScrollTo({
            top: previousY + deltaY,
            left: previousX + deltaX,
            behavior: "instant"
        });

        restoreCbs.
            push((): void => {
                nativeWindowScrollTo({
                    top: previousY,
                    left: previousX,
                    behavior: "instant"
                });
            });
    }

    return restoreCbs;
}