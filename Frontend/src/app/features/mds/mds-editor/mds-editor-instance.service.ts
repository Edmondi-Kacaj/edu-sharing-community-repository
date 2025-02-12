import { Directive, EventEmitter, Injectable, Input, OnDestroy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ConfigService, FacetsDict, MdsService, MdsViewRelation } from 'ngx-edu-sharing-api';
import {
    BehaviorSubject,
    combineLatest,
    EMPTY,
    from,
    Observable,
    of,
    ReplaySubject,
    Subject,
    zip,
} from 'rxjs';
import {
    combineAll,
    filter,
    first,
    map,
    shareReplay,
    skip,
    switchMap,
    takeUntil,
    tap
} from 'rxjs/operators';
import {
    ConfigurationHelper,
    ConfigurationService,
    MdsValueList,
    Node,
    RestConnectorService,
    RestConstants,
    RestMdsService,
    RestSearchService,
} from '../../../core-module/core.module';
import { SearchService } from '../../../modules/search/search.service';
import { MdsEditorCommonService } from './mds-editor-common.service';
import { NativeWidgetComponent } from './mds-editor-view/mds-editor-view.component';
import { EditorMode } from '../types/mds-types';
import {
    BulkBehavior,
    BulkMode,
    EditorBulkMode,
    EditorType,
    InputStatus,
    MdsDefinition,
    MdsGroup,
    MdsView,
    MdsWidget,
    MdsWidgetCondition,
    MdsWidgetType,
    MdsWidgetValue,
    NativeWidgetType,
    RequiredMode,
    Values,
} from '../types/types';
import { parseAttributes } from './util/parse-attributes';
import { MdsEditorWidgetVersionComponent } from './widgets/mds-editor-widget-version/mds-editor-widget-version.component';

export interface CompletionStatusField {
    widget: Widget;
    isCompleted: boolean;
}
export interface CompletionStatusEntry {
    completed: number;
    total: number;
    fields?: CompletionStatusField[];
}

export type Widget = InstanceType<typeof MdsEditorInstanceService.Widget>;

export type CompletionStatus = { [key in RequiredMode]: CompletionStatusEntry };

/**
 * NativeWidget and Widget
 */
export interface GeneralWidget {
    status: Observable<InputStatus>;
    viewId: string;
}

// TODO: use this object for data properties and register it with the component.
interface NativeWidget extends GeneralWidget {
    component: NativeWidgetComponent;
}

export interface InitialValues {
    /** Values that are initially present in all nodes. */
    readonly jointValues: string[];
    /**
     * Values that are initially present in some but not all nodes.
     *
     * Can be null but will never be set to an empty array.
     */
    readonly individualValues?: string[];
}

@Directive()
export abstract class MdsEditorWidgetCore {
    @Input() widget: Widget;
    readonly editorMode: EditorMode;
    readonly editorBulkMode: EditorBulkMode;

    constructor(
        public mdsEditorInstance: MdsEditorInstanceService,
        protected translate: TranslateService,
    ) {
        this.editorMode = this.mdsEditorInstance.editorMode;
        this.editorBulkMode = this.mdsEditorInstance.editorBulkMode;
    }
}

/**
 * Manages state for an MDS editor instance.
 *
 * Do _not_ use in legacy `<mds>` component.
 */
