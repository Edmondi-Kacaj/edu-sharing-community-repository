import {Component, Input, Output, EventEmitter, OnInit, HostListener} from '@angular/core';
import {TranslateService} from "@ngx-translate/core";
import {UIHelper} from '../../../core-ui-module/ui-helper';
import {
  Node, NodeList,
  ListItem,
  RestCollectionService, RestConnectorService,
  RestConstants,
  RestIamService,
  RestNodeService, DialogButton
} from "../../../core-module/core.module";
import {Toast} from "../../../core-ui-module/toast";

@Component({
  selector: 'file-chooser',
  templateUrl: 'file-chooser.component.html',
  styleUrls: ['file-chooser.component.scss'],
})
/**
 * An edu-sharing file-picker modal dialog
 */
export class FileChooserComponent implements OnInit{
  public selectedFiles : Node[] = [];
  private hasMoreToLoad : boolean;
  public _collections = false;
  private viewType = 0;
  public searchMode: boolean;
  private searchQuery : string;
  buttons: DialogButton[];
  subtitle: string;

    ngOnInit(): void {
    this.initialize();
  }
  public list : Node[];
  private icon : any = null;
  private hasHeading = true;
  public _pickDirectory : boolean;
  private offset = 0;
  private homeDirectory =RestConstants.USERHOME;
  public path : Node[]=[];
  private currentDirectory : string;
  public isLoading : boolean;
  /**
   * The caption of the dialog, will be translated automatically
   */
  @Input() title : string;
  /**
   * True if the dialog can be canceled by the user
   */
  @Input() isCancelable : boolean;
  /**
   * An array of element id's which should be hidden in the list
   */
  @Input() filterElements : string[]=[];
  /**
   * Set true if the user nees write permissions to the target file
  */
  @Input() writeRequired = false;
    /**
   * Set true if the user should pick a collection, not a regular node
   * @param collections
   */
    /**
     * relevant for directory picking: allow to choose the root directory (userhome)?
     */
  @Input() public allowRoot=true;

    @Input() set collections(collections : boolean){
    this._collections=collections;
    this.viewType=2;
    this.homeDirectory=RestConstants.ROOT;
    this.hasHeading = false;
    this._pickDirectory = false;
    this.icon='layers';
    this.searchMode=true;
    this.searchQuery="";
    this.columns=UIHelper.getDefaultCollectionColumns();
    this.sortBy=RestConstants.CM_MODIFIED_DATE;
    this.sortAscending=false;
    this.updateButtons();
    }

  /**
   * Set to true if the user should pick a directory
   * @param pickDirectory
   */
  @Input() set pickDirectory(pickDirectory : boolean){
      if(pickDirectory)
        this.filter.push(RestConstants.FILTER_FOLDERS);
      this._pickDirectory=pickDirectory;
      this.updateButtons();
  }

  /**
   * Filter for individual file types, please see @RestNodeService.getChildren()
   * @type {Array}
   */
  @Input() filter : string[] = [];
  @Input() priority = 0;
  private sortBy : string;
  private sortAscending=true;
  /**
   * Fired when an element is choosen, a Node Array will be send as a result
   * If mode is set to directory or collection, the array will always contain 1 element
   * @type {EventEmitter}
   */
  @Output() onChoose = new EventEmitter();
  /**
   * Fired when the picker was canceled by the user
   * @type {EventEmitter}
   */
  @Output() onCancel = new EventEmitter();

  private columns : ListItem[]=[];

  constructor(private connector : RestConnectorService,
              private iam : RestIamService,
              private collectionApi : RestCollectionService,
              private node : RestNodeService,
              private toast : Toast,
              private translate : TranslateService) {
    // http://plnkr.co/edit/btpW3l0jr5beJVjohy1Q?p=preview
    this.columns.push(new ListItem("NODE",RestConstants.CM_NAME));
    this.sortBy=this.columns[0].name;
    this.updateButtons();
  }
  private onSelection(node : Node[]){
    this.selectedFiles=node;
  }
  private initialize() {
    this.path=[];

    this.viewDirectory(this.homeDirectory);

  }
  private hasWritePermissions(node:any){
      if(node.access.indexOf(RestConstants.ACCESS_WRITE)==-1){
          return {status:false,message:'NO_WRITE_PERMISSIONS'};
      }
      return {status:true};
  }

