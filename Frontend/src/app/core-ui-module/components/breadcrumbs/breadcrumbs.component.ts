import { Component, EventEmitter, HostBinding, Input, Output } from '@angular/core';
import { Node, RestNodeService } from '../../../core-module/core.module';
import {DragData, DragNodeTarget, DropData} from '../../directives/drag-nodes/drag-nodes';
import { Params, QueryParamsHandling } from '@angular/router';
import {CdkDragDrop, CdkDragEnter, CdkDragExit} from '@angular/cdk/drag-drop';
import {DropSource} from '../node-entries-wrapper/node-entries-wrapper.component';
import {DragCursorDirective} from '../../directives/drag-cursor.directive';

/**
 * Breadcrumbs for nodes or collections.
 */
@Component({
    selector: 'breadcrumbs',
    templateUrl: 'breadcrumbs.component.html',
    styleUrls: ['breadcrumbs.component.scss'],
})
export class BreadcrumbsComponent {
    /**
     * Caption of the home, if not set, a default icon is used.
     */
    @Input() home: string;

    /**
     * Icon of home, can be used together with `home`.
     */
    @Input() homeIcon: string;

    /**
     * shall an invisbile description (for screen readers) be generated, similar to
     * 'You're here'
     */
    @Input() invisibleDescription = false;
    /**
     * The path to give to `routerLink` on the home element.
     *
     * If not given, clicks will be emitted via the `onClick` output.
     */
    @Input() homeRouterLink: {
        routerLink: any[] | string;
        queryParams?: Params | null;
        queryParamsHandling?: QueryParamsHandling | null
    };
    /**
     * Attach a clickable class so the user cursor will be a hand.
     */
    @Input() clickable = true;
    /**
     * Show a short variant (only the last item).
     *
     * `auto` (default) decides via media query.
     */
    @HostBinding('attr.short')
    @Input() short: 'never' | 'always' | 'auto' = 'auto';
    /**
     * Should automatically be linked via angular routing.
     *
     * If set true, the onClick emitter will only be fired for the "root" element.
     */
    @Input() createLink = true;
    /**
     * Set a search query so the breadcrumbs will show this query.
     */
    @Input() set searchQuery(searchQuery: string) {
        this._searchQuery = searchQuery;
        this.addSearch();
    }
    /**
     * Set the breadcrumb list as a @Node array.
     */
    @Input() set breadcrumbsAsNode(nodes: Node[]) {
        if (nodes == null) return;
        this.nodes = nodes;
        this.addSearch();
    }
    /**
     * Set the breadcrumb main id.
     *
     * The breadcrumb nodes will get async resolved via API.
     */
    @Input() set breadcrumbsForId(id: string) {
        if (id == null) return;
        this.node.getNodeParents(id).subscribe((nodes) => {
            this.nodes = nodes.nodes.reverse();
            this.addSearch();
        });
    }

    /**
     * A breadcrumb is clicked.
     *
     * Passes the index **starting at 1** of the clicked breadcrumb, or 0 for the root element.
     */
    @Output() onClick = new EventEmitter<number>();
    /**
     * Called when an item is dropped on the breadcrumbs.
     */
    @Output() onDrop = new EventEmitter<{target: Node, source: DropSource<Node>}>();

    nodes: Node[] = [];

    private _searchQuery: string;

    constructor(private node: RestNodeService) {}

    openBreadcrumb(position: number) {
        this.onClick.emit(position);
    }

    private addSearch() {
        const add = !(
            this.nodes.length > 0 &&
            this.nodes[this.nodes.length - 1] &&
            this.nodes[this.nodes.length - 1].type === 'SEARCH'
        );
        if (this._searchQuery) {
            const search = new Node();
            search.name = `'${this._searchQuery}'`;
            search.type = 'SEARCH';
            if (add) {
                this.nodes.splice(this.nodes.length, 0, search);
            } else {
                this.nodes[this.nodes.length - 1] = search;
            }
        } else if (!add) {
            this.nodes.splice(this.nodes.length, 1);
        }
    }

    drop(event: CdkDragDrop<Node|any>) {
        this.onDrop.emit({
            target: event.container.data,
            source: {
                element: [event.item.data],
                sourceList: null,
                mode: DragCursorDirective.dragState.mode
            }
        });
        DragCursorDirective.dragState.element = null;
    }
    getDragState() {
        return DragCursorDirective.dragState;
    }

    dragExit(event: CdkDragExit<any>) {
        DragCursorDirective.dragState.element = null;
    }

    dragEnter(event: CdkDragEnter<any>) {
        DragCursorDirective.dragState.element = event.container.data;
        DragCursorDirective.dragState.dropAllowed = true;
    }
}
