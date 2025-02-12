import { TranslationsService } from "../../translations/translations.service";
import {UIHelper} from "../../core-ui-module/ui-helper";
import {ActivatedRoute, Router} from "@angular/router";
import {Toast} from "../../core-ui-module/toast";
import {ListItem, RestConnectorService} from "../../core-module/core.module";
import {DomSanitizer, Title} from "@angular/platform-browser";
import {TranslateService} from "@ngx-translate/core";
import {Component, ViewChild, ElementRef, ApplicationRef} from "@angular/core";
import {
    LoginResult, ServerUpdate, CacheInfo, Application, Node, ParentList,
    Collection, NodeWrapper, ConnectorList, Connector
} from "../../core-module/core.module";
import {RestAdminService} from "../../core-module/core.module";
import {Helper} from "../../core-module/rest/helper";
import {RestConstants} from "../../core-module/core.module";
import {UIConstants} from "../../core-module/ui/ui-constants";
import {RestUtilitiesService} from "../../core-module/core.module";
import {RestNodeService} from "../../core-module/core.module";
import {RestCollectionService} from "../../core-module/core.module";
import {RestHelper} from "../../core-module/core.module";
import {CordovaService, OnBackBehaviour} from '../../common/services/cordova.service';
import {DateHelper} from "../../core-ui-module/DateHelper";
import {RestConnectorsService} from "../../core-module/core.module";
import {FrameEventsService} from "../../core-module/core.module";
@Component({
  selector: 'es-share-app',
  templateUrl: 'share-app.component.html',
  styleUrls: ['share-app.component.scss'],
  animations: [

  ]
})
export class ShareAppComponent {
    globalProgress=true;
    uri: string;
    private type="LINK";
    title:string;
    description:string;
    previewUrl:any;
    private inboxPath: Node[];
    inbox: Node;
    columns:ListItem[]=[];
    collections: Node[];
    private cordovaType: string;
    private mimetype: string;
    private editorType: string;
    private file: File;
    private fileName: string;
    private text: string;
    loading=true;
  constructor(private toast: Toast,
              private route: ActivatedRoute,
              private router: Router,
              private sanitizer: DomSanitizer,
              private node: RestNodeService,
              private connectors: RestConnectorsService,
              private events: FrameEventsService,
              private utilities: RestUtilitiesService,
              private translate: TranslateService,
              private translations: TranslationsService,
              private collectionApi: RestCollectionService,
              private cordova : CordovaService,
              private connector: RestConnectorService) {
      // when the user finished sharing and navigates back he must return to the origin app
      this.cordova.setOnBackBehaviour(OnBackBehaviour.closeApp);
      this.columns.push(new ListItem("COLLECTION", 'title'));
      this.columns.push(new ListItem("COLLECTION", 'info'));
      this.columns.push(new ListItem("COLLECTION", 'scope'));
      if (this.cordova.isRunningCordova()) {
          this.cordova.subscribeServiceReady().subscribe(() => {
              this.init();
          });
      }
      else{
          this.init();
      }

  }
    getType(){
      if(this.isLink())
          return "link";
      if(this.isTextSnippet())
          return "file-txt";
      if(this.mimetype=="application/pdf")
          return "file-pdf";
      if(this.mimetype) {
          let type = this.mimetype.split("/");
          if(this.translate.instant('MEDIATYPE.' + type) === 'MEDIATYPE.' + type) {
              type = null;
          }
          if(type != null) {
              return "file-" + type
          }
      }
      return "file";
    }
    saveInternal(callback:Function){
        this.globalProgress=true;
        if(this.isLink()){
            let prop:any={};
            prop[RestConstants.CCM_PROP_IO_WWWURL]=[this.getUri()];
            this.node.createNode(this.inbox.ref.id,RestConstants.CCM_TYPE_IO,[],prop,true,RestConstants.COMMENT_MAIN_FILE_UPLOAD).subscribe((data:NodeWrapper)=>{
                callback(data.node);
            });
        }
        else {
            let prop: any = RestHelper.createNameProperty(this.title);
            if(this.editorType){
                prop[RestConstants.CCM_PROP_EDITOR_TYPE]=[this.editorType];
            }
            if(this.text && !this.isTextSnippet()){
                prop[RestConstants.LOM_PROP_GENERAL_DESCRIPTION]=[this.text];
            }
            this.node.createNode(this.inbox.ref.id, RestConstants.CCM_TYPE_IO, [], prop, true).subscribe((data: NodeWrapper) => {
                this.node.uploadNodeContent(data.node.ref.id, this.file, RestConstants.COMMENT_MAIN_FILE_UPLOAD,this.mimetype).subscribe(() => {
                    callback(data.node);
                });
            });
        }
    }
    saveFile(){
        this.saveInternal((node:Node)=>{
            this.goToInbox();
            this.events.broadcastEvent(FrameEventsService.EVENT_SHARED,node);
        });
    }
    saveToCollection(collection:Node){
      this.saveInternal((node:Node)=>{
          this.collectionApi.addNodeToCollection(collection.ref.id,node.ref.id,node.ref.repo).subscribe(()=>{
              UIHelper.goToCollection(this.router,collection,null,{replaceUrl:true});
              this.events.broadcastEvent(FrameEventsService.EVENT_SHARED,node);
          });
      });
    }
    private isLink() {
        if(this.cordovaType=='public.url') // ios
            return true;
        if(this.hasData())
            return false;
        if(!this.uri)
            return false;
        if(this.uri.startsWith("content://") || this.uri.startsWith("file://"))
            return false;
        let pos=this.uri.indexOf("://");
        return pos>0 && pos<10;
    }
    private isTextSnippet() {
        if(this.cordovaType=='public.text') // ios
            return true;
        if(this.hasData())
            return false;
        if(this.isLink())
            return false;
        if(!this.uri)
            return false;
        return !this.uri.startsWith("content://") && !this.uri.startsWith("file://");
    }
    private goToInbox() {
        UIHelper.goToWorkspaceFolder(this.node,this.router,null,this.inbox.ref.id,{replaceUrl:true});
    }
    hasWritePermissions(node:any){
        if(node.access.indexOf(RestConstants.ACCESS_WRITE)==-1){
            return {status:false,message:'NO_WRITE_PERMISSIONS'};
        }
        return {status:true};
    }
    private init() {
        this.translations.waitForInit().subscribe(() => {
            this.route.queryParams.subscribe((params:any)=>{
                this.uri=params['uri'];
                this.mimetype=params['mimetype'];
                if(this.mimetype=='public.image') // ios
                    this.mimetype='image/jpeg';
                this.cordovaType=params['mimetype'];
                this.fileName=params['file'];
                this.text=params['text']; // ios only: custom description
                this.description=null;
                this.collectionApi.search("",{
                    sortBy:[RestConstants.CM_MODIFIED_DATE],
                    offset:0,
                    count:50,
                    sortAscending:false,
                }).subscribe((data)=>{
                    this.collections=data.collections;
                    this.loading=false;
                },(error)=>{
                    this.toast.error(error)
                    this.loading=false;
                });
                this.node.getNodeParents(RestConstants.INBOX, false).subscribe((data: ParentList) => {
                    this.inboxPath = data.nodes;
                    this.inbox=data.nodes[0];
                });
                this.previewUrl=this.connector.getThemeMimePreview(this.getType()+'.svg');
                if(this.isLink()) {
                    this.utilities.getWebsiteInformation(this.getUri()).subscribe((data: any) => {
                        if(data.title) {
                            this.title = data.title + " - " + data.page;
                        }
                        else{
                            this.title = this.getUri();
                        }
                        this.description = data.description;
                        this.globalProgress = false;
                    },(error)=>{
                        this.title = this.getUri();
                        this.globalProgress = false;
                    });
                }
                else if(this.isTextSnippet()){
                    this.globalProgress = false;
                    this.connectors.list().subscribe((list:ConnectorList)=>{
                        this.prepareTextSnippet(list.connectors);
                    },(error:any)=>{
                        this.prepareTextSnippet(null);
                    })
                }
                else{
                    if(this.cordova.isRunningCordova() && this.cordova.getLastIntent() && this.cordova.getLastIntent().stream){
                        let base64=this.cordova.getLastIntent().stream;
                        if(this.mimetype.startsWith("image/")) {
                            this.previewUrl = this.sanitizer.bypassSecurityTrustResourceUrl("data:" + this.mimetype + ";base64," + base64);
                        }
                        this.file = Helper.base64toBlob(base64,this.mimetype) as any;
                        this.cordova.getFileAsBlob(this.getUri(),this.mimetype).subscribe((data:any)=> {
                            this.globalProgress=false;
                            this.updateTitle();
                        },(error:any)=>{
                            console.warn(error);
                            this.globalProgress=false;
                            this.updateTitle();
                        });
                    }
                    else{
                        this.router.navigate([UIConstants.ROUTER_PREFIX,'messages','SHARING_ERROR']);
                    }
                    /*
                    this.cordova.getFileAsBlob(this.getUri(),this.mimetype).subscribe((data:any)=>{
                        let split=this.fileName ? this.fileName.split("/") : this.getUri().split("/");
                        this.title=split[split.length-1];
                        this.file=data;
                        if(this.mimetype.startsWith("image/"))
                            this.previewUrl=this.sanitizer.bypassSecurityTrustUrl(data.localURL);
                        let request = new XMLHttpRequest();
                        let result=request.open('GET', data.localURL, true);
                        request.responseType = 'blob';
                        request.onload = ()=> {
                            if(request.response.size<=0){
                                this.router.navigate([UIConstants.ROUTER_PREFIX,'messages','CONTENT_NOT_READABLE']);
                            }
                            this.file=request.response;
                            (this.file as any).name=this.title;
                        };
                        request.onerror=(e)=>{
                            this.router.navigate([UIConstants.ROUTER_PREFIX,'messages','CONTENT_NOT_READABLE']);
                        }
                        request.send();
                    },(error:any)=>{
                        this.router.navigate([UIConstants.ROUTER_PREFIX,'messages','CONTENT_NOT_READABLE']);
                    });*/
                }
            })
        });
    }

