import {AfterViewInit, Component, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute, Params, Router, RoutesRecognized} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {Translation} from '../../core-ui-module/translation';
import * as EduData from '../../core-module/core.module'; //
import {
    ConfigurationService,
    Connector,
    ConnectorList,
    Filetype,
    FrameEventsService,
    Node,
    NodeWrapper,
    RequestObject,
    RestCollectionService,
    RestConnectorService,
    RestConnectorsService,
    RestConstants,
    RestHelper,
    RestIamService,
    RestNodeService,
    RestSearchService,
    SessionStorageService,
    STREAM_STATUS,
    TemporaryStorageService
} from '../../core-module/core.module'; //
import {Toast} from '../../core-ui-module/toast'; //
import {
    CustomOptions,
    DefaultGroups,
    OptionItem,
    Scope,
    Target
} from '../../core-ui-module/option-item';
import {UIHelper} from '../../core-ui-module/ui-helper';
import {UIConstants} from '../../core-module/ui/ui-constants';
import {Observable, Subscription} from 'rxjs';
import {UIAnimation} from '../../core-module/ui/ui-animation';
import {trigger} from '@angular/animations';
import {CordovaService} from '../../common/services/cordova.service';
import * as moment from 'moment';
import {ActionbarHelperService} from '../../common/services/actionbar-helper';
import {MainNavComponent} from '../../common/ui/main-nav/main-nav.component';
import {BridgeService} from '../../core-bridge-module/bridge.service';
import {GlobalContainerComponent} from '../../common/ui/global-container/global-container.component';
import {NodeHelperService} from '../../core-ui-module/node-helper.service';
import {filter, pairwise} from 'rxjs/operators';
import {OptionsHelperService} from '../../core-ui-module/options-helper.service';
import {ActionbarComponent} from '../../common/ui/actionbar/actionbar.component';
import {
    ListEventInterface,
    ListOptions, ListOptionsConfig, NodeEntriesDisplayType
} from '../../core-ui-module/components/node-entries-wrapper/entries-model';
import {SelectionModel} from '@angular/cdk/collections';
import { StreamEntry } from 'projects/edu-sharing-api/src/lib/api/models';
import { StreamV1Service } from 'projects/edu-sharing-api/src/lib/api/services';


@Component({
    selector: 'app-stream',
    templateUrl: 'stream.component.html',
    styleUrls: ['stream.component.scss'],
    animations: [
        trigger('overlay', UIAnimation.openOverlay(UIAnimation.ANIMATION_TIME_FAST)),
    ],
    providers: [
        OptionsHelperService
    ]
})
export class StreamComponent implements AfterViewInit {
    @ViewChild('mainNav') mainNavRef: MainNavComponent;
    connectorList: ConnectorList;
    createConnectorName: string;
    createConnectorType: Connector;
    createAllowed: boolean ;
    showCreate = false;
    public collectionNodes: EduData.Node[];
    public tabSelected: string = RestConstants.COLLECTIONSCOPE_MY;
    public mainnav = true;
    public nodeReport: Node;
    public globalProgress = false;
    showMenuOptions = false;
    streams: StreamEntry[];
    streamsRelevant: Node[];
    customOptions: CustomOptions = {
        useDefaultOptions: true,
        supportedOptions: [
            'OPTIONS.COLLECTION',
            'OPTIONS.ADD_NODE_STORE'
        ],
        addOptions: []
    };
    pageOffset: number;
    imagesToLoad = -1;
    shouldOpen = false;
    routerSubscription: Subscription;
    dateToDisplay: string;
    amountToRandomize: number;

    markOption = new OptionItem('STREAM.OBJECT.OPTION.MARK', 'toc', (node: any) => {
        this.updateStatus(this.currentStreamObject.id, STREAM_STATUS.PROGRESS).subscribe( () => {
            // this.updateDataFromJSON(STREAM_STATUS.OPEN);
            this.streams = this.streams.filter((n) => n.id !== node.id);
            this.toast.toast('STREAM.TOAST.MARKED');
        }, error => console.log(error));
    });

