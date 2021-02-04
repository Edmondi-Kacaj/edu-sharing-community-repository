import { Directive, EventEmitter, Output, HostListener } from '@angular/core';

export interface DistinctClickEvent {
    event: MouseEvent;
    pointerType?: 'mouse' | 'touch' | 'pen';
}

/**
 * Emits click events enriched with pointer-type information.
 *
 * Propagation can be controlled by calling `stopPropagation` on either
 * distinctClick events or click events.
 *
 * Internally subscribes to both click and pointerup events. If a click event
 * can be attributed to a pointerup event, takes the pointer-type information
 * from the pointerup event and sets the respective property on the click event.
 */
@Directive({
    selector: '[appDistinctClick]',
})
export class DistinctClickDirective {
    /**
     * Allowed interval between pointerup and click event.
     *
     * If a click event follows a pointerup event within the time interval
     * defined here, the click event is attributed to the pointerup event.
     */
    private static readonly INTERVAL = 100;

    @Output('appDistinctClick') distinctClick = new EventEmitter<
        DistinctClickEvent
    >();

    private pointerupTarget: EventTarget;
    private pointerupTime: number;
    private pointerType: 'mouse' | 'touch' | 'pen';

    constructor() {}

    @HostListener('click', ['$event'])
    onClick(event: MouseEvent) {
        const distinctClickEvent: DistinctClickEvent = { event };
        if (this.clickMatchesPointerup(event)) {
            distinctClickEvent.pointerType = this.pointerType;
        }
        this.distinctClick.emit(distinctClickEvent);
    }

    @HostListener('pointerup', ['$event'])
    onPointerup(event: PointerEvent) {
        this.pointerupTarget = event.target;
        this.pointerupTime = new Date().getTime();
        this.pointerType = event.pointerType as 'mouse' | 'touch' | 'pen';
    }

    private clickMatchesPointerup(clickEvent: MouseEvent): boolean {
        const now = new Date().getTime();
        if (now - this.pointerupTime > DistinctClickDirective.INTERVAL) {
            return false;
        }
        if (this.pointerupTarget !== clickEvent.target) {
            return false;
        }
        return true;
    }
}