@Injectable()
export class MdsEditorInstanceService implements OnDestroy {
    static Widget = class implements GeneralWidget {
        readonly addValue = new EventEmitter<MdsWidgetValue>();
        readonly status = new BehaviorSubject<InputStatus>(null);
        readonly meetsDynamicCondition = new BehaviorSubject<boolean>(true);
        readonly focusTrigger = new Subject<void>();
        private hasUnsavedDefault: boolean; // fixed after `ready`
        private initialValues: InitialValues;
        private initialDisplayValues: MdsValueList;
        private readonly value$ = new BehaviorSubject<string[]>(null);
        private isDirty = false;
        /**
         * Values that are shown as indeterminate to the user and will not be overwritten when
         * saving.
         */
        private indeterminateValues?: string[];
        /**
         * Whether the widget has unsaved changes.
         *
         * Also emits every time the widget value changes.
         */
        private hasChanged = new BehaviorSubject(false);
        private readonly bulkMode = new BehaviorSubject<BulkMode>(null); // only when `isBulk`
        private showMissingRequiredFunction: (shouldScrollIntoView: boolean) => boolean;
        private readonly ready = new Subject<void>();

        /**
         * An observable of the values that are common between all nodes if the property was to be
         * saved now.
         */
        private readonly jointProperty = combineLatest([this.ready, this.hasChanged]).pipe(
            map(() => this.getJointProperty()),
            shareReplay(1),
        );

        private readonly _new_inputValues$ =
            this.mdsEditorInstanceService._new_inputValuesSubject.pipe(
                map((values) => values[this.definition.id]),
            );

        constructor(
            private mdsEditorInstanceService: MdsEditorInstanceService,
            public readonly definition: MdsWidget,
            public readonly viewId: string,
            public readonly repositoryId: string,
            public readonly relation: MdsViewRelation = null,
            public readonly variables: { [key: string]: string } = null,
        ) {
            this.replaceVariables();
            combineLatest([this.value$, this.bulkMode, this.ready])
                .pipe(
                    map(([value, bulkMode]) => {
                        switch (bulkMode) {
                            case 'no-change':
                                return false;
                            case 'replace':
                            case null:
                                return (
                                    !!this.initialValues.individualValues ||
                                    !arrayIsEqual(value, this.initialValues.jointValues)
                                );
                        }
                    }),
                )
                .subscribe(this.hasChanged);
        }

        /**
         * Checks a dynamic property condition of another widget against the property of this
         * widget.
         *
         * @param condition must satisfy `condition.type === 'PROPERTY'` and `condition.dynamic ===
         * true`
         */
        checkPropertyCondition(condition: MdsWidgetCondition): Observable<boolean> {
            const pattern = condition.pattern ? new RegExp(`^(?:${condition.pattern})$`) : null;
            return this.jointProperty.pipe(
                map((jointProperty) => {
                    jointProperty = this.getJointProperty()
                    if (pattern) {
                        return (
                            jointProperty &&
                            jointProperty.some((property) => pattern.test(property))
                        );
                    } else {
                        return jointProperty?.[0]?.length >= 1;
                    }
                }),
                map((result) => result !== condition.negate),
            );
        }

        private getJointProperty(): string[] {
            const changedValues = this.mdsEditorInstanceService.getNewPropertyValue(
                this,
                this.initialValues.jointValues,
            );
            return this.mapParentValues(changedValues ?? this.initialValues.jointValues);
        }

        /**
         * replace variables from client.config inside parameters of the widget
         */
        private async replaceVariables() {
            if (this.variables != null) {
                for (const field of ['caption', 'placeholder', 'icon', 'defaultvalue']) {
                    (this.definition as any)[field] = this.replaceVariableString(
                        (this.definition as any)[field],
                    );
                }
            }
        }

        private replaceVariableString(
            str: string,
            variables: { [key: string]: string } = this.variables,
        ) {
            if (!str || !str.match('\\${.+}')) {
                return str;
            }
            for (const key in variables) {
                if ('${' + key + '}' === str) {
                    return variables[key];
                }
            }
            console.warn(
                'mds declared variable ' +
                    str +
                    ', but it was not found in the config variables. List of known variables below',
            );
            console.warn(variables);
            return str;
        }

        initWithNodes(nodes: Node[]): void {
            const nodeValues = nodes.map((node) => this.readNodeValue(node, this.definition));
            if (nodeValues.every((nodeValue) => nodeValue === undefined)) {
                const defaultValue = this.definition.defaultvalue
                    ? [this.definition.defaultvalue]
                    : [];
                this.initialValues = { jointValues: defaultValue };
                this.hasUnsavedDefault = defaultValue.length > 0;
            } else {
                this.initialValues = this.calculateInitialValues(nodeValues);
            }
            // Set initial values, so the initial completion status is calculated correctly.
            this.value$.next([...this.initialValues.jointValues]);
            if (this.mdsEditorInstanceService.getIsBulk(nodes)) {
                this.bulkMode.next('no-change');
            }
            this.ready.next();
            this.ready.complete();
        }

        initWithValues(values?: Values): void {
            if (this.relation === 'suggestions') {
                this.initialValues = { jointValues: [] };
            } else {
                this.initialValues = {
                    jointValues:
                        values?.[this.definition.id] ||
                        (this.definition.defaultvalue ? [this.definition.defaultvalue] : []),
                };
            }
            // Set initial values, so the initial completion status is calculated correctly.
            this.value$.next([...this.initialValues.jointValues]);
            this.ready.next();
            this.ready.complete();
        }

        getInitialValues(): InitialValues {
            return this.initialValues;
        }

        getHasUnsavedDefault(): boolean {
            return this.hasUnsavedDefault;
        }

        getValue(): string[] {
            return this.value$.value;
        }

        getIndeterminateValues(): string[] {
            return this.indeterminateValues;
        }

        getHasChanged(): boolean {
            return this.hasChanged.value;
        }

        getStatus(): InputStatus {
            return this.status.value;
        }

        getBulkMode(): BulkMode {
            return this.bulkMode.value;
        }

        getIsDirty(): boolean {
            return this.isDirty;
        }

        async getSuggestedValues(searchString?: string): Promise<MdsWidgetValue[]> {
            if (this.definition.values) {
                return this.getLocalSuggestedValues(searchString);
            } else {
                return this.getRemoteSuggestedValues(searchString);
            }
        }

        setValue(value: string[], dirty: boolean = true): void {
            // this.mdsEditorInstanceService.valueChanged.emit({
            //     property: this.definition.id,
            //     newValue: value,
            // });
            this.isDirty = dirty;
            this.value$.next(value);
            this.mdsEditorInstanceService.updateHasChanges();
        }

        _new_getValue(): string[] {
            return this.mdsEditorInstanceService._new_valuesSubject.value?.[this.definition.id];
        }

        _new_observeValue(): Observable<string[]> {
            return this.mdsEditorInstanceService._new_valuesSubject.pipe(
                map((values) => values?.[this.definition.id]),
            );
        }

        _new_setValue(value: string[]): void {
            this.mdsEditorInstanceService._new_patchValues({
                [this.definition.id]: value,
            });
        }

        _new_setCustomValues(values: Values): void {
            this.mdsEditorInstanceService._new_patchValues(values);
        }

        setIndeterminateValues(indeterminateValues?: string[]): void {
            this.indeterminateValues = indeterminateValues;
        }

        setStatus(value: InputStatus): void {
            this.status.next(value);
        }

        setBulkMode(value: BulkMode): void {
            this.bulkMode.next(value);
            this.mdsEditorInstanceService.updateHasChanges();
        }

        setInitialDisplayValues(value: MdsValueList) {
            this.initialDisplayValues = value;
        }

        getInitialDisplayValues() {
            return this.initialDisplayValues;
        }

        observeValue(): Observable<string[]> {
            return this.value$.asObservable();
        }

        observeHasChanged(): Observable<boolean> {
            return this.hasChanged.asObservable();
        }

        observeBulkMode(): Observable<BulkMode> {
            return this.bulkMode.asObservable();
        }

        observeIsDisabled(): Observable<boolean> {
            return this.bulkMode.pipe(map((bulkMode) => bulkMode === 'no-change'));
        }

        /**
         * Register function to reveal a missing required field.
         *
         * @param f reveals the required hint if the field is required and has no value; returns
         * whether the field was missing and scrolled into view
         */
        registerShowMissingRequired(f: (shouldScrollIntoView: boolean) => boolean) {
            if (this.showMissingRequiredFunction) {
                throw new Error('onShowMissingRequired was called more than once');
            }
            this.showMissingRequiredFunction = f;
        }

        /**
         * @returns whether the the widget was scrolled into view
         */
        showMissingRequired(shouldScrollIntoView: boolean): boolean {
            if (this.showMissingRequiredFunction && this.meetsDynamicCondition.value) {
                return this.showMissingRequiredFunction(shouldScrollIntoView);
            } else {
                return false;
            }
        }

        private calculateInitialValues(nodeValues: string[][]): InitialValues {
            const allValues = nodeValues.reduce((acc, values = []) => {
                return [...acc, ...values.filter((value) => !acc.includes(value))];
            }, [] as string[]);
            const jointValues: string[] = allValues.filter((value) =>
                nodeValues.every((values = []) => values.includes(value)),
            );
            let individualValues: string[] = null;
            if (allValues.length !== jointValues.length) {
                individualValues = allValues.filter((value) =>
                    nodeValues.some((values = []) => !values.includes(value)),
                );
            }
            return { jointValues, individualValues };
        }

        private getLocalSuggestedValues(searchString?: string): MdsWidgetValue[] {
            if (searchString) {
                const filterString = searchString.toLowerCase();
                return this.definition.values.filter(
                    (value) =>
                        value.caption.toLowerCase().indexOf(filterString) !== -1 ||
                        value.id.toLowerCase().indexOf(filterString) !== -1,
                );
            } else {
                return this.definition.values;
            }
        }

        private async getRemoteSuggestedValues(searchString?: string): Promise<MdsWidgetValue[]> {
            if (!searchString || searchString.length < 2) {
                return [];
            }
            let criteria: any[] = [];
            if (this.mdsEditorInstanceService.editorMode === 'search') {
                const values = await this.mdsEditorInstanceService.getValues();
                delete values[this.definition.id];
                values[RestConstants.PRIMARY_SEARCH_CRITERIA] = [
                    this.mdsEditorInstanceService.searchService.searchTerm,
                ];
                criteria = RestSearchService.convertCritierias(
                    values,
                    this.mdsEditorInstanceService.widgets.value.map((w) => w.definition),
                );
            }
            return this.mdsEditorInstanceService.restMdsService
                .getValues(
                    {
                        valueParameters: {
                            query: RestConstants.DEFAULT_QUERY_NAME,
                            property: this.definition.id,
                            pattern: searchString,
                        },
                        criteria,
                        /*
                        criterias: RestSearchService.convertCritierias(
                            Helper.arrayJoin(this._currentValues, this.getValues()),
                            this.mds.widgets,
                        ),*/
                    },
                    this.mdsEditorInstanceService.mdsId,
                    this.repositoryId,
                )
                .pipe(
                    map(({ values }) => {
                        return values.map((v) => {
                            return {
                                id: v.key,
                                caption: v.displayString ?? v.key,
                            };
                        });
                    }),
                )
                .toPromise();
        }

        public getValuesForKeys(keys: string[]) {
            const mdsvl = this.mdsEditorInstanceService.restMdsService
                .getValuesForKeys(
                    keys,
                    this.mdsEditorInstanceService.mdsId,
                    RestConstants.DEFAULT_QUERY_NAME,
                    this.definition.id,
                    RestConstants.HOME_REPOSITORY,
                )
                .toPromise();
            return mdsvl;
        }

        private readNodeValue(node: Node, definition: MdsWidget): string[] {
            if (definition.type === MdsWidgetType.Range) {
                const from: string[] = node.properties[`${definition.id}_from`];
                const to: string[] = node.properties[`${definition.id}_to`];
                if (from !== undefined && to !== undefined) {
                    return [from?.[0], to?.[0]];
                } else {
                    return undefined;
                }
            } else {
                return node.properties[definition.id];
            }
        }

        /**
         * For tree widgets:
         * in case of a tree with structure "a -> b -> c", and value "c" is checked
         * this method will also attach the values a and b to the list
         * @private
         */
        public mapParentValues(values: string[]) {
            if (!this.definition.values || !values) {
                return values;
            }
            const result = new Set<string>();
            values.forEach((id) => {
                let v = this.definition.values.find((v) => v.id === id);
                result.add(id);
                while (v?.parent) {
                    result.add(v.parent);
                    v = this.definition.values.find((v) => v.id === v.parent);
                }
            });
            return Array.from(result);
        }
    };