    private updateTitle() {
        let split = this.fileName ? this.fileName.split("/") : this.uri.split("/");
        this.title = decodeURIComponent(split[split.length - 1]);
    }

    private hasData() {
        return this.cordova.isRunningCordova() && this.cordova.getLastIntent() && this.cordova.getLastIntent().stream!=null;
    }

    private prepareTextSnippet(connectors : Connector[]) {
        this.mimetype='text/plain';
        let filetype='txt';
        if(connectors && connectors.length){
            let i=Helper.indexOfObjectArray(connectors,"id","TINYMCE");
            if(i!=-1){
                let connector=connectors[i];
                this.mimetype=connector.filetypes[0].mimetype;
                filetype=connector.filetypes[0].filetype;
                this.editorType=connector.filetypes[0].editorType;
            }
        }
        this.title = this.translate.instant('SHARE_APP.TEXT_SNIPPET')+" "+
            DateHelper.getDateForNewFile()+"."+filetype;
        let content=this.getTextContent();
        if(this.mimetype=='text/html'){
            content=content.replace(/\n/g,"<br />");
        }
        this.file = (new Blob([content], {
            type: this.mimetype
        }) as any);
    }

    getTextContent(): string {
        return this.cordova.isAndroid() ? this.uri : this.text;
    }

    private getUri() {
        return this.cordova.isAndroid() ? this.uri : this.cordova.getLastIntent().base64;
    }
}

