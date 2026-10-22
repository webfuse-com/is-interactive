import { resolveParent, scrollIntoViewSynchronously, type ScrollIntoViewPolicy } from "./util.scroll.js";


// left, top, right, bottom
type Box = [ number, number, number, number ];

const MIN_BOX_SIZE: number = 1;
const SCROLL_OVERFLOW_VALUES: string[] = [ "auto", "scroll" ];
const CONTAINER_POSITION_VALUES: string[] = [ "relative", "absolute", "fixed", "sticky" ];


function createBox(left: number, top: number, right: number, bottom: number): Box | null {
    return ((right - left) >= MIN_BOX_SIZE && (bottom - top) >= MIN_BOX_SIZE)
        ? [ left, top, right, bottom ]
        : null;
}

function intersectBoxes(a: Box, b: Box): Box | null {
    return createBox(Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3]));
}

function getBoxArea(box: Box): number {
    return (box[2] - box[0]) * (box[3] - box[1]);
}

/**
 * Remainder of a box after removing a contained cut box.
 */
function subtractBox(box: Box, cut: Box): Box[] {
    return [
        createBox(box[0], box[1], box[2], cut[1]),
        createBox(box[0], cut[3], box[2], box[3]),
        createBox(box[0], cut[1], cut[0], cut[3]),
        createBox(cut[2], cut[1], box[2], cut[3])
    ]
        .filter((box: Box | null): box is Box => !!box);
}

/**
 * Box presumably covered by an occluder hit at a point within a box.
 * Falls back to the quarter of the box around the point if the occluder geometry does not contain the point
 * (e.g., a ::backdrop hit reported as its dialog).
 */
function getCoveredBox(occluder: Element | null, x: number, y: number, box: Box): Box {
    for(const rect of (occluder?.getClientRects() ?? [])) {
        if(x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) continue;

        const coveredBox: Box | null = intersectBoxes([ rect.left, rect.top, rect.right, rect.bottom ], box);

        if(coveredBox) return coveredBox;
    }

    const width: number = (box[2] - box[0]) / 4;
    const height: number = (box[3] - box[1]) / 4;

    return intersectBoxes([ x - width, y - height, x + width, y + height ], box)
        ?? box;
}

/**
 * Area of the viewport that the element's scroll containers show (respecting containing blocks).
 */
function getScrollContainerClipBox(element: Element, viewportBox: Box): Box | null {
    let clipBox: Box | null = viewportBox;
    let position: string = getComputedStyle(element).position;

    if(position === "fixed") return clipBox;

    let needsContainingBlock: boolean = (position === "absolute");

    for(let ancestor: Element | null = resolveParent(element); ancestor && clipBox; ancestor = resolveParent(ancestor)) {
        const style: CSSStyleDeclaration = getComputedStyle(ancestor);

        position = style.position;

        if(needsContainingBlock && !CONTAINER_POSITION_VALUES.includes(position)) continue;

        needsContainingBlock = (position === "absolute");

        const scrollsX: boolean = SCROLL_OVERFLOW_VALUES.includes(style.overflowX);
        const scrollsY: boolean = SCROLL_OVERFLOW_VALUES.includes(style.overflowY);

        if(scrollsX || scrollsY) {
            const ancestorRect: DOMRect = ancestor.getBoundingClientRect();
            const left: number = ancestorRect.left + ancestor.clientLeft;
            const top: number = ancestorRect.top + ancestor.clientTop;

            clipBox = intersectBoxes(clipBox, [
                scrollsX ? left : -Infinity,
                scrollsY ? top : -Infinity,
                scrollsX ? (left + ancestor.clientWidth) : Infinity,
                scrollsY ? (top + ancestor.clientHeight) : Infinity
            ]);
        }

        if(position === "fixed") break;
    }

    return clipBox;
}

function composedContains(ancestor: Node, node: Node | null): boolean {
    const visited: Set<Node> = new Set();

    while(node) {
        if(node === ancestor) return true;

        if(visited.has(node)) break;

        visited.add(node);

        // Slotted nodes render within their slot (flat tree)
        const parent: Node | null = (node as Element).assignedSlot ?? node.parentNode;

        if(parent) {
            node = parent;

            continue;
        }

        if((node as any).host instanceof Element) {
            node = (node as any).host;

            continue;
        }

        break;
    }

    return false;
}

