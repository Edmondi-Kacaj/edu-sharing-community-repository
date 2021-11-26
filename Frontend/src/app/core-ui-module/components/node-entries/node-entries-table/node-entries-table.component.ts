import { SelectionModel } from '@angular/cdk/collections';
import { CdkOverlayOrigin } from '@angular/cdk/overlay';
import {
    AfterViewInit,
    Component,
    EventEmitter,
    Input,
    Output,
    ViewChild,
    OnChanges,
    SimpleChanges, ApplicationRef,
} from '@angular/core';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort, MatSortHeader, Sort } from '@angular/material/sort';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { BehaviorSubject, combineLatest, Observable, Subject } from 'rxjs';
import { delay, first, map, takeUntil } from 'rxjs/operators';
import {NodeEntriesService} from '../../../node-entries.service';
import {Node} from '../../../../core-module/rest/data-object';
import {ListItem} from '../../../../core-module/ui/list-item';
import {MatCheckboxChange} from '@angular/material/checkbox';
import {Target} from '../../../option-item';
import {DropdownComponent} from '../../dropdown/dropdown.component';
import {MatMenuTrigger} from '@angular/material/menu';
import {CdkDragDrop, CdkDragEnter, CdkDragExit, CdkDropList} from '@angular/cdk/drag-drop';
import {DragCursorDirective, DragDropState} from '../../../directives/drag-cursor.directive';
import {CdkDrag} from '@angular/cdk/drag-drop/directives/drag';
import {ClickSource, InteractionType} from '../../node-entries-wrapper/entries-model';

@Component({
    selector: 'es-node-entries-table',
    templateUrl: './node-entries-table.component.html',
    styleUrls: ['./node-entries-table.component.scss'],
})
export class NodeEntriesTableComponent<T extends Node> implements OnChanges, AfterViewInit {
    readonly InteractionType = InteractionType;
    readonly ClickSource = ClickSource;
    readonly Target = Target;

    @ViewChild(MatSort) sort: MatSort;
    @ViewChild(MatPaginator) paginator: MatPaginator;
    @ViewChild('columnChooserTrigger') columnChooserTrigger: CdkOverlayOrigin;
    @ViewChild(DropdownComponent) dropdown: DropdownComponent;
    @ViewChild('menuTrigger') menuTrigger: MatMenuTrigger;

    dropdownLeft: number;
    dropdownTop: number;

    loading: Observable<boolean>;
    isPageSelected = new BehaviorSubject(false);
    isAllSelected = new BehaviorSubject(false);
    columnChooserVisible = false;
    ready = false;
    error: Observable<any>;
    pageSizeOptions = [25, 50, 100];
    dragSource: T;

    constructor(private route: ActivatedRoute,
                public entriesService: NodeEntriesService<T>,
                private applicationRef: ApplicationRef,
                private router: Router
    ) {
    }

    ngAfterViewInit(): void {
        Promise.resolve().then(() => {
            this.ready = true;
            this.registerSortChanges();
        });
    }

    ngOnChanges(changes: SimpleChanges): void {
        this.updateSort();
    }


    onRowContextMenu({ event, node }: { event: MouseEvent; node: T }) {
        if (!this.entriesService.selection.selected.includes(node)) {
            this.entriesService.selection.clear();
            this.entriesService.selection.select(node)
        }
        event.stopPropagation();
        event.preventDefault();
        this.dropdownLeft = event.clientX;
        this.dropdownTop = event.clientY;
        this.menuTrigger.openMenu();
    }

