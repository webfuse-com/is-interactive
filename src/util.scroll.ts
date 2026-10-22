const nativeScrollTop = (
    Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop")
    ?? Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTop")
)?.set;
const nativeScrollLeft = (
    Object.getOwnPropertyDescriptor(Element.prototype, "scrollLeft")
    ?? Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollLeft")
)?.set;
const nativeWindowScrollTo = window.scrollTo.bind(window);

// Scroll targets (document for the window) with the position to which they are restored
const suppressedScrollPositions: Map<EventTarget, [ number, number ]> = new Map();


export interface ScrollIntoViewPolicy {
    containers: boolean;
    viewport: boolean;
}


function readScrollPosition(target: EventTarget): [ number, number ] {
    return (target === document)
        ? [ window.scrollX, window.scrollY ]
        : [ (target as Element).scrollLeft, (target as Element).scrollTop ];
}

/**
 * Stop scroll events caused by temporary scrolling, which the browser dispatches on the next frame.
 * Events of targets no longer at their restored position stem from genuine scrolling and pass.
 */
function suppressScrollEvent(event: Event): void {
    if(!event.isTrusted || !event.target) return;

    const position: [ number, number ] | undefined = suppressedScrollPositions.get(event.target);

    if(!position) return;

    const currentPosition: [ number, number ] = readScrollPosition(event.target);

    if((currentPosition[0] !== position[0]) || (currentPosition[1] !== position[1])) return;

    event.stopImmediatePropagation();
}

function suppressScrollEvents(target: EventTarget): void {
    if(suppressedScrollPositions.has(target)) return;

    if(!suppressedScrollPositions.size) {
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


export function computeScrollDelta(near: number, far: number, viewport: number): number {
    if(near >= 0 && far <= viewport) return 0;

    if(near < 0) return near;

    if(far > viewport) return far - viewport;

    return 0;
}

export function resolveParent(node: Element): Element | null {
    if(node.assignedSlot) return node.assignedSlot;

    if(node.parentElement) return node.parentElement;

    const root = node.getRootNode();

    return (root instanceof ShadowRoot)
        ? root.host
        : null;
}


/**
 * Scroll the window without smooth scrolling. Resulting scroll events are suppressed if the window is scrolled back
 * before the next frame.
 */
export function scrollWindowTo(left: number, top: number): void {
    suppressScrollEvents(document);

    nativeWindowScrollTo({
        top,
        left,
        behavior: "instant"
    });
}

export function scrollIntoViewSynchronously(
    element: Element,
    policy: ScrollIntoViewPolicy = { containers: true, viewport: true }
): (() => void)[] {
    const restoreCbs: (() => void)[] = [];

    if(!nativeScrollLeft || !nativeScrollTop) return restoreCbs;

    const visited: Set<Element> = new Set();
    let nextElement: Element | null = resolveParent(element);

    while(nextElement && policy.containers) {
        if(visited.has(nextElement)) break;

        visited.add(nextElement);

        const currentElement: Element = nextElement;

        nextElement = resolveParent(currentElement);

        if(!(currentElement instanceof HTMLElement)) continue;

        const currentStyle: CSSStyleDeclaration = getComputedStyle(currentElement);

        const scrollableX: boolean = (
            (currentElement.scrollWidth > currentElement.clientWidth)
            && (currentStyle.overflowX === "auto" || currentStyle.overflowX === "scroll")
        );
        const scrollableY: boolean = (
            (currentElement.scrollHeight > currentElement.clientHeight)
            && (currentStyle.overflowY === "auto" || currentStyle.overflowY === "scroll")
        );

        if(!scrollableX && !scrollableY) continue;

        const previousLeft: number = currentElement.scrollLeft;
        const previousTop: number = currentElement.scrollTop;
        const ancestorRect: DOMRect = currentElement.getBoundingClientRect();
        const elementRect: DOMRect = element.getBoundingClientRect();

        const deltaX: number = scrollableX
            ? computeScrollDelta(
                elementRect.left - ancestorRect.left,
                elementRect.right - ancestorRect.left,
                currentElement.clientWidth
            )
            : 0;

        const deltaY: number = scrollableY
            ? computeScrollDelta(
                elementRect.top - ancestorRect.top,
                elementRect.bottom - ancestorRect.top,
                currentElement.clientHeight
            )
            : 0;

        if((deltaX !== 0) || (deltaY !== 0)) {
            suppressScrollEvents(currentElement);

            nativeScrollLeft.call(currentElement, previousLeft + deltaX);
            nativeScrollTop.call(currentElement, previousTop + deltaY);

            restoreCbs
                .push(() => {
                    nativeScrollLeft.call(currentElement, previousLeft);
                    nativeScrollTop.call(currentElement, previousTop);
                });
        }
    }

    if(!policy.viewport) return restoreCbs;

    const viewportWidth: number = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight: number = window.innerHeight || document.documentElement.clientHeight;
    const elementRect: DOMRect = element.getBoundingClientRect();

    const deltaX: number = computeScrollDelta(elementRect.left, elementRect.right, viewportWidth);
    const deltaY: number = computeScrollDelta(elementRect.top, elementRect.bottom, viewportHeight);

    if((deltaX !== 0) || (deltaY !== 0)) {
        const previousX: number = window.scrollX;
        const previousY: number = window.scrollY;

        scrollWindowTo(previousX + deltaX, previousY + deltaY);

        restoreCbs.
            push((): void => {
                scrollWindowTo(previousX, previousY);
            });
    }

    return restoreCbs;
}