    // Fixed after initialization
    mdsId: string;
    repository: string;
    groupId: string;
    /** Complete MDS definition. */
    mdsDefinition$ = new BehaviorSubject<MdsDefinition>(null);
    /** Nodes with updated and complete metadata. */
    nodes$ = new BehaviorSubject<Node[]>(null);
    /** Current values (if not in node mode) */
    values$ = new BehaviorSubject<Values>(null);
    /** MDS Views of the relevant group (in order). */
    views: MdsView[];
    /** Whether the editor is in bulk mode to edit multiple nodes at once. */
    editorBulkMode: EditorBulkMode;
    editorMode: EditorMode;
    isEmbedded: boolean;
    // Not used any more?
    // valueChanged = new EventEmitter<{ property: string; newValue: string[] }>();

    // Mutable state
    shouldShowExtendedWidgets$ = new BehaviorSubject(false);
    /**
     * Fires when (a different) MDS definition was loaded and widgets and views were updated
     * accordingly.
     */
    mdsInitDone = new ReplaySubject<void>(1);
    /** Fires when all widgets have been injected.
     *
     * First value emitted is `true` when all widgets are ready.
     *
     * Will set to `false` during re-initialization.
     */
    mdsInflated = new ReplaySubject<boolean>(1);
    mdsInflatedValue: boolean;
    suggestionsSubject = new BehaviorSubject<FacetsDict>(null);
    /** Views that have at least one widget, that is not hidden due to dynamic conditions. */
    activeViews = new ReplaySubject<MdsView[]>(1);
    /** Updated widget values, not considering nodes. */
    readonly values: Observable<{ [id: string]: string[] }>;

    /**
     * Active widgets.
     *
     * Widgets are not added or removed after initialization, but hold mutable state.
     */
    widgets: BehaviorSubject<Widget[]> = new BehaviorSubject(null);
    /**
     * Active, "native" widgets (which are not defined via mds properties directly).
     *
     * E.g. `preview`, `version`, `author`.
     *
     * Will be appended on init depending if they exist in the currently rendered group.
     */
    nativeWidgets = new BehaviorSubject<NativeWidget[]>([]);

    // Mutable state
    private readonly completionStatus$ = new BehaviorSubject<CompletionStatus>(null);
    /** Whether the value would be updated on save due to changes by the user. */
    private hasUserChanges$ = new BehaviorSubject(false);
    /**
     * Whether the value would be updated on save without the user having touched the widget due to
     * defaults.
     */
    private hasProgrammaticChanges$ = new BehaviorSubject(false);
    private isValid$ = new BehaviorSubject(true);
    private canSave$ = new BehaviorSubject(false);
    private lastScrolledIntoViewIndex: number = null;
    private isDestroyed = false;
    private destroyed$ = new Subject<void>();