    private updateSort(): void {
        this.sort.sort({
            id: this.entriesService.sort?.active,
            start: (this.entriesService.sort?.direction as 'asc'|'desc'),
            disableClear: false
        });
        // Fix missing sorting indicators. See
        // https://github.com/angular/components/issues/10242#issuecomment-470726829. Seems
        // to be fixed upstream with Angular 11.
        (
            this.sort.sortables.get(this.entriesService.sort?.active) as MatSortHeader
        )._setAnimationTransitionState({
            toState: 'active',
        });
        /*
        this.route.queryParams.pipe(first()).subscribe((queryParams: Params) => {
            const sort: Sort = queryParams.sort ? JSON.parse(queryParams.sort) : null;
            if (sort && sort.direction) {
                this.sort.sort({ id: sort.active, start: sort.direction, disableClear: false });
                // Fix missing sorting indicators. See
                // https://github.com/angular/components/issues/10242#issuecomment-470726829. Seems
                // to be fixed upstream with Angular 11.
                (
                    this.sort.sortables.get(sort.active) as MatSortHeader
                )._setAnimationTransitionState({
                    toState: 'active',
                });
            }
            if (queryParams.pageIndex && queryParams.pageSize) {
                this.paginator.pageIndex = queryParams.pageIndex;
                this.paginator.pageSize = queryParams.pageSize;
            }
        });
         */
    }
    getVisibleColumns() {
        return ['select', 'icon'].concat(
            this.entriesService.columns.filter((c) => c.visible).map((c) => c.name)
        ).concat(
            ['actions']
        );
    }

    isSortable(column: ListItem) {
        return this.entriesService.sort?.columns.some((c) => c.name === column.name);
    }

    toggleAll(checked: boolean) {
        if(checked) {
            this.entriesService.selection.select(...this.entriesService.dataSource.getData());
        } else {
            this.entriesService.selection.clear();
        }

    }

    private registerSortChanges() {
        this.sort.sortChange.subscribe((sort: Sort) => {
            this.entriesService.sort.active = sort.active;
            this.entriesService.sort.direction = sort.direction;
            this.entriesService.sortChange.emit(this.entriesService.sort);
            /*this.router.navigate(['.'], {
                relativeTo: this.route,
                queryParams: { sort: JSON.stringify(sort) },
                queryParamsHandling: 'merge',
                replaceUrl: true,
            });*/
        });
        /*
        this.paginator.page
            .pipe(
                // As a response to changes of other parameters, the pageIndex might be reset to 0 and a
                // page event triggers. This change of other parameters is likely to cause a
                // `router.navigate()` call elsewhere. When this happens just before our call, our
                // updates are ignored. To shield against this, we wait a tick.
                delay(0),
            )
            .subscribe(({ pageIndex, pageSize }: PageEvent) => {
                this.router.navigate(['.'], {
                    relativeTo: this.route,
                    queryParams: { pageIndex, pageSize },
                    queryParamsHandling: 'merge',
                    replaceUrl: true,
                });
            });
         */
    }

    dragEnter = (index: number, drag: CdkDrag, drop: CdkDropList) => {
        const target = this.entriesService.dataSource.getData()[index];
        const allowed = this.entriesService.dragDrop.dropAllowed?.(target, {
            element: [this.dragSource],
            sourceList: this.entriesService.list,
            mode: DragCursorDirective.dragState.mode
        });
        DragCursorDirective.dragState.element = target;
        DragCursorDirective.dragState.dropAllowed = allowed;
        return false;
    }

    drop(drop: CdkDragDrop<T, any>) {
        this.entriesService.dragDrop.dropped(DragCursorDirective.dragState.element,{
            element: [this.dragSource],
            sourceList: this.entriesService.list,
            mode: DragCursorDirective.dragState.mode
        });
        DragCursorDirective.dragState.element = null;
    }

    dragExit(exit: CdkDragExit<T>|any) {
        DragCursorDirective.dragState.element = null
    }

    loadData() {
        if (this.entriesService.dataSource.hasMore()) {
            this.entriesService.fetchData.emit({
                offset: this.entriesService.dataSource.getData().length
            });
        }
    }

    getDragState() {
        return DragCursorDirective.dragState;
    }

    async openMenu(node: T) {
        this.entriesService.selection.clear();
        this.entriesService.selection.select(node);
        await this.applicationRef.tick();
        this.dropdown.menu.focusFirstItem();
    }
}
