import {
    Component,
    ContentChild,
    ElementRef,
    EventEmitter,
    OnDestroy,
    TemplateRef,
    ViewChild
} from '@angular/core';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {TranslationsService} from '../../translations/translations.service';
import * as EduData from '../../core-module/core.module';
import {
    ConfigurationService,
    DialogButton,
    FrameEventsService,
    LoginResult,
    Mediacenter,
    Node,
    NodeRef,
    RestCollectionService,
    RestConnectorService,
    RestConstants,
    RestHelper,
    RestIamService,
    RestMdsService,
    RestMediacenterService,
    RestNetworkService,
    RestNodeService,
    RestOrganizationService,
    TemporaryStorageService,
    UIService
} from '../../core-module/core.module';
import {Toast} from '../../core-ui-module/toast';
import {Scope} from '../../core-ui-module/option-item';
import {UIHelper} from '../../core-ui-module/ui-helper';
import {UIConstants} from '../../core-module/ui/ui-constants';
import {ListTableComponent} from '../../core-ui-module/components/list-table/list-table.component';
import {NodeHelperService} from '../../core-ui-module/node-helper.service';
import {TranslateService} from '@ngx-translate/core';
import {Location} from '@angular/common';
import {Helper} from '../../core-module/rest/helper';
import {ColorHelper, PreferredColor} from '../../core-module/ui/color-helper';
import {ActionbarHelperService} from '../../common/services/actionbar-helper';
import {BridgeService} from '../../core-bridge-module/bridge.service';
import {HttpClient} from '@angular/common/http';
import {
    OPTIONS_HELPER_CONFIG,
    OptionsHelperService
} from '../../core-ui-module/options-helper.service';
import {SortEvent,} from '../../shared/components/sort-dropdown/sort-dropdown.component';
import {MainNavService} from '../../main/navigation/main-nav.service';
import {NodeEntriesDisplayType} from 'src/app/features/node-entries/entries-model';
import {CollectionInfoBarComponent} from "./collection-info-bar/collection-info-bar.component";
import {CollectionContentComponent} from "./collection-content/collection-content.component";

// component class
@Component({
    selector: 'es-collections',
    templateUrl: 'collections.component.html',
    styleUrls: ['collections.component.scss'],
    // provide a new instance so to not get conflicts with other service instances
    providers: [OptionsHelperService, {provide: OPTIONS_HELPER_CONFIG, useValue: {
            subscribeEvents: false
        }}]})
export class CollectionsMainComponent implements OnDestroy {
    static INDEX_MAPPING = [
        RestConstants.COLLECTIONSCOPE_MY,
        RestConstants.COLLECTIONSCOPE_ORGA,
        RestConstants.COLLECTIONSCOPE_TYPE_EDITORIAL,
        RestConstants.COLLECTIONSCOPE_TYPE_MEDIA_CENTER,
        RestConstants.COLLECTIONSCOPE_ALL,
    ];
    readonly SCOPES = Scope;
    readonly NodeEntriesDisplayType = NodeEntriesDisplayType;
    readonly ROUTER_PREFIX = UIConstants.ROUTER_PREFIX;

    @ViewChild('infobar') infobar: CollectionInfoBarComponent;
    @ViewChild('collectionContentComponent') collectionContentRef: CollectionContentComponent;
    @ContentChild('collectionContentTemplate') collectionContentTemplateRef: TemplateRef<any>;


    viewTypeNodes: 0 | 1 | 2 = ListTableComponent.VIEW_TYPE_GRID;

    dialogTitle: string;
    dialogCancelable = false;
    dialogMessage: string;
    dialogButtons: DialogButton[];
    tabSelected: string = RestConstants.COLLECTIONSCOPE_MY;
    isLoading = true;
    isReady = false;
    collection: Node;
    collectionSortEmitter = new EventEmitter<SortEvent>();
    collectionCustomSortEmitter = new EventEmitter<boolean>();
    referenceSortEmitter = new EventEmitter<SortEvent>();
    referenceCustomSortEmitter = new EventEmitter<boolean>();
    mainnav = true;
    isGuest = true;
    addToOther: EduData.Node[];
    addPinning: string;
    infoTitle: string;
    infoMessage: string;
    infoButtons: DialogButton[];
    infoClose: Function;

    tutorialElement: ElementRef;