    private readonly initMdsTrigger = new Subject<{
        groupId: string;
        mdsId: string;
        repository?: string;
        nodes?: Node[];
        values?: Values;
    }>();

    /**
     * Values changed by user input or through application of default values or value constraints.
     *
     * Does not trigger when values are set from outside.
     *
     * Methods and functions with the `_new_` prefix are introducing a new system of tracking
     * values, which is currently **not** broadly **supported**.
     */
    readonly _new_valuesChange = new EventEmitter<Values>();
    private readonly _new_inputValuesSubject = new BehaviorSubject<Values>(null);
    private readonly _new_valuesSubject = new BehaviorSubject<Values>(null);
    /**
     * - `new`: the mds has not yet been initialized
     * - `initializing`: the mds is currently initializing or re-initializing
     * - `failed`: initialization has failed
     * - `complete`: initialization is complete
     */
    private readonly _new_initializingStateSubject = new BehaviorSubject<
        'new' | 'initializing' | 'failed' | 'complete'
    >('new');

    constructor(
        private mdsEditorCommonService: MdsEditorCommonService,
        private mdsService: MdsService,
        private restMdsService: RestMdsService,
        private configService: ConfigurationService,
        private restConnector: RestConnectorService,
        private searchService: SearchService,
        private config: ConfigService,
    ) {
        this.registerInitMds();
        this.register_new_valuesChange();
        this.register_new_inputValuesSubject();
        this.mdsInflated.subscribe((mdsInflated) => (this.mdsInflatedValue = mdsInflated));
        // TODO: register all dynamic properties via observable pipes as done here. This way, new
        // properties can easily be derived from existing ones without having to get all the points
        // right where we have to call the respective `updateX` methods.
        combineLatest([this.hasUserChanges$, this.hasProgrammaticChanges$, this.isValid$])
            .pipe(
                map(
                    ([hasUserChanges, hasProgrammaticChanges, isValid]) =>
                        (this.editorMode === 'nodes'
                            ? hasUserChanges || hasProgrammaticChanges
                            : true) && isValid,
                ),
            )
            .subscribe(this.canSave$);
        // Updated list of widgets that meet dynamic conditions and should be considered when saving
        // values and counting completion status.
        const activeWidgets = combineLatest([this.widgets, this.nativeWidgets]).pipe(
            switchMap(([widgets, nativeWidgets]) =>
                combineLatest([
                    ...(widgets?.map((widget) =>
                        widget.meetsDynamicCondition.pipe(
                            map((meetsCondition) => ({ widget, meetsCondition })),
                        ),
                    ) ?? []),
                    ...(nativeWidgets?.map((widget) => of({ widget, meetsCondition: true })) ?? []),
                ]).pipe(
                    map((entry) =>
                        entry
                            .filter(({ meetsCondition }) => meetsCondition)
                            .map(({ widget }) => widget),
                    ),
                ),
            ),
        );
        activeWidgets
            .pipe(
                switchMap((widgets) => {
                    const filteredWidgets: Widget[] = widgets
                        // Filter out native widgets since we cannot tell whether they set a value
                        // for now.
                        .filter(
                            (widget): widget is Widget =>
                                'definition' in widget &&
                                !Object.values(NativeWidgetType).includes(
                                    widget.definition.id as NativeWidgetType,
                                ),
                        )
                        // Filter out widgets that are not shown to the user.
                        .filter(
                            (widget) =>
                                widget.definition.type !== MdsWidgetType.DefaultValue &&
                                widget.definition.interactionType !== 'None',
                        )
                        // only require widgets that meet conditions and are currently displayed
                        .filter(
                            (widget) =>
                                this.meetsCondition(widget.definition, this.nodes$.value, this.values$.value, true)
                        );
                    return combineLatest(
                        filteredWidgets.map((widget) =>
                            widget.observeHasChanged().pipe(map(() => widget)),
                        ),
                    ).pipe(map((ws) => this.calculateCompletionStatus(ws)));
                }),
            )
            .subscribe((c) => {
                this.completionStatus$.next(c);
                this.isValid$.next(c.mandatory.total === c.mandatory.completed);
            });
        activeWidgets
            .pipe(
                map((widgets) =>
                    this.views.filter((view) =>
                        widgets.some((widget) => widget.viewId === view.id),
                    ),
                ),
            )
            .subscribe(this.activeViews);
        this.values = activeWidgets.pipe(
            // Don't spam the observable with changes while UI is constructing.
            switchMap((widgets) =>
                this.mdsInflated.pipe(
                    first((isInflated) => isInflated),
                    map(() => widgets),
                ),
            ),
            switchMap((widgets) =>
                // FIXME: The mappings below are a bit hacky. We take take the raw `value`
                // observable for regular widgets and the `hasChanges` observable for native widgets
                // and extract the actual values later in the pipe.
                //
                // TODO: Provide observables for the mapped values by the widgets themselves, so
                // they can be trivially combined here.
                combineLatest([
                    // regular widgets
                    combineLatest(
                        widgets
                            .filter(
                                (widget): widget is Widget =>
                                    widget instanceof MdsEditorInstanceService.Widget,
                            )
                            .filter((widget) => widget.meetsDynamicCondition.value)
                            .map((widget) => widget.observeValue().pipe(map((value) => widget))),
                    ).pipe(map((regularWidgets) => this.mapWidgetValues(regularWidgets))),
                    // native widgets
                    ...widgets
                        .filter(
                            (widget): widget is NativeWidget =>
                                !(widget instanceof MdsEditorInstanceService.Widget),
                        )
                        .map((nativeWidget) =>
                            nativeWidget.component.hasChanges.pipe(
                                switchMap((hasChanges) =>
                                    nativeWidget.component.getValues
                                        ? from(nativeWidget.component.getValues({}, null))
                                        : of({}),
                                ),
                            ),
                        ),
                ]).pipe(takeUntil(this.mdsInflated.pipe(filter((isInflated) => !isInflated)))),
            ),
            map((values) =>
                values.reduce((acc, v) => ({ ...acc, ...v }), {} as { [id: string]: string[] }),
            ),
            shareReplay(1),
        );
    }

    ngOnDestroy() {
        this.isDestroyed = true;
        this.destroyed$.next();
        this.destroyed$.complete();
    }