  selectBreadcrumb(position : number) {
    if(position === this.path.length - 1) {
      return;
    } else  if(position === 0) {
      this.viewDirectory(this.homeDirectory);
    } else {
      this.selectItem(this.path[position]);
      this.path=this.path.slice(0,position + 1);
    }
  }
  private selectItem(event : Node){
    if(event.isDirectory || this._collections) {
      if(this.searchMode){
        this.selectedFiles=[event];
        return;
      }
      this.selectedFiles=[];
      this.node.getNodeParents(event.ref.id).subscribe((data:NodeList)=> {
        this.path=data.nodes.reverse();
        this.updateButtons();
      });
      this.viewDirectory(event.ref.id);
    }
    else{
    }
  }
  private search(){
    this.viewDirectory(this.homeDirectory);
  }
  private viewDirectory(directory: string,reset=true) {
    if(this.isLoading){
      setTimeout(()=>this.viewDirectory(directory),50);
      return;
    }
    this.currentDirectory=directory;
    if(this.currentDirectory==this.homeDirectory){
      this.path=[];
    }
    if(reset) {
      this.list = [];
      this.offset = 0;
      this.hasMoreToLoad = true; // !this._collections; // Collections have no paging
    }
    this.isLoading=true;
    if(this._collections){
      //this.collectionApi.getCollectionContent(directory,RestConstants.COLLECTIONSCOPE_ALL).subscribe((data:CollectionContent)=>{
      this.collectionApi.search(this.searchQuery,{
        offset: this.offset,
        sortBy: [this.sortBy],
        sortAscending: this.sortAscending
      }).subscribe((data)=>{
        let result:any=[];
        for(let c of data.collections){
          let obj:any=c;
          // dummy for list-table so it recognizes a collection
          obj.collection=c;
          result.push(obj);
        }
        this.showList(result);
      });
    }
    else {
      this.node.getChildren(directory, this.filter, {
        offset: this.offset,
        sortBy: [this.sortBy],
        sortAscending: this.sortAscending
      })
        .subscribe((list: NodeList) => this.showList(list.nodes));
    }
  }
  private loadMore(){
    if(!this.hasMoreToLoad)
      return;

    this.offset+=this.connector.numberPerRequest;
    this.viewDirectory(this.currentDirectory,false);
    this.isLoading=true;
    /*
    this.node.getChildren(this.currentDirectory,this.filter,{offset:this.offset,sortBy:[this.sortBy],sortAscending:this.sortAscending})
      .subscribe((list : NodeList) => this.addToList(list.nodes));
    */
  }
  private setSorting(data:any){
    this.sortBy=data.sortBy;
    this.sortAscending=data.sortAscending;
    this.list=null;
    this.viewDirectory(this.currentDirectory);
  }
  private showList(list : any) {
    this.addToList(list);
    this.updateButtons();
    this.isLoading=false;
  }
  cancel(){
    this.onCancel.emit();
  }

  private addToList(list : Node[]) {
    this.isLoading=false;
    if(!list.length)
      this.hasMoreToLoad=false;
    for(let node of list){
      if(this.filterElements && this.filterElements.length){
        if(this.filterElements.indexOf(node.ref.id)!=-1)
          continue;
      }
      this.list.push(node);
    }
  }
  private chooseDirectory(){
      // is root directory
      if(!this.path.length){
          this.node.getNodeMetadata(this.homeDirectory).subscribe((node)=>{
              this.onChoose.emit([node.node]);
          });
          return;
      }
    let node=this.path[this.path.length-1];
    if(this._collections){
      if(node.access.indexOf(RestConstants.ACCESS_WRITE)==-1){
        this.toast.error(null,"NO_WRITE_PERMISSIONS");
        return;
      }
    }
    this.onChoose.emit([node]);
  }
  private chooseFile(){
    if(this._collections){
      if(this.selectedFiles[0].access.indexOf(RestConstants.ACCESS_WRITE)==-1){
        this.toast.error(null,"NO_WRITE_PERMISSIONS");
        return;
      }
    }
    this.onChoose.emit(this.selectedFiles);
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if(event.code=="Escape" && this.isCancelable){
      event.preventDefault();
      event.stopPropagation();
      this.cancel();
      return;
    }
  }
  updateButtons(){
    /*
     <div class="card-action">
        <a *ngIf="_pickDirectory && path.length" class="waves-effect waves-light btn" tabindex="0" (keyup.enter)="chooseDirectory()" (click)="chooseDirectory()">{{() |translate:{name:path[path.length-1].name} }}</a>
        <a *ngIf="_pickDirectory && !path.length" class="waves-effect waves-light btn"
           [class.disabled]="_collections || !allowRoot" tabindex="0" (keyup.enter)="chooseDirectory()"
           (click)="chooseDirectory()">{{('SELECT_ROOT'+(_collections || !allowRoot ? '_DISABLED' : '')) | translate}}</a>
        <a *ngIf="selectedFiles.length" class="waves-effect waves-light btn"  [class.disabled]="writeRequired && hasWritePermissions(selectedFiles[0]).status==false" tabindex="0" (keyup.enter)="chooseFile()" (click)="chooseFile()">
            {{(_collections ? 'SELECT_COLLECTION' : 'SELECT_FILE') | translate:{name:selectedFiles[0].name ? selectedFiles[0].name : selectedFiles[0].title} }}</a>
        <a *ngIf="isCancelable && false" class="waves-effect waves-light btn-flat" tabindex="0" (keyup.enter)="cancel()" (click)="cancel()">{{ 'CANCEL' | translate}}</a>
    </div>
     */
    let btn;
    if(this._pickDirectory && this.path.length){
      this.subtitle=this.path[this.path.length-1].name;
      btn=new DialogButton(this.translate.instant(this._collections ? 'SELECT_COLLECTION' : 'SELECT_DIRECTORY',{name:this.subtitle}),DialogButton.TYPE_PRIMARY,()=>this.chooseDirectory());
    }
    if(this._pickDirectory && !this.path.length){
      this.subtitle=this.translate.instant('SELECT_ROOT_NAME');
      btn=new DialogButton('SELECT_ROOT'+(this._collections || !this.allowRoot ? '_DISABLED' : ''),DialogButton.TYPE_PRIMARY,()=>this.chooseDirectory());
      btn.disabled=this._collections;
    }
    if(this.selectedFiles.length){
      this.subtitle=this.selectedFiles[0].name;
      btn=new DialogButton(this.translate.instant(this._collections ? 'SELECT_COLLECTION' : 'SELECT_FILE',{name:this.subtitle}),DialogButton.TYPE_PRIMARY,()=>this.chooseFile());
      btn.disabled=this.writeRequired && this.hasWritePermissions(this.selectedFiles[0]).status==false;
    }
    this.buttons=[btn];
  }
}