function isRelatedHit(element: Element, hitElement: Element | null): boolean {
    return !!hitElement
        && (
            (hitElement === element)
            || composedContains(element, hitElement)
            || composedContains(hitElement, element)
        );
}

/**
 * Search the element's visible area for a hit, largest unresolved part first.
 * Occluder boxes are removed from the search area. Before concluding occlusion, their corners are spot-checked,
 * where non-rectangular or clipped occluders would let the element through.
 */
function isElementOnHit(
    element: Element,
    rect: DOMRect,
    samples: number,
    clipBox: Box
): boolean {
    const elementRoot: Node = element.getRootNode();
    // Hits retargeted to the element's tree, not to the outermost shadow host
    const root: Document | ShadowRoot = (elementRoot instanceof ShadowRoot) ? elementRoot : document;

    const centerX: number = rect.left + rect.width / 2;
    const centerY: number = rect.top + rect.height / 2;

    if((rect.width < MIN_BOX_SIZE) || (rect.height < MIN_BOX_SIZE)) {
        return (centerX >= clipBox[0]) && (centerY >= clipBox[1]) && (centerX < clipBox[2]) && (centerY < clipBox[3])
            && isRelatedHit(element, root.elementFromPoint(centerX, centerY));
    }

    const visibleBox: Box | null = intersectBoxes([ rect.left, rect.top, rect.right, rect.bottom ], clipBox);

    if(!visibleBox) return false;

    const boxes: Box[] = [ visibleBox ];
    const coveredBoxes: Box[] = [];
    const hits: Map<string, Element | null> = new Map();

    let remainingHitTests: number = Math.max(1, Math.floor(samples));

    const hitTest = (x: number, y: number): Element | null => {
        const key: string = `${Math.round(x)},${Math.round(y)}`;

        if(!hits.has(key)) {
            remainingHitTests--;

            hits.set(key, root.elementFromPoint(x, y));
        }

        return hits.get(key) ?? null;
    };

    while(boxes.length && (remainingHitTests > 0)) {
        boxes.sort((a: Box, b: Box) => getBoxArea(b) - getBoxArea(a));

        const box: Box = boxes.shift() as Box;
        const x: number = (box[0] + box[2]) / 2;
        const y: number = (box[1] + box[3]) / 2;

        const hitElement: Element | null = hitTest(x, y);

        if(isRelatedHit(element, hitElement)) return true;

        const coveredBox: Box = getCoveredBox(hitElement, x, y, box);

        coveredBoxes.push(coveredBox);
        boxes.push(...subtractBox(box, coveredBox));
    }

    for(const coveredBox of coveredBoxes) {
        if(((coveredBox[2] - coveredBox[0]) < 2) || ((coveredBox[3] - coveredBox[1]) < 2)) continue;

        const corners: [ number, number ][] = [
            [ coveredBox[0] + 1, coveredBox[1] + 1 ],
            [ coveredBox[2] - 1, coveredBox[1] + 1 ],
            [ coveredBox[0] + 1, coveredBox[3] - 1 ],
            [ coveredBox[2] - 1, coveredBox[3] - 1 ]
        ];

        for(const corner of corners) {
            if(remainingHitTests <= 0) return false;

            if(isRelatedHit(element, hitTest(corner[0], corner[1]))) return true;
        }
    }

    return false;
}


export function isElementOccluded(
    element: Element,
    samples: number,
    scrollPolicy: ScrollIntoViewPolicy = { containers: true, viewport: true }
): boolean {
    const viewportWidth: number = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight: number = window.innerHeight || document.documentElement.clientHeight;

    const scrollRestoreCbs: (() => void)[] = scrollIntoViewSynchronously(element, scrollPolicy);

    let isOccluded: boolean = false;

    try {
        const rect: DOMRect = element.getBoundingClientRect();
        const viewportBox: Box = [ 0, 0, viewportWidth, viewportHeight ];
        // Not scrolled into view within its containers: only the part they show can be hit
        const clipBox: Box | null = scrollPolicy.containers
            ? viewportBox
            : getScrollContainerClipBox(element, viewportBox);

        isOccluded = !clipBox || !isElementOnHit(element, rect, samples, clipBox);
    } finally {
        for(let index: number = scrollRestoreCbs.length - 1; index >= 0; index--) {
            scrollRestoreCbs[index]();
        }
    }

    return isOccluded;
}