    /**
     * Initializes the service, fetching data from the backend.
     *
     * @throws UserPresentableError
     */
    async initWithNodes(
        nodes: Node[],
        {
            groupId = null,
            refetch = true,
            bulkBehavior = BulkBehavior.Default,
            editorMode = 'nodes'
        }: { groupId?: string; refetch?: boolean; bulkBehavior?: BulkBehavior, editorMode?: EditorMode } = {},
    ): Promise<EditorType> {
        this.editorMode = editorMode;
        if (refetch) {
            this.nodes$.next(await this.mdsEditorCommonService.fetchNodesMetadata(nodes));
        } else {
            this.nodes$.next(nodes);
        }
        if (this.getIsBulk(this.nodes$.value)) {
            this.editorBulkMode = { isBulk: true, bulkBehavior };
        } else {
            this.editorBulkMode = { isBulk: false };
        }
        if (!groupId) {
            groupId = this.mdsEditorCommonService.getGroupId(this.nodes$.value);
        }
        const mdsId = this.mdsEditorCommonService.getMdsId(this.nodes$.value);
        await this.initMds(groupId, mdsId, undefined, this.nodes$.value);
        for (const widget of this.widgets.value) {
            widget.initWithNodes(this.nodes$.value);
            if (
                widget.definition.type === MdsWidgetType.MultiValueFixedBadges &&
                !widget.definition.values &&
                widget.getInitialValues().jointValues
            ) {
                const mdsValueList = await widget.getValuesForKeys(
                    widget.getInitialValues().jointValues,
                );
                if (mdsValueList) {
                    widget.setInitialDisplayValues(mdsValueList);
                }
            }
        }
        setTimeout(() =>
                this.widgets.next(this.widgets.value.slice())
            , 5000);
        // to lower case because of remote repos wrong mapping
        return this.getGroup(
            this.mdsDefinition$.value,
            groupId,
        ).rendering?.toLowerCase() as EditorType;
    }

    async initWithoutNodes(
        groupId: string,
        mdsId: string = null,
        repository: string = '-home-',
        editorMode: EditorMode = 'search',
        initialValues: Values = {},
    ): Promise<EditorType> {
        this.editorMode = editorMode;
        this.editorBulkMode = { isBulk: false };
        this.values$.next(initialValues);
        if(mdsId === null) {
            try {
                const sets = ConfigurationHelper.filterValidMds(
                    repository,
                    (await this.restMdsService.getSets().toPromise()).metadatasets,
                    this.configService);
                mdsId = sets[0]?.id;
            } catch(e) {
                console.warn('Error while resolving primary mds', e);
            }
            if(!mdsId) {
                mdsId = RestConstants.DEFAULT;
            }
        }
        const hasInitialized = await this.initMds(groupId, mdsId, repository, null, initialValues);
        if (!hasInitialized) {
            return null;
        }
        for (const widget of this.widgets.value) {
            widget.initWithValues(initialValues);
        }
        for (const widget of this.nativeWidgets.value) {
            if (widget instanceof MdsEditorWidgetCore) {
                (widget as MdsEditorWidgetCore).widget.initWithValues(initialValues);
            }
        }

        // to lower case because of remote repos wrong mapping
        return this.getGroup(
            this.mdsDefinition$.value,
            groupId,
        ).rendering?.toLowerCase() as EditorType;
    }

    async clearValues(): Promise<void> {
        // At the moment, widget components don't support changing or resetting the value from
        // outside the component. Therefore, we have to reload and redraw everything here.
        //
        // TODO: Handle values in a way that allows dynamic updates.
        await this.initMds(
            this.groupId,
            this.mdsId,
            this.repository,
            this.nodes$.value,
            this.values$.value,
        );
        for (const widget of this.widgets.value) {
            widget.initWithValues();
        }
    }

    getWidgetsByTagName(tagName: string, viewId: string): Widget[] {
        tagName = tagName.toLowerCase();
        return this.widgets.value.filter(
            (widget) => widget.definition.id.toLowerCase() === tagName && widget.viewId === viewId,
        );
    }

    getPrimaryWidget(propertyName: string): Widget {
        return this.widgets.value.find(
            (widget) => widget.definition.id === propertyName && widget.relation === null,
        );
    }

    getHasUserChanges(): boolean {
        return this.hasUserChanges$.value;
    }

    getCanSave(): boolean {
        return this.canSave$.value;
    }

    observeCanSave(): Observable<boolean> {
        return this.canSave$.asObservable();
    }

    observeCompletionStatus(): Observable<CompletionStatus> {
        return this.completionStatus$.asObservable();
    }

    /**
     * Shows the required hints of all missing widgets and scrolls widgets into view, rotating
     * through all widgets when called multiple times.
     */
    showMissingRequiredWidgets(shouldScrollIntoView = true): void {
        if (this.lastScrolledIntoViewIndex === null) {
            // No widget was scrolled into view yet. We need to touch all widgets so they will
            // display the required hint and tell them to scroll into view until we found a missing
            // one.
            let hasBeenScrolledIntoView = false;
            for (const [index, widget] of this.widgets.value.entries()) {
                const hasJustBeenScrolledIntoView = widget.showMissingRequired(
                    shouldScrollIntoView && !hasBeenScrolledIntoView,
                );
                if (hasJustBeenScrolledIntoView) {
                    hasBeenScrolledIntoView = true;
                    this.lastScrolledIntoViewIndex = index;
                }
            }
        } else if (shouldScrollIntoView) {
            // We already touched all widgets and scrolled one into view. Just iterate the widgets
            // starting from the one that was last scrolled into view until we find the next missing
            // one.
            for (let i = 0; i < this.widgets.value.length; i++) {
                const index = (i + this.lastScrolledIntoViewIndex + 1) % this.widgets.value.length;
                const hasJustBeenScrolledIntoView =
                    this.widgets.value[index].showMissingRequired(true);
                if (hasJustBeenScrolledIntoView) {
                    this.lastScrolledIntoViewIndex = index;
                    break;
                }
            }
        }
    }