    removeOption = new OptionItem('STREAM.OBJECT.OPTION.REMOVE', 'delete', (node: any) => {
        this.updateStatus(this.currentStreamObject.id, STREAM_STATUS.DONE).subscribe( () => {
            this.streams = this.streams.filter((n) => n.id !== node.id);
            this.toast.toast('STREAM.TOAST.REMOVED');
        });
    });

    // TODO: Store and use current search query
    searchQuery: string;
    isLoading = true;
    mode = 'new';
    options: OptionItem[];
    private currentStreamObject: StreamEntry;
    doSearch({query}: { query: string; cleared: boolean; }) {
        this.searchQuery = query;
        // TODO: Search for the given query doch nicht erledigt
    }
    constructor(
        private router: Router,
        private route: ActivatedRoute,
        private connector: RestConnectorService,
        private connectors: RestConnectorsService,
        private nodeService: RestNodeService,
        private cordova: CordovaService,
        private searchService: RestSearchService,
        private event: FrameEventsService,
        private streamService: StreamV1Service,
        private optionsHelper: OptionsHelperService,
        private iam: RestIamService,
        private storage: TemporaryStorageService,
        private session: SessionStorageService,
        private toast: Toast,
        private bridge: BridgeService,
        private nodeHelper: NodeHelperService,
        private actionbarHelperService: ActionbarHelperService,
        private collectionService: RestCollectionService,
        private config: ConfigurationService,
        private translate: TranslateService) {
        Translation.initialize(translate, this.config, this.session, this.route).subscribe(() => {
            this.connector.isLoggedIn().subscribe(data => {
                this.dateToDisplay = moment().locale(translate.currentLang).format('dddd, DD. MMMM YYYY');
                this.createAllowed = data.statusCode == RestConstants.STATUS_CODE_OK;
                GlobalContainerComponent.finishPreloading();
            });
            this.connectors.list().subscribe(list => {
                this.connectorList = list;
            });
        });
        this.amountToRandomize = 4;
        this.setStreamMode();
        this.routerSubscription = this.router.events.pipe(
            filter(e => e instanceof RoutesRecognized),
            pairwise(),
        )
            .subscribe((e: any[]) => {
                document.cookie = 'scroll=' + 'noScroll';
                if (/components\/render/.test(e[0].urlAfterRedirects)) {
                    this.route.queryParams.subscribe((params: Params) => {
                        if (params.mode === 'seen') {
                            document.cookie = 'scroll=' + 'seen';
                        }
                        if (params.mode === 'new') {
                            if (e[1].urlAfterRedirects === '/components/stream?mode=new') {
                                document.cookie = 'scroll=' + 'new';
                                this.toast.toast('STREAM.TOAST.SEEN');
                            }
                        }
                    });
                    this.routerSubscription.unsubscribe();
                }
            });
    }

    async ngAfterViewInit() {
        await this.optionsHelper.initComponents(this.mainNavRef);
    }

    setStreamMode() {
        this.route.queryParams.subscribe((params: Params) => {
            if (params.mode === 'new' || params.mode === 'seen' || params.mode === 'relevant' || params.mode === 'marked') {
                this.mode = params.mode;
                this.init();
            }
            else {
                this.goToOption('new');
            }
        });
    }

    seen(id: any) {
        this.updateStatus(id, STREAM_STATUS.READ).subscribe(data => this.getStreamDataByStatus(STREAM_STATUS.OPEN) , error => console.log(error));
    }
    init() {
        this.streams = [];
        if (this.mode === 'new') {
            this.getStreamDataByStatus(STREAM_STATUS.OPEN);
        } else if (this.mode === 'marked') {
            this.getStreamDataByStatus(STREAM_STATUS.PROGRESS);
        } else if (this.mode == 'relevant') {
            this.searchRelevant();
        } else {
            this.getStreamDataByStatus(STREAM_STATUS.READ);
        }
    }
    onScroll() {
        // this.updateDataFromJSON(STREAM_STATUS.OPEN);
        const curStat = this.mode === 'new' ? STREAM_STATUS.OPEN : this.mode == 'marked' ? STREAM_STATUS.PROGRESS : STREAM_STATUS.READ;
        const sortWay = this.mode === 'new' ? false : false;
        this.getStreamData(curStat, sortWay).subscribe((data) => {
            this.streams = this.streams.concat(data.stream);
            this.updateMenu();
        }, error => console.log(error));
    }

