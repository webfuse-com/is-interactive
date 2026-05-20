function computeScrollDelta(near: number, far: number, viewport: number): number {
    if(near >= 0 && far <= viewport) return 0;

    if(near < 0) return near;

    if(far > viewport) return far - viewport;

    return 0;
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

    let currentElement: Element | null = element.parentElement;

    while (currentElement) {
        const el = currentElement;
        currentElement = currentElement.parentElement; // advance FIRST

        if (!(el instanceof HTMLElement)) continue;

        const isScrollable =
            el.scrollHeight > el.clientHeight ||
            el.scrollWidth  > el.clientWidth;
        if (!isScrollable) continue;

        const previousLeft = el.scrollLeft;
        const previousTop  = el.scrollTop;
        const ancestorRect = el.getBoundingClientRect();
        const elementRect  = element.getBoundingClientRect();

        const deltaX = computeScrollDelta(
            elementRect.left  - ancestorRect.left,
            elementRect.right - ancestorRect.left,
            el.clientWidth
        );
        const deltaY = computeScrollDelta(
            elementRect.top    - ancestorRect.top,
            elementRect.bottom - ancestorRect.top,
            el.clientHeight
        );

        if (deltaX !== 0 || deltaY !== 0) {
            el.scrollLeft = previousLeft + deltaX;
            el.scrollTop  = previousTop  + deltaY;
            restoreCbs.push(() => {
                el.scrollLeft = previousLeft;
                el.scrollTop  = previousTop;
            });
        }
    }

    // window-level:
    const viewportWidth: number = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight: number = window.innerHeight || document.documentElement.clientHeight;

    const elementRect: DOMRect = element.getBoundingClientRect();

    const deltaX: number = computeScrollDelta(elementRect.left, elementRect.right, viewportWidth);
    const deltaY: number = computeScrollDelta(elementRect.top, elementRect.bottom, viewportHeight);

    if(deltaX !== 0 || deltaY !== 0) {
        const previousX: number = window.scrollX;
        const previousY: number = window.scrollY;

        window.scrollTo(previousX + deltaX, previousY + deltaY);

        restoreCbs.
            push((): void => {
                window.scrollTo(previousX, previousY);
            });
    }

    return restoreCbs;
}