    async save(): Promise<Node[] | Values> {
        if (!this.nodes$.value) {
            return this.getValues();
        }
        const newValues = await this.getNodeValuePairs();
        let updatedNodes: Node[];
        const versionWidget: MdsEditorWidgetVersionComponent = this.nativeWidgets.value.find(
            (w) => w.component instanceof MdsEditorWidgetVersionComponent,
        )?.component as MdsEditorWidgetVersionComponent;
        for (const widget of this.nativeWidgets.value) {
            if (widget.component.onSaveNode) {
                await widget.component.onSaveNode(this.nodes$.value);
            }
        }
        if (versionWidget) {
            if (versionWidget.file) {
                updatedNodes = await this.mdsEditorCommonService.saveNodesMetadata(newValues);
                await this.mdsEditorCommonService.saveNodeContent(
                    this.nodes$.value[0],
                    versionWidget.file,
                    versionWidget.comment,
                );
                return updatedNodes;
            }
        }
        updatedNodes = await this.mdsEditorCommonService.saveNodesMetadata(
            newValues,
            versionWidget?.comment || RestConstants.COMMENT_METADATA_UPDATE,
        );
        return updatedNodes;
    }

    getIsValid() {
        return this.isValid$.value;
    }
    getCompletitonStatus() {
        return this.completionStatus$.value;
    }

    async getValues(node?: Node, validate = true): Promise<Values> {
        // same behaviour as old mds, do not return values until it is valid
        if (validate && !this.isValid$.value) {
            this.showMissingRequiredWidgets(true);
            return null;
        }

        let values = this.mapWidgetValues(this.widgets.value, node);
        // Native widgets don't necessarily match their ID and relevant property or even affect
        // multiple properties. Therefore, we allow them to set arbitrary properties by implementing
        // `getValues()`.
        for (const widget of this.nativeWidgets.value) {
            values = widget.component.getValues
                ? await widget.component.getValues(values, node)
                : values;
        }

        return values;
    }

    private mapWidgetValues(widgets: Widget[], node?: Node): { [id: string]: string[] } {
        return widgets
            .filter((widget) => widget.relation === null)
            .reduce((acc, widget) => {
                const property = widget.definition.id;
                const newValue = this.getNewPropertyValue(widget, node?.properties[property]);
                // filter null values in search
                if (
                    this.editorMode === 'search' &&
                    newValue?.length === 1 &&
                    newValue[0] === null
                ) {
                    return acc;
                } else if (newValue) {
                    if (widget.definition.type === MdsWidgetType.Range) {
                        acc[`${property}_from`] = [newValue[0]];
                        acc[`${property}_to`] = [newValue[1]];
                    } else {
                        if (acc[property]) {
                            console.error(
                                'Encountered more than one widget setting the same property',
                                property,
                            );
                        }
                        acc[property] = newValue;
                    }
                }
                return acc;
            }, {} as { [key: string]: string[] });
    }
    getRegisteredWidgets(): Observable<GeneralWidget[]> {
        return zip(this.widgets, this.nativeWidgets).pipe(map(x => (x[0] as GeneralWidget[]).concat(x[1])));
    }

    registerNativeWidget(component: NativeWidgetComponent, viewId: string): void {
        this.nativeWidgets.next([
            ...this.nativeWidgets.value,
            { component, viewId, status: component.status ?? of('VALID') },
        ]);
        component.hasChanges.subscribe(() => {
            if (this.isDestroyed) {
                console.warn(
                    'Native widget is pushing state after having been destroyed:',
                    component,
                );
                component.hasChanges.complete();
                return;
            }
            this.updateHasChanges();
        });
    }

    /**
     * @returns `true` if the MDS was initialized and `false` if initialization was canceled due to
     * a new call to `initMds`.
     */
    private async initMds(
        groupId: string,
        mdsId: string,
        repository?: string,
        nodes?: Node[],
        values?: Values,
    ): Promise<boolean> {
        // Use a trigger to be able to cancel the init process when `initMds` is called a second
        // time before the first call could complete.
        this.initMdsTrigger.next({
            groupId,
            mdsId,
            repository,
            nodes,
            values,
        });
        return new Promise((resolve) => {
            this._new_initializingStateSubject
                .pipe(
                    // _new_initializingSubject will be set to `initializing` as reaction to the
                    // trigger.
                    skip(1),
                    // If it becomes `complete` next, the initialization went through. If it is set
                    // to `initializing` again, `initMds` was called again, before the run
                    // completed.
                    first(),
                )
                .subscribe((state) => resolve(state === 'complete'));
        });
    }

    private registerInitMds(): void {
        this.initMdsTrigger
            .pipe(
                tap(() => this._new_initializingStateSubject.next('initializing')),
                switchMap((args) =>
                    this.doInitMds(
                        args.groupId,
                        args.mdsId,
                        args.repository,
                        args.nodes,
                        args.values,
                    ),
                ),
            )
            .subscribe({
                next: ({ mdsId, repository, groupId, mdsDefinition, views, widgets }) => {
                    if (this.mdsDefinition$.value !== mdsDefinition) {
                        this.mdsDefinition$.next(mdsDefinition);
                    }
                    this.mdsId = mdsId;
                    this.repository = repository;
                    this.groupId = groupId;
                    this.views = views;
                    this.widgets.next(widgets);
                    this.mdsInitDone.next();
                    this._new_initializingStateSubject.next('complete');
                },
                error: (error) => {
                    console.warn('Failed to initialize MDS:', error);
                    this._new_initializingStateSubject.next('failed');
                },
            });
    }

    private async doInitMds(
        groupId: string,
        mdsId: string,
        repository?: string,
        nodes?: Node[],
        values?: Values,
    ) {
        let mdsDefinition = this.mdsDefinition$.value;
        if (
            this.mdsId !== mdsId ||
            this.repository !== repository ||
            this.groupId !== groupId ||
            !this.mdsDefinition$.value
        ) {
            mdsDefinition = await this.mdsService
                .getMetadataSet({ metadataSet: mdsId, repository })
                .toPromise();
        }
        const group = this.getGroup(mdsDefinition, groupId);
        if (!group) {
            throw new Error(`no such group "${groupId}"`);
        }
        const views = this.getViews(mdsDefinition, group);
        const widgets = await this.generateWidgets(mdsDefinition, views, nodes, values);
        return { mdsId, repository, groupId, mdsDefinition, views, widgets };
    }

    private getIsBulk(nodes: Node[]): boolean {
        return nodes?.length > 1;
    }