    // FIXME: `collectionShare` is expected to be of type `Node[]` by `workspace-management` but is
    // of type `Node` here.
    private adminMediacenters: Mediacenter[];
    isRootLevel: boolean;
    set collectionShare(collectionShare: Node[]) {
        this._collectionShare = collectionShare as any as Node;
        this.refreshAll();
    }
    get collectionShare() {
        return this._collectionShare as any as Node[];
    }
    set tabSelectedIndex(pos: number) {
        if (this.isGuest) {
            pos += 2; // skip first 2 tabs
        }
        if (!this.hasEditorial && pos > 1) {
            pos++; // skip editorial
        }
        if (!this.hasMediacenter && pos > 2) {
            pos++; // skip mediacenter
        }
        this.selectTab(CollectionsMainComponent.INDEX_MAPPING[pos]);
    }
    get tabSelectedIndex() {
        let pos = CollectionsMainComponent.INDEX_MAPPING.indexOf(
            this.tabSelected,
        );
        if (this.isGuest) {
            pos -= 2;
        }
        if (!this.hasEditorial && pos > 1) {
            pos--;
        }
        if (!this.hasMediacenter && pos > 2) {
            pos--;
        }
        return pos;
    }
    private contentDetailObject: any = null;
    // real parentCollectionId is only available, if user was browsing
    private parentCollectionId: EduData.Reference = new EduData.Reference(
        RestConstants.HOME_REPOSITORY,
        RestConstants.ROOT,
    );
    private person: EduData.User;
    path: EduData.Node[];
    hasEditorial = false;
    hasMediacenter = false;
    reurl: any;
    private _collectionShare: Node;
    private params: Params;

    // inject services
    constructor(
        private frame: FrameEventsService,
        private http: HttpClient,
        private temporaryStorageService: TemporaryStorageService,
        private location: Location,
        private collectionService: RestCollectionService,
        private nodeHelper: NodeHelperService,
        private mediacenterService: RestMediacenterService,
        private nodeService: RestNodeService,
        private mainNavService: MainNavService,
        private networkService: RestNetworkService,
        private organizationService: RestOrganizationService,
        private iamService: RestIamService,
        private mdsService: RestMdsService,
        private actionbar: ActionbarHelperService,
        private connector: RestConnectorService,
        private route: ActivatedRoute,
        private uiService: UIService,
        private router: Router,
        private tempStorage: TemporaryStorageService,
        private optionsService: OptionsHelperService,
        private toast: Toast,
        private bridge: BridgeService,
        private config: ConfigurationService,
        private translationService: TranslateService,
        private translations: TranslationsService,
    ) {
        this.translations.waitForInit().subscribe(() => {
            this.connector.isLoggedIn().subscribe(
                (data: LoginResult) => {
                    if (data.isValidLogin && data.currentScope == null) {
                        this.isGuest = data.isGuest;
                        this.mediacenterService.getMediacenters().subscribe((mediacenters) => {
                            this.adminMediacenters = mediacenters.filter((m)=>m.administrationAccess);
                        });
                        this.collectionService
                            .getCollectionSubcollections(
                                RestConstants.ROOT,
                                RestConstants.COLLECTIONSCOPE_TYPE_EDITORIAL,
                            )
                            .subscribe(data => {
                                this.hasEditorial = data.collections.length > 0;
                            });
                        this.collectionService
                            .getCollectionSubcollections(
                                RestConstants.ROOT,
                                RestConstants.COLLECTIONSCOPE_TYPE_MEDIA_CENTER,
                            )
                            .subscribe(data => {
                                this.hasMediacenter =
                                    data.collections.length > 0;
                            });
                        this.initialize();
                    } else {
                        RestHelper.goToLogin(this.router, this.config);
                    }
                },
                () => RestHelper.goToLogin(this.router, this.config),
            );
        });

    }
    ngOnDestroy() {
        this.temporaryStorageService.set(TemporaryStorageService.NODE_RENDER_PARAMETER_DATA_SOURCE, this.collectionContentRef.dataSourceReferences);
    }

    isMobile() {
        return this.uiService.isMobile();
    }

    isMobileWidth() {
        return window.innerWidth < UIConstants.MOBILE_WIDTH;
    }

    navigate(id = '', addToOther = '', feedback = false) {
        UIHelper.getCommonParameters(this.route).subscribe(params => {
            params.scope = this.tabSelected;
            params.id = id;
            if (feedback) {
                params.feedback = feedback;
            }
            if (addToOther) {
                params.addToOther = addToOther;
            }
            this.router.navigate([UIConstants.ROUTER_PREFIX + 'collections'], {
                queryParams: params,
            });
        });
    }

    closeAddToOther() {
        this.navigate(this.collection.ref.id);
    }

