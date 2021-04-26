import {RestAdminService} from "../../../core-module/rest/services/rest-admin.service";
import {Component, EventEmitter, Output} from "@angular/core";
import {TranslateService} from "@ngx-translate/core";
import {NodeStatistics, Node, Statistics, IamGroup, Group, Collection} from "../../../core-module/rest/data-object";
import {ListItem} from "../../../core-module/ui/list-item";
import {RestConstants} from "../../../core-module/rest/rest-constants";
import {RestHelper} from "../../../core-module/rest/rest-helper";
import {ConfigurationService} from "../../../core-module/rest/services/configuration.service";
import {DialogButton, RestCollectionService, RestConnectorService, RestIamService, RestMdsService, RestMediacenterService, RestNodeService} from "../../../core-module/core.module";
import {Helper} from "../../../core-module/rest/helper";
import {Toast} from "../../../core-ui-module/toast";
import {OptionItem} from "../../../core-ui-module/option-item";
import {AbstractControl, FormBuilder, FormControl, FormGroup, Validators, ValidatorFn} from "@angular/forms";
import {MdsHelper} from "../../../core-module/rest/mds-helper";
import {UIHelper} from "../../../core-ui-module/ui-helper";

// Charts.js
declare var Chart:any;

@Component({
  selector: 'app-admin-frontpage',
  templateUrl: 'frontpage.component.html',
  styleUrls: ['frontpage.component.scss']
})
export class AdminFrontpageComponent {
  @Output() onOpenNode = new EventEmitter();
  loading=true;
  previewLoading=true;
  config: any;
  modes = ["collection","rating","views","downloads"];
  conditionTypes = ["TOOLPERMISSION"];
  timespans = ["days_30","days_100","all"];
  form: FormGroup;
  previewNodes: Node[];
  previewColumns: ListItem[]=[];
  previewError: string;
  collectionName = '';
  chooseCollection = false;
  codeOptions={minimap:{enabled:false}, language: 'json'};
  toolpermissions: any;

  /*
  totalCountFormControl = new FormControl('', [
    Validators.required,
    Validators.pattern("[0-9]*"),
    this.totalCountValidator
  ]);
  displayCountFormControl = new FormControl('', [
    Validators.required,
    //this.totalCountValidator
  ]);
  */

  constructor(
      private formBuilder: FormBuilder,
      private adminService: RestAdminService,
      private iamService: RestIamService,
      private translate: TranslateService,
      private nodeService: RestNodeService,
      private collectionService: RestCollectionService,
      public configService: ConfigurationService,
      private toast: Toast,
      private mdsService: RestMdsService
  ){
    this.form = this.formBuilder.group({
      totalCount : ['',[Validators.required,Validators.min(1),Validators.pattern("[0-9]*")]],
      displayCount : ['',[Validators.required,,Validators.min(1),Validators.pattern("[0-9]*")]],
      timespan : ['',[Validators.required,,Validators.min(1),Validators.pattern("[0-9]*")]]
    }, { validator: [
        ValidateForm
      ]
    });
    this.mdsService.getSet().subscribe((set)=>{
      this.previewColumns=MdsHelper.getColumns(this.translate, set,'search');
    });
    this.adminService.getToolpermissions().subscribe(toolpermissions =>
      this.toolpermissions = Object.keys(toolpermissions)
    );
    this.update();
  }

  save() {
    this.config.frontpage.displayCount=this.form.get('displayCount').value;
    this.config.frontpage.totalCount=this.form.get('totalCount').value;
    this.config.frontpage.timespan=this.form.get('timespan').value;
    this.loading=true;
    this.adminService.updateRepositoryConfig(this.config).subscribe(()=>{
      this.update();
      this.toast.toast('ADMIN.FRONTPAGE.SAVED');
    });
  }

  private update() {
    this.adminService.getRepositoryConfig().subscribe((config)=>{
      this.config=config;
      this.form.get('displayCount').setValue(this.config.frontpage.displayCount);
      this.form.get('totalCount').setValue(this.config.frontpage.totalCount);
      this.form.get('timespan').setValue(this.config.frontpage.timespan);
      this.loading=false;
      if(this.config.frontpage.collection){
        this.collectionService.getCollection(this.config.frontpage.collection).subscribe((c)=>{
          this.collectionName=c.collection.title;
        });
      }
    });
    this.updatePreviews();
  }

  updatePreviews() {
    this.previewLoading = true;
    this.previewNodes = [];
    this.previewError = null;
    this.nodeService.getChildren(RestConstants.NODES_FRONTPAGE).subscribe((nodes) => {
      this.previewLoading = false;
      this.previewNodes = nodes.nodes;
    },(error)=>{
      if(UIHelper.errorContains(error,'No Elasticsearch instance')){
        this.previewError='ELASTICSEARCH';
      }
      else{
        this.previewError='UNKNOWN';
      }
    });
  }
  openNode(node : any){
    this.onOpenNode.emit(node.node);
  }

  setCollection(collection : Node){
    this.config.frontpage.collection=collection.ref.id;
    this.collectionName=collection.title;
    this.chooseCollection=false;
  }

  queryHelp() {
    // @TODO: Link to edu-sharing manpage!

  }

  addQueryCondition() {
    if(!this.config.frontpage.queries)
      this.config.frontpage.queries=[];
    this.config.frontpage.queries.push({
      condition:{
        type:this.conditionTypes[0],
        negate:false
      }
    });
  }
  removeQueryCondition(query:any) {
    this.config.frontpage.queries.splice(this.config.frontpage.queries.indexOf(query),1);
  }
}
const ValidateForm: ValidatorFn=(control)=>{
  const displayCount = control.get('displayCount');
  const totalCount = control.get('totalCount');

  if(parseInt(displayCount.value,10)>parseInt(totalCount.value,10)){
    totalCount.setErrors({outOfRange:true});
  }
  return null;
};