    private updateHasChanges(): void {
        const someWidgetsHaveUserChanges = this.widgets.value.some(
            (widget) =>
                widget.getHasChanged() && widget.getIsDirty() && widget.getStatus() !== 'DISABLED',
        );
        const someWidgetsHaveProgrammaticChanges = this.widgets.value.some(
            (widget) =>
                // Explicit default values, defined in MDS.
                (widget.getHasUnsavedDefault() ||
                    // Implicit default values, that have been set by the form without user
                    // interaction based on the widget type, e.g. `false` on a checkbox.
                    (widget.getHasChanged() && !widget.getIsDirty())) &&
                widget.getStatus() !== 'DISABLED',
        );
        const someNativeWidgetsHaveChanges = this.nativeWidgets.value.some(
            (w) => w.component.hasChanges.value,
        );
        this.hasUserChanges$.next(someWidgetsHaveUserChanges || someNativeWidgetsHaveChanges);
        this.hasProgrammaticChanges$.next(someWidgetsHaveProgrammaticChanges);
    }

    private getGroup(mdsDefinition: MdsDefinition, groupId: string): MdsGroup {
        return mdsDefinition.groups.find((g) => g.id === groupId);
    }

    private getViews(mdsDefinition: MdsDefinition, group: MdsGroup): MdsView[] {
        return group.views.map((viewId) => mdsDefinition.views.find((v) => v.id === viewId));
    }

    createWidget(
        widgetDefinition: MdsWidget,
        viewId: string,
        repository = RestConstants.HOME_REPOSITORY,
    ) {
        return new MdsEditorInstanceService.Widget(this, widgetDefinition, viewId, repository);
    }

    private async generateWidgets(
        mdsDefinition: MdsDefinition,
        views: MdsView[],
        nodes?: Node[],
        values?: Values,
    ): Promise<Widget[]> {
        const result: Widget[] = [];
        const availableWidgets = mdsDefinition.widgets
            .filter((widget) => views.some((view) => view.html.indexOf(widget.id) !== -1))
            .filter((widget) => this.meetsCondition(widget, nodes, values, false));
        // add all native widgets so they get parsed properly if they have inline attributes
        for(const key of Object.keys(NativeWidgetType)) {
            if(!availableWidgets.find(w => w.id === (NativeWidgetType as any)[key])) {
                availableWidgets.push({
                    id: (NativeWidgetType as any)[key],
                });
            }
        }
        const variables = await this.config.observeVariables().pipe(first()).toPromise();
        for (const view of views) {
            for (let widgetDefinition of this.getWidgetsForView(availableWidgets, view)) {
                widgetDefinition = parseAttributes(view.html, widgetDefinition);
                const widget = new MdsEditorInstanceService.Widget(
                    this,
                    widgetDefinition,
                    view.id,
                    this.repository,
                    view.rel,
                    variables,
                );
                result.push(widget);
            }
        }
        this.registerPropertyConditionObervers(result);
        return result;
    }

    private registerPropertyConditionObervers(widgets: Widget[]): void {
        for (const widget of widgets) {
            const condition = widget.definition.condition;
            if (condition?.dynamic && condition.type === 'PROPERTY') {
                const dependedOnWidget = widgets.find((w) => w.definition.id === condition.value);
                if (dependedOnWidget) {
                    const isShown = dependedOnWidget.checkPropertyCondition(condition);
                    isShown.subscribe(widget.meetsDynamicCondition);
                } else {
                    console.warn(
                        `Widget has a property condition on ${condition.value} ` +
                            `but could find no matching widget.`,
                        widget,
                    );
                }
            }
        }
    }

    private getWidgetsForView(availableWidgets: MdsWidget[], view: MdsView): MdsWidget[] {
        return (
            availableWidgets
                .filter((widget) => new RegExp(`<${widget.id}[> ]`).test(view.html))
                .filter(
                    // We want either...
                    (widget) =>
                        // ...the overriding widget (naming this view's ID as `template`), or...
                        widget.template === view.id ||
                        // ...the default widget when there is no overriding widget.
                        (!widget.template &&
                            availableWidgets
                                .filter((w) => w.id === widget.id)
                                .every((w) => w.template !== view.id)),
                )
                // Sort widgets by order of appearance, so the list can be used to rotate through
                // widgets in a meaningful way.
                .sort((a, b) => view.html.indexOf(a.id) - view.html.indexOf(b.id))
        );
    }

    private meetsCondition(
        widget: MdsWidget,
        nodes?: Node[],
        values?: Values,
        obeyDynamic = false,
    ): boolean {
        if (!widget.condition) {
            return true;
        } else if (widget.condition.type === 'PROPERTY') {
            if (widget.condition.dynamic) {
                if (!obeyDynamic) {
                    return true;
                }
                const condition = widget.condition;
                const pattern = condition.pattern ? new RegExp(`^(?:${condition.pattern})$`) : null;
                return (
                    nodes ? nodes.some((n) => pattern.test(n.properties[condition.value])) !==
                    condition.negate :
                        values ? widget.condition.negate === !values[widget.condition.value]
                            : true
                );
            }
            if (nodes) {
                return nodes.every(
                    (node) => widget.condition.negate === !node.properties[widget.condition.value],
                );
            } else if (values) {
                return widget.condition.negate === !values[widget.condition.value];
            } else {
                return true;
            }
        } else if (widget.condition.type === 'TOOLPERMISSION') {
            const result =
                widget.condition.negate ===
                !this.restConnector.hasToolPermissionInstant(widget.condition.value);
            if (!result) {
                // tslint:disable-next-line:no-console
                console.debug(
                    'hide widget ' +
                        widget.id +
                        ' because toolpermission ' +
                        widget.condition.value +
                        ' condition not matched',
                );
            }
            return result;
        }
        throw new Error(`Unsupported condition type: ${widget.condition.type}`);
    }

    private async getNodeValuePairs(): Promise<{ node: Node; values: Values }[]> {
        return Promise.all(
            this.nodes$.value.map(async (node) => ({
                node,
                values: await this.getValues(node),
            })),
        );
    }

