import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { Node } from '../../../core-module/rest/data-object';
import { NodeHelperService } from '../../node-helper.service';
import { ListTableComponent } from '../list-table/list-table.component';
import {ActivatedRoute, Router} from '@angular/router';
import {PlatformLocation} from '@angular/common';

// TODO: Decide if providing focus highlights and ripples with this component is a good idea. When
// using `app-node-url` for cards, we might need highlights and ripples for the whole card while
// `app-node-url` should only wrap the title since links with lots of content confuse screen
// readers.

@Component({
    selector: 'es-node-url',
    template: `
        <ng-template #content><ng-content></ng-content></ng-template>
        <ng-container *ngIf="mode === 'link'">
            <a
                *ngIf="!disabled"
                #link
                matRipple
                matRippleColor="primary"
                [routerLink]="get('routerLink')"
                [state]="getState()"
                [queryParams]="get('queryParams')"
                queryParamsHandling="merge"
                cdkMonitorElementFocus
                [attr.aria-label]="ariaLabel ? listTable?.getPrimaryTitle(node) || node.name : null"
                [attr.aria-describedby]="ariaDescribedby"
            >
                <ng-container *ngTemplateOutlet="content"></ng-container>
            </a>
            <span *ngIf="disabled && !alwaysRipple">
                <ng-container *ngTemplateOutlet="content"></ng-container>
            </span>
            <span *ngIf="disabled && alwaysRipple" matRipple matRippleColor="primary">
                <ng-container *ngTemplateOutlet="content"></ng-container>
            </span>
        </ng-container>
        <ng-container *ngIf="mode === 'wrapper'">
            <div
                class="node-url-wrapper"
                #wrapper
                matRipple
                matRippleColor="primary"
                [matRippleDisabled]="disabled && !alwaysRipple"
                (click)="clickWrapper($event)"
            >
                <ng-container *ngTemplateOutlet="content"></ng-container>
            </div>
        </ng-container>
        <ng-container *ngIf="mode === 'button'">
            <button
                [disabled]="disabled"
                #link
                matRipple
                matRippleColor="primary"
                [matRippleDisabled]="disabled && !alwaysRipple"
                (click)="buttonClick.emit($event)"
            >
                <ng-container *ngTemplateOutlet="content"></ng-container>
            </button>
        </ng-container>
    `,
    styleUrls: ['node-url.component.scss'],
})
export class NodeUrlComponent {
    @ViewChild('link') link: ElementRef;

    @Input() listTable: ListTableComponent;
    @Input() node: Node;
    @Input() nodes: Node[];
    @Input() scope: string;
    /**
     * link: a element
     * button: button element
     * wrapper: div element with behaviour "like" a link
     */
    @Input() mode: 'link' | 'button' | 'wrapper' = 'link';
    @Input() disabled = false;
    /**
     * Show the ripple effect even when disabled.
     *
     * @deprecated Temporary workaround for list-table, which *sometimes* uses it's on click
     * bindings.
     */
    @Input() alwaysRipple = false;
    @Input('aria-describedby') ariaDescribedby: string;
    @Input('aria-label') ariaLabel = true;

    @Output() buttonClick = new EventEmitter<MouseEvent>();

    constructor(
        private nodeHelper: NodeHelperService,
        private router: Router,
        private platformLocation: PlatformLocation,
    ) {}

    getState() {
        return {
            scope: this.scope,
        };
    }

    get(mode: 'routerLink' | 'queryParams'): any {
        return this.nodeHelper.getNodeLink(mode, this.node);
    }

    focus(): void {
        this.link.nativeElement.focus();
    }

    clickWrapper(event: MouseEvent) {
        if(event.ctrlKey) {
            const url = this.router.serializeUrl(this.router.createUrlTree(
                [this.platformLocation.getBaseHrefFromDOM() + this.get('routerLink')], {
                    queryParams: this.get('queryParams'),
                    queryParamsHandling: 'merge',
                }));
            window.open(url);
        } else {
            this.router.navigate([this.get('routerLink')], {
                queryParams: this.get('queryParams'),
                state: this.getState(),
                queryParamsHandling: 'merge',

            });
        }
        event.preventDefault();
    }
}
