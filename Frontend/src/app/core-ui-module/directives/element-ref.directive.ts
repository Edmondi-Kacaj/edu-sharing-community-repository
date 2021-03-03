import { Directive, ElementRef } from '@angular/core';

// From https://stackoverflow.com/a/61065054
/**
 * Export the ElementRef of the selected element for use with template references.
 *
 * @example
 * <button mat-button #button="appElementRef" appElementRef></button>
 */
@Directive({
    selector: '[appElementRef]',
    exportAs: 'appElementRef',
})
export class ElementRefDirective<T> extends ElementRef<T> {
    constructor(elementRef: ElementRef<T>) {
        super(elementRef.nativeElement);
    }
}