    private getNewPropertyValue(widget: Widget, oldPropertyValue?: string[]): string[] {
        if (
            this.editorMode === 'nodes' &&
            !widget.getHasChanged() &&
            !widget.getHasUnsavedDefault()
        ) {
            return null;
        } else if (!widget.meetsDynamicCondition.value) {
            return null;
        } else if (!this.editorBulkMode.isBulk) {
            return widget.getValue();
        } else {
            switch (widget.getBulkMode()) {
                case 'no-change':
                    return null;
                case 'replace':
                    return removeDuplicates([
                        ...(oldPropertyValue ?? []).filter((value) =>
                            widget.getIndeterminateValues()?.includes(value),
                        ),
                        ...widget
                            .getValue()
                            .filter((value) => !widget.getIndeterminateValues()?.includes(value)),
                    ]);
            }
        }
    }

    private calculateCompletionStatus(widgets: Widget[]): CompletionStatus {
        return Object.values(RequiredMode)
            .filter((requiredMode) => requiredMode !== RequiredMode.Ignore)
            .reduce((acc, requiredMode) => {
                acc[requiredMode] = this.getCompletionStatusEntry(widgets, requiredMode);
                return acc;
            }, {} as CompletionStatus);
    }

    private getCompletionStatusEntry(
        widgets: Widget[],
        requiredMode: RequiredMode,
    ): CompletionStatusEntry {
        const total = widgets.filter(
            (widget) =>
                widget.definition.isRequired === requiredMode &&
                this.meetsCondition(widget.definition, this.nodes$.value, null, true),
        );
        const completed = total.filter((widget) => widget.getValue() && widget.getValue()[0]);
        const widgetCompletion: CompletionStatusField[] = total.map((widget) => {
            return {
                widget,
                isCompleted: !!widget.getValue()?.[0],
            };
        });
        return {
            total: total.length,
            completed: completed.length,
            fields: widgetCompletion,
        };
    }

    /**
     * update currently used nodes with new data
     * (e.g when some metadata has changed outside of the current context)
     */
    updateNodes(nodes: Node[]) {
        this.nodes$.next(
            this.nodes$.value.map((n1) => {
                return (
                    nodes.find((n2) => n1.ref.id === n2.ref.id && n1.ref.repo === n2.ref.repo) || n1
                );
            }),
        );
        // update current values to propagate to @MdsWidgetComponent
        if (this.nodes$.value.length === 1) {
            this.values$.next(this.nodes$.value[0].properties);
        }
    }

    resetWidgets() {
        this.nativeWidgets.next([]);
    }

    /**
     * Returns a list of properties for which the MDS editor requires facet values.
     *
     * The observable continues to emit updates as long as the mds editor is alive.
     */
    getNeededFacets(): Observable<string[]> {
        return this.mdsInitDone.pipe(map(() => this.getNeededFacetsInstant()));
    }

    // TODO: The facet subscriptions could be registered by the widgets themselves, but since the
    // widget components might not be initialized in time, we would need a layer of widget-specific
    // services that handle these things.
    private getNeededFacetsInstant(): string[] {
        const facets = this.widgets.value
            .filter((widget) => this.needsFacets(widget))
            .map((widget) => widget.definition.id);
        return removeDuplicates(facets);
    }

    /** Wether the given widget needs facet values for its property to be passed to `mds-editor`. */
    private needsFacets(widget: Widget): boolean {
        return (
            widget.relation === 'suggestions' ||
            [
                'facetList',
                // Add any widget types that need facet values to this list.
            ].includes(widget.definition.type)
        );
    }

    /**
     * Set all widget values from outside.
     *
     * Methods and functions with the `_new_` prefix are introducing a new system of tracking
     * values, which is currently **not** broadly **supported**.
     */
    _new_setValues(values: Values): void {
        this._new_inputValuesSubject.next(values);
        // for (const widget of this.widgets.value) {
        //     console.log('widget', widget, values?.[widget.definition.id]);
        //     widget.setValue(values?.[widget.definition.id] ?? null);
        // }
    }

    private register_new_inputValuesSubject(): void {
        this._new_inputValuesSubject.subscribe((values) => this._new_valuesSubject.next(values));
    }

    private register_new_valuesChange(): void {
        this._new_initializingStateSubject
            .pipe(
                // Don't emit values while initializing. Wait for all widgets to propagate any
                // default values and value changes due to constraints and then emit a single time.
                switchMap((state) => (state === 'complete' ? this._new_valuesSubject : EMPTY)),
                // Skip the initial `null` value.
                filter((values) => values !== null),
                // Don't emit values set from outside.
                filter((values) => values !== this._new_inputValuesSubject.value),
            )
            .subscribe((values) => this._new_valuesChange.emit(values));
    }

    private _new_patchValues(values: Values): void {
        this._new_valuesSubject.next({
            ...(this._new_valuesSubject.value ?? {}),
            ...values,
        });
    }
    focusWidget(id: string): void {
        this.widgets.value.filter(w => w.definition.id === id)?.[0]?.focusTrigger?.next();
    }
    focusFirstWidget(): void {
        for (const widget of this.widgets.value) {
            if (widget.focusTrigger.observers.length > 0) {
                widget.focusTrigger.next();
                break;
            }
        }
    }

    async saveWidgetValue(widget: Widget) {
        const nodes = this.nodes$.value;
        if(nodes?.length !== 1) {
            throw new Error('saveWidgetValue can not be called without exactly one node present!');
        }
        await this.mdsEditorCommonService.saveNodeProperty(
            nodes[0],
            widget.definition.id,
            widget.getValue()
        );
        if(widget.getValue()?.length) {
            nodes[0].properties[widget.definition.id] = widget.getValue();
        } else {
            delete nodes[0].properties[widget.definition.id];
        }
        this.nodes$.next(nodes);
    }
}

function arraysAreEqual<T>(arrays: T[][]) {
    if (arrays.length === 0) {
        return true;
    } else {
        return arrays.slice(1).every((array) => arrayIsEqual(arrays[0], array));
    }
}

function arrayIsEqual<T>(lhs: readonly T[], rhs: readonly T[]): boolean {
    if (!lhs && !rhs) {
        return true;
    } else if (!lhs || !rhs) {
        return false;
    } else if (lhs.length !== rhs.length) {
        return false;
    } else {
        return lhs.every((value, index) => rhs[index] === value);
    }
}

function removeDuplicates<T>(array: T[]): T[] {
    return array.filter((value, index) => array.indexOf(value) === index);
}