    selectTab(tab: string) {
        if (
            this.tabSelected !== tab ||
            this.getCollectionId() !== RestConstants.ROOT
        ) {
            this.tabSelected = tab;
            this.parentCollectionId = new EduData.Reference(
                RestConstants.HOME_REPOSITORY,
                RestConstants.ROOT,
            );
            this.contentDetailObject = null;
            this.navigate();
        }
    }

    isRootLevelCollection(): boolean {
        return this.isRootLevel;
    }

    isAllowedToEditCollection(): boolean {
        if (this.isRootLevelCollection()) {
            return !this.isGuest; //this.tabSelected === RestConstants.COLLECTIONSCOPE_MY
        }
        return RestHelper.hasAccessPermission(
            this.collection,
            RestConstants.PERMISSION_WRITE,
        );

    }
    feedbackAllowed(): boolean {
        return (
            !this.isGuest &&
            RestHelper.hasAccessPermission(
                this.collection,
                RestConstants.PERMISSION_FEEDBACK,
            )
        );
    }

    isUserAllowedToEdit(collection: Node): boolean {
        return RestHelper.isUserAllowedToEdit(collection, this.person);
    }

    pinCollection() {
        this.addPinning = this.collection.ref.id;
    }

    getPrivacyScope(collection: EduData.Collection): string {
        return collection.scope;
        //  return RestHelper.getPrivacyScope(collection);
    }

    navigateToSearch() {
        UIHelper.getCommonParameters(this.route).subscribe(params => {
            this.router.navigate([UIConstants.ROUTER_PREFIX + 'search'], {
                queryParams: params,
            });
        });
    }

    isBrightColor() {
        return (
            ColorHelper.getPreferredColor(this.collection?.collection?.color) === PreferredColor.White
        );
    }

    getScopeInfo() {
        return this.nodeHelper.getCollectionScopeInfo(this.collection);
    }

    collectionDelete(): void {
        this.dialogTitle = 'COLLECTIONS.CONFIRM_DELETE';
        this.dialogMessage = 'COLLECTIONS.CONFIRM_DELETE_INFO';
        this.dialogCancelable = true;
        this.dialogButtons = DialogButton.getYesNo(
            () => this.closeDialog(),
            () => {
                this.isLoading = true;
                this.closeDialog();
                this.collectionService
                    .deleteCollection(
                        this.collection.ref.id,
                        this.collection.ref.repo,
                    )
                    .subscribe(
                        () => {
                            this.isLoading = false;
                            this.navigate(this.parentCollectionId.id);
                        },
                        () => {
                            this.isLoading = false;
                            this.toast.error(null, 'COLLECTIONS.ERROR_DELETE');
                        },
                    );
            },
        );
    }

    collectionEdit(): void {
        if (this.isAllowedToEditCollection()) {
            this.router.navigate(
                [
                    UIConstants.ROUTER_PREFIX + 'collections/collection',
                    'edit',
                    this.collection.ref.id,
                ],
                { queryParams: { mainnav: this.mainnav } },
            );
            return;
        }
    }

    // gets called by user if something went wrong to start fresh from beginning
    resetCollections(): void {
        let url = window.location.href;
        url = url.substring(0, url.indexOf('collections') + 11);
        window.location.href = url;
        return;
    }


    getScope() {
        return this.tabSelected
            ? this.tabSelected
            : RestConstants.COLLECTIONSCOPE_ALL;
    }

    onCreateCollection() {
        UIHelper.getCommonParameters(this.route).subscribe(params => {
            this.router.navigate(
                [
                    UIConstants.ROUTER_PREFIX + 'collections/collection',
                    'new',
                    this.collection.ref.id,
                ],
                { queryParams: params },
            );
        });
    }

    onCollectionsClick(collection: Node): void {
        // remember actual collection as breadcrumb
        if (!this.isRootLevelCollection()) {
            this.parentCollectionId = this.collection.ref;
        }

        // set thru router so that browser back button can work
        this.navigate(collection.ref.id);
    }

    canDelete(node: EduData.CollectionReference) {
        return RestHelper.hasAccessPermission(node, 'Delete');
    }

    refreshAll() {
        this.displayCollectionById(this.collection.ref.id);
    }

    async displayCollectionById(id: string) {
        if (!!id) {
            this.collection = (await this.collectionService.getCollection(id).toPromise()).collection;
        } else {
            this.setCollectionId(RestConstants.ROOT);
        }
        this.isLoading = false;
        this.renderBreadcrumbs();
        this.isRootLevel = !id;
    }

    closeDialog() {
        this.dialogTitle = null;
    }

    showTabs() {
        return (
            this.isRootLevelCollection() && (!this.isGuest || this.hasEditorial)
        );
    }