    toggleMenuOptions() {
        this.showMenuOptions = !this.showMenuOptions;
        if (this.showMenuOptions) {
            this.shouldOpen = true;
        }
    }

    closeMenuOptions() {
        this.showMenuOptions = false;
        if (this.shouldOpen) {
            this.showMenuOptions = true;
            this.shouldOpen = false;
        }
    }

    scrollToDown() {
        const pos = Number(this.getCookie('jumpToScrollPosition'));
        const whichScroll = this.getCookie('scroll');
        if (whichScroll !== 'noScroll') {
            setTimeout(function() {
                window.scrollTo(0, pos);
            }, 2900);
        }
        document.cookie = 'scroll=' + 'noScroll';
    }

    getCookie(cname: any) {
        const name = cname + '=';
        const decodedCookie = decodeURIComponent(document.cookie);
        const ca = decodedCookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) == ' ') {
                c = c.substring(1);
            }
            if (c.indexOf(name) == 0) {
                return c.substring(name.length, c.length);
            }
        }
        return '';
    }

    updateMenu() {
        this.imagesToLoad = -1;
        this.customOptions.addOptions = [];
        if (this.mode === 'new') {
            this.customOptions.addOptions.push(this.markOption);
            this.customOptions.addOptions.push(this.removeOption);
        } else if (this.mode === 'marked') {
            this.customOptions.addOptions.push(this.removeOption);
        } else if (this.mode == 'relevant') {
            this.searchRelevant();
        } else {
            this.customOptions.addOptions.push(this.removeOption);
        }
        this.customOptions.addOptions = this.customOptions.addOptions.map((o) => {
            o.group = DefaultGroups.Primary;
            return o;
        });
        this.updateOptions(this.streams?.[0]);

    }

    goToOption(option: string) {
        this.router.navigate(['./'], {queryParams: {mode: option}, relativeTo: this.route});
    }

    getStreamDataByStatus(streamStatus: any) {
        /*if (streamStatus == STREAM_STATUS.OPEN) {
          let openStreams: any[];
          let progressStreams: any[];
          let unSortedStream: any[];
          this.getSimpleJSON(STREAM_STATUS.OPEN, false).subscribe(data => {
            openStreams = data['stream'].filter( (n : any) => n.nodes.length !== 0);
            this.getSimpleJSON(STREAM_STATUS.PROGRESS, false).subscribe(data => {
              progressStreams = data['stream'].filter( (n : any) => n.nodes.length !== 0);
              unSortedStream = progressStreams.concat(openStreams);
              //unSortedStream.length >= this.amountToRandomize ? this.randomizeTop(unSortedStream,this.amountToRandomize) : console.log('not big enough to randomize');
              this.streams = unSortedStream;
              this.imagesToLoad = this.streams.length;
              this.scrollToDown();
            });
          }, error => console.log(error));
        }
        else {*/
        this.streams = [];
        this.isLoading = true;
        this.getStreamData(streamStatus).subscribe(data => {
            this.streams = data.stream.filter( (n) => n.nodes.length !== 0);
            this.imagesToLoad = this.streams.length;
            this.isLoading = false;
            this.updateMenu();
            this.scrollToDown();
        }, error => console.log(error));
        // }

    }

    randomizeTop(array: any, quantity: number) {
        quantity = (quantity > 0) ? quantity - 1 : 0;
        for (let i = quantity; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    onStreamObjectClick(node: any) {
        if (node.nodes) {
            this.seen(node.id);
            document.cookie = 'jumpToScrollPosition=' + window.pageYOffset;
            this.router.navigate([UIConstants.ROUTER_PREFIX + 'render', node.nodes[0].ref.id]);
        }
        else {
            this.router.navigate([UIConstants.ROUTER_PREFIX + 'render', node.ref.id]);
        }

    }

    private addToCollection(nodes: any) {
        /*
        let result = this.streams.filter( (n: any) => (n.id == node) ).map( (n: any) => { return n.nodes } );
        this.collectionNodes = [].concat.apply([], result);
        */
        this.collectionNodes = nodes.nodes;

    }
    private addToStore(nodes: any) {
        this.globalProgress = true;
        RestHelper.addToStore(nodes.nodes, this.bridge, this.iam, () => {
            this.globalProgress = false;
            this.mainNavRef.refreshNodeStore();
        });
    }
    public getStreamData(streamStatus: string, sortAscendingCreated: boolean = false) {
        return this.streamService.search1({
            repository: RestConstants.HOME_REPOSITORY,
            status: streamStatus,
            query: this.searchQuery,
            skipCount: this.streams?.length,
            maxItems: RestConnectorService.DEFAULT_NUMBER_PER_REQUEST,
            sortProperties: ['priority', 'created'],
            sortAscending: [false, sortAscendingCreated]
        });
    }

    public updateStatus(idToUpdate: string, status: any): Observable<any> {
        return this.streamService.updateEntry({
            entry: idToUpdate,
            authority: this.connector.getCurrentLogin().authorityName,
            status,
            repository: RestConstants.HOME_REPOSITORY,
        });
    }
    create() {
        if (!this.createAllowed) {
            return;
        }
        this.showCreate = true;
    }
    createConnector(event: any) {
        this.createConnectorName = null;
        const prop = this.nodeHelper.propertiesFromConnector(event);
        let win: any;
        if (!this.cordova.isRunningCordova()) {
            win = window.open('');
        }
        this.nodeService.createNode(RestConstants.INBOX, RestConstants.CCM_TYPE_IO, [], prop, false).subscribe(
            (data: NodeWrapper) => {
                this.editConnector(data.node, event.type, win, this.createConnectorType);
                UIHelper.goToWorkspaceFolder(this.nodeService, this.router, null, RestConstants.INBOX);
            },
            (error: any) => {
                win.close();
                if (this.nodeHelper.handleNodeError(event.name, error) == RestConstants.DUPLICATE_NODE_RESPONSE) {
                    this.createConnectorName = event.name;
                }
            }
        );

    }
    private editConnector(node: Node, type: Filetype= null, win: any = null, connectorType: Connector = null) {
        UIHelper.openConnector(this.connectors, this.iam, this.event, this.toast, node, type, win, connectorType);
    }

    private searchRelevant() {
        const request: RequestObject = {
            propertyFilter: [RestConstants.ALL]
        };
        this.isLoading = true;
        this.searchService.getRelevant(request).subscribe((relevant) => {
            this.streamsRelevant = relevant.nodes;
            this.imagesToLoad = this.streams.length;
            this.isLoading = false;
        });
    }
    public getTitle(node: Node) {
        return RestHelper.getTitle(node);
    }
    getPreview(node: any) {
        return node.preview.url + '&crop=true&maxWidth=500&maxHeight=500';
    }

    updateOptions(strm: StreamEntry) {
        this.optionsHelper.setData({
            scope: Scope.Stream,
            customOptions: this.customOptions,
            activeObjects: strm?.nodes,
            selectedObjects: strm?.nodes
        });
        this.optionsHelper.refreshComponents();
        this.currentStreamObject = strm;
        this.options = this.optionsHelper.getAvailableOptions(Target.ListDropdown, (strm?.nodes as unknown as Node[]));
    }

    getStreamTitle(strm: StreamEntry) {
        return (strm.properties['add_to_stream_title'] as string[])?.[0];
    }
}
