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

    while(currentElement) {
        if(
            !(currentElement instanceof HTMLElement)
            || (
                (currentElement.scrollHeight > currentElement.clientHeight)
                || (currentElement.scrollWidth > currentElement.clientWidth)
            )
        ) continue;

        const previousLeft: number = currentElement.scrollLeft;
        const previousTop: number = currentElement.scrollTop;
        const ancestorRect: DOMRect = currentElement.getBoundingClientRect();
        const elementRect: DOMRect = element.getBoundingClientRect();

        const deltaX: number = computeScrollDelta(
            elementRect.left - ancestorRect.left,
            elementRect.right - ancestorRect.left,
            currentElement.clientWidth
        );
        const deltaY: number = computeScrollDelta(
            elementRect.top - ancestorRect.top,
            elementRect.bottom - ancestorRect.top,
            currentElement.clientHeight
        );

        const ancestorElement: HTMLElement = currentElement;

        if(deltaX !== 0 || deltaY !== 0) {
            currentElement.scrollLeft = previousLeft + deltaX;
            currentElement.scrollTop = previousTop + deltaY;

            restoreCbs
                .push((): void => {
                    ancestorElement.scrollLeft = previousLeft;
                    ancestorElement.scrollTop = previousTop;
                });
        }

        currentElement = currentElement.parentElement;
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