    getCollectionViewType() {
        // on mobile, we will always show the small collection list
        if (
            UIHelper.evaluateMediaQuery(
                UIConstants.MEDIA_QUERY_MAX_WIDTH,
                UIConstants.MOBILE_WIDTH,
            )
        ) {
            return ListTableComponent.VIEW_TYPE_GRID_SMALL;
        }
        return this.isRootLevelCollection()
            ? ListTableComponent.VIEW_TYPE_GRID
            : ListTableComponent.VIEW_TYPE_GRID_SMALL;
    }

    hasNonIconPreview(): boolean {
        const preview = this.collection?.preview;
        return preview && !preview.isIcon;
    }

    private renderBreadcrumbs() {
        this.path = [];
        this.nodeService
            .getNodeParents(this.collection.ref.id, false)
            .subscribe((data: EduData.NodeList) => {
                this.path = data.nodes.reverse();
            });
    }

    private initialize() {

        // load user profile
        this.iamService.getCurrentUserAsync().then(
            iamUser => {
                // WIN

                this.person = iamUser.person;

                // set app to ready state
                this.isReady = true;
                // subscribe to parameters of url
                this.route.queryParams.subscribe(async params => {
                    const diffs = Helper.getDifferentKeys(this.params, params);
                    if (Object.keys(diffs).length === 1 && diffs.viewType) {
                        this.params = params;
                        this.viewTypeNodes = diffs.viewType;
                        return;
                    }
                    this.params = params;
                    if (params.scope) {
                        this.tabSelected = params.scope;
                    } else {
                        this.tabSelected = this.isGuest
                            ? RestConstants.COLLECTIONSCOPE_ALL
                            : RestConstants.COLLECTIONSCOPE_MY;
                    }
                    this.reurl = params.reurl;

                    if (params.mainnav) {
                        this.mainnav = params.mainnav !== 'false';
                    }

                    this.infoTitle = null;
                    // get id from route and validate input data
                    const id = params.id;
                    if (params.addToOther) {
                        this.nodeService
                            .getNodeMetadata(params.addToOther)
                            .subscribe((data: EduData.NodeWrapper) => {
                                this.addToOther = [data.node];
                            });
                    }
                    await this.displayCollectionById(id);

                    /*if (params.nodeId) {
                        let node = params.nodeId.split('/');
                        node = node[node.length - 1];
                        this.collectionService
                            .addNodeToCollection(id, node, null)
                            .subscribe(
                                () => this.navigate(id),
                                (error: any) => {
                                    this.handleError(error);
                                    this.navigate(id);
                                    //this.displayCollectionById(id)
                                },
                            );
                    } else {*/
                    // }
                });
            },
            error => {
                // FAIL
                this.toast.error(error);
                this.isReady = true;
            },
        );
    }

    private setCollectionId(id: string) {
        this.collection = new Node();
        this.collection.ref = {id} as NodeRef;
        this.collection.aspects = [
            RestConstants.CCM_ASPECT_COLLECTION,
        ];
    }

    private getCollectionId() {
        const c = this.collection;
        return c != null && c.ref != null ? c.ref.id : null;
    }
    test() {

    }

    createAllowed = () => {
        if (this.isGuest) {
            return false;
        }
        if (this.isRootLevelCollection()) {
            let allowed = this.connector.hasToolPermissionInstant(
                RestConstants.TOOLPERMISSION_CREATE_ELEMENTS_COLLECTIONS,
            );
            if (this.tabSelected === RestConstants.COLLECTIONSCOPE_MY) {
                return allowed;
            }
            // for anything else, the user must be able to invite everyone
            allowed =
                allowed &&
                this.connector.hasToolPermissionInstant(
                    RestConstants.TOOLPERMISSION_INVITE_ALLAUTHORITIES,
                );
            if (this.tabSelected === RestConstants.COLLECTIONSCOPE_ORGA) {
                allowed = false;
            } else if (this.tabSelected === RestConstants.COLLECTIONSCOPE_TYPE_EDITORIAL) {
                allowed = allowed && this.adminMediacenters?.length === 1;
            } else if (this.tabSelected === RestConstants.COLLECTIONSCOPE_TYPE_EDITORIAL) {
                allowed =
                    allowed &&
                    this.connector.hasToolPermissionInstant(
                        RestConstants.TOOLPERMISSION_COLLECTION_EDITORIAL,
                    );
            }
            return allowed;
        } else {
            return this.isAllowedToEditCollection();
        }
    };
}

export interface SortInfo {
    name: 'cm:name' | 'cm:modified' | 'ccm:collection_ordered_position';
    ascending: boolean;
    userModifyActive?: boolean;
}
