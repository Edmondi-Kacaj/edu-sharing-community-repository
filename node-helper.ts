import {TranslateService} from '@ngx-translate/core';
import {AuthorityProfile, CollectionReference, ConfigurationService, ListItem, Node, NodesRightMode, NodeWrapper, Permissions, Repository, RestConnectorService, RestConstants, RestHelper, TemporaryStorageService, User, WorkflowDefinition} from '../core-module/core.module';
import {FormatSizePipe} from './pipes/file-size.pipe';
import {Observable, Observer} from 'rxjs';
import {Router} from '@angular/router';
import {OptionItem} from './option-item';
import {DateHelper} from './DateHelper';
import {UIConstants} from '../core-module/ui/ui-constants';
import {Helper} from '../core-module/rest/helper';
import {VCard} from '../core-module/ui/VCard';
import {HttpClient, HttpResponse} from '@angular/common/http';
import {ConfigurationHelper} from '../core-module/rest/configuration-helper';
import {BridgeService} from '../core-bridge-module/bridge.service';
import {MessageType} from '../core-module/ui/message-type';
import {Toast} from './toast';

export class NodeHelper {
  /**
   * Gets and formats an attribute from the node
   * @param node
   * @param item
   * @returns {any}
   */
  public static getNodeAttribute(translation : TranslateService,config:ConfigurationService,node : Node,item : ListItem,fallbackValue='-') : string {
    const name=item.name;
    if(name==RestConstants.CM_NAME)
      return node.name==null ? node.ref.id : node.name;
    if(name==RestConstants.CM_PROP_TITLE || name==RestConstants.LOM_PROP_TITLE) {
      return RestHelper.getTitle(node);
    }
    if(name==RestConstants.SIZE) {
      return node.size ? (new FormatSizePipe().transform(node.size,null) as string) : translation.instant('NO_SIZE');
    }
    if(name==RestConstants.MEDIATYPE) {
      return translation.instant('MEDIATYPE.'+node.mediatype);
    }
    if(name==RestConstants.CM_CREATOR) {
      const value=ConfigurationHelper.getPersonWithConfigDisplayName(node.createdBy,config);
      if(value)
        return value;
    }
    if(name==RestConstants.CCM_PROP_EDUCATIONALTYPICALAGERANGE) {
      let range:string[];
      if(node.properties[RestConstants.CCM_PROP_EDUCATIONALTYPICALAGERANGE]) {
        try {
          range = node.properties[RestConstants.CCM_PROP_EDUCATIONALTYPICALAGERANGE][0].split('-');
        } catch(e) {
          range=[null];
        }
      }
      else {
        try {
          range = [node.properties[RestConstants.CCM_PROP_EDUCATIONALTYPICALAGERANGE + '_from'][0], node.properties[RestConstants.CCM_PROP_EDUCATIONALTYPICALAGERANGE + '_to'][0]];
        } catch(e) {
          range=[null];
        }
      }
      if(range[0]) {
          if (range[0] == range[1] || !range[1]) {
            return range[0].trim()+' '+translation.instant('LEARNINGAGE_YEAR');
          }
          else {
            return range[0].trim()+'-'+range[1].trim()+' '+translation.instant('LEARNINGAGE_YEAR');
          }
      }
    }
    if(name==RestConstants.CCM_PROP_WF_STATUS && !node.isDirectory) {
      const workflow=NodeHelper.getWorkflowStatus(config,node);
      return '<div class="workflowStatus" style="background-color: '+workflow.color+'">'+translation.instant('WORKFLOW.'+workflow.id)+'</div>'
    }
    if(name==RestConstants.DIMENSIONS) {
      const width=node.properties[RestConstants.CCM_PROP_WIDTH];
      const height=node.properties[RestConstants.CCM_PROP_HEIGHT];
      const megapixel=Math.round((width*height)/1000000.);
      if(width && height) {
        if(megapixel>1) {
          return megapixel+' Megapixel';
        }
        return Math.round(width) + 'x' + Math.round(height);
      }
    }
    if(name.startsWith('counts.')) {
      const count=(node as any).counts[name.split('.')[1]];
      if(count)
        return ''+count;
      else
        return fallbackValue;
    }
    let value : string;
    if(node.properties[name])
      value=node.properties[name].join(', ');
    if((node as any)[name])
      value=(node as any)[name];
    if(value && RestConstants.getAllVCardFields().indexOf(name)!=-1) {
      return new VCard(value).getDisplayName();
    }
    if(value && RestConstants.DATE_FIELDS.indexOf(name)!=-1) {
      if(item.format) {
        value=DateHelper.formatDateByPattern(value,item.format).trim();
      }
      else {
        value = DateHelper.formatDate(translation, value);
      }
      if(node.properties[name])
        node.properties[name][0]=value;
    }
    if(node.properties[name+RestConstants.DISPLAYNAME_SUFFIX]) {
      value=node.properties[name+RestConstants.DISPLAYNAME_SUFFIX].join(', ');
    }
    if(value)
      return value;
    return fallbackValue;
    // return "MISSING "+item;

  }

  /**
   * returns true if all nodes have the requested right
   * mode (only works for collection refs):
   *   Local: check only rights of the node itself
       Original: check only rights of the original node this refers to (collection ref). If it is not a collection ref, fallback to local
       Both: check both rights of node + original combined via or
   *
   */
  public static getNodesRight(nodes :any[],right : string,mode = NodesRightMode.Local) {
    if(nodes==null)
      return true;
    for(const node of nodes) {
      let currentMode=mode;
      // if this is not a collection ref -> force local mode
      if(node.aspects && node.aspects.indexOf(RestConstants.CCM_ASPECT_IO_REFERENCE) === -1) {
        currentMode=NodesRightMode.Local;
      }
      if(currentMode === NodesRightMode.Original || currentMode === NodesRightMode.Both) {
        if(node.accessOriginal && node.accessOriginal.indexOf(right) !== -1) {
          continue;
        }
        // return false because either on original not found, or both (because both is then also false)
        return false;
      }
      // check regular node rights
      if(!node.access || node.access.indexOf(right) === -1) {
        return false;
      }
    }
    return true;
  }
  public static handleNodeError(bridge:BridgeService,name: string, error: any) : number {

    if(error.status === RestConstants.DUPLICATE_NODE_RESPONSE) {
      bridge.showTemporaryMessage(MessageType.error, 'WORKSPACE.TOAST.DUPLICATE_NAME',{name});
      return error.status;
    }
    else if(error._body) {
      try {
        const json=JSON.parse(error._body);
        if(json.message.startsWith('org.alfresco.service.cmr.repository.CyclicChildRelationshipException')) {
          bridge.showTemporaryMessage(MessageType.error, 'WORKSPACE.TOAST.CYCLIC_NODE',{name});
          return error.status;
        }
      }
      catch(e) {}
    }
    bridge.showTemporaryMessage(MessageType.error, null, null, null, error);
    return error.status;
  }

  public static getCollectionScopeInfo(node : Node) : any {
    const scope=node.collection ? node.collection.scope : null;
    let icon='help';
    let scopeName='UNKNOWN';
    if(scope === RestConstants.COLLECTIONSCOPE_MY) {
      icon='lock';
      scopeName='MY';
    }
    if(scope === RestConstants.COLLECTIONSCOPE_ORGA || scope === RestConstants.COLLECTIONSCOPE_CUSTOM) {
      icon='group';
      scopeName='SHARED';
    }
    if(scope === RestConstants.COLLECTIONSCOPE_ALL || scope === RestConstants.COLLECTIONSCOPE_CUSTOM_PUBLIC) {
      icon='language';
      scopeName='PUBLIC';
    }
    if(node.collection.type === RestConstants.COLLECTIONTYPE_EDITORIAL) {
      icon='star';
      scopeName='TYPE_EDITORIAL';
    }
    if(node.collection.type === RestConstants.COLLECTIONTYPE_MEDIA_CENTER) {
      icon='business';
      scopeName='TYPE_MEDIA_CENTER';
    }
    return {icon,scopeName};
  }
  /**
   * Get a formatted attribute from a collection
   * @param translate
   * @param node
   * @param item
   * @returns {any}
   */
  public static getCollectionAttribute(translate : TranslateService,node : Node,item : string) : string {
    if(item === 'info') {
      const childs=node.collection.childReferencesCount;
      const coll=node.collection.childCollectionsCount;

      return '<i class="material-icons">layers</i> '+coll+' <i class="material-icons">insert_drive_file</i> '+childs;
      /*
      let result="";
      if(coll>0){
        result=coll+" "+translate.instant("COLLECTION.INFO_REFERENCES"+(coll>1 ? "_MULTI" : ""));
      }
      if(childs>0){
        if(coll>0)
          result+=", ";
        result+=childs+" "+translate.instant("COLLECTION.INFO_CHILDS"+(childs>1 ? "_MULTI" : ""));
      }
      if(coll+childs==0){
        return translate.instant("COLLECTION.INFO_NO_CONTENT");
      }
      return result;
          */
    }
    if(item=='scope') {
      const info=NodeHelper.getCollectionScopeInfo(node);
      return '<i class="material-icons collectionScope">'+info.icon+'</i> <span>'+
          translate.instant('COLLECTION.SCOPE.'+info.scopeName)+'</span>';
    }
    return (node.collection as any)[item];
  }

  public static downloadUrl(bridge:BridgeService,url:string,fileName='download') {
    if(bridge.isRunningCordova()) {
        bridge.showTemporaryMessage(MessageType.info, 'TOAST.DOWNLOAD_STARTED', {name:fileName});
        bridge.getCordova().downloadContent(url,fileName,(deviceFileName:string)=> {
            if(bridge.getCordova().isAndroid()) {
                bridge.showTemporaryMessage(MessageType.info, 'TOAST.DOWNLOAD_FINISHED_ANDROID', {name: fileName});
            }
            else {
                bridge.showTemporaryMessage(MessageType.info, 'TOAST.DOWNLOAD_FINISHED_IOS', {name: fileName});
            }
        },()=> {
            bridge.showTemporaryMessage(MessageType.error, 'TOAST.DOWNLOAD_FAILED',{name:fileName},{
              link:{
                caption:'TOAST.DOWNLOAD_TRY_AGAIN',
                callback:()=> {this.downloadUrl(bridge,url,fileName)}
              }
            });
        });
    }
    else {
        window.open(url);
    }
  }
  /**
   * Download (a single) node
   */
  public static downloadNode(bridge:BridgeService,node:any,version=RestConstants.NODE_VERSION_CURRENT, metadata = false) {
    this.downloadUrl(bridge,node.downloadUrl+
        (version && version !== RestConstants.NODE_VERSION_CURRENT ? '&version='+version : '') + '&metadata='+metadata,
        node.name + (metadata ? '.txt' : '')
    );
  }


  /**
   * fetches the preview of the node and appends it at preview.data
   * @param node
   */
  public static appendImageData(rest:RestConnectorService,node: Node,quality=60) : Observable<Node> {
  return new Observable<Node>((observer : Observer<Node>)=> {
    const options:any=rest.getRequestOptions();
    options.responseType='blob';

    rest.get(node.preview.url+'&quality='+quality,options,false).subscribe((data:HttpResponse<Blob>)=> {
    // rest.get("http://localhost:8081/edu-sharing/rest/authentication/v1/validateSession",options,false).subscribe((data:Response)=>{
      node.preview.data=data.body;
      observer.next(node);
      observer.complete();
    },(error)=> {
      observer.error(error);
      observer.complete();
    });
  });
  }

  /**
   * Return the license icon of a node
   * @param node
   * @returns {string}
   */
  public static getLicenseIcon(node: Node) {
    return node.license ? node.license.icon : null;
  }

  /**
   * Get a license icon by using the property value string
   * @param string
   * @param rest
   * @returns {string}
   */
  public static getLicenseIconByString(string: String,rest:RestConnectorService,useNoneAsFallback=true) {
    let icon=string.replace(/_/g,'-').toLowerCase();
    if(icon=='')
      icon='none';

    const LICENSE_ICONS=['cc-0','cc-by-nc','cc-by-nc-nd','cc-by-nc-sa','cc-by-nd',
      'cc-by-sa','cc-by','copyright-free','copyright-license','custom',
      'edu-nc-nd-noDo','edu-nc-nd','edu-p-nr-nd-noDo','edu-p-nr-nd','none','pdm','schulfunk','unterrichts-und-lehrmedien'];
    if(LICENSE_ICONS.indexOf(icon)==-1 && !useNoneAsFallback)
      return null;// icon='none';
    if(icon=='none' && !useNoneAsFallback)
      return null;
    return rest.getAbsoluteEndpointUrl()+'../ccimages/licenses/'+icon+'.svg';
  }
  /**
   * Return a translated name of a license name for a node
   * @param node
   * @param translate
   * @returns {string|any|string|any|string|any|string|any|string|any|string}
   */
  public static getLicenseName(node: Node,translate:TranslateService) {
    let prop=node.properties[RestConstants.CCM_PROP_LICENSE];
    if(prop)
      prop=prop[0];
    else
      prop='';
    return NodeHelper.getLicenseNameByString(prop,translate);

  }

  /**
   * Return a translated name for a license string
   * @param string
   * @param translate
   * @returns {any}
   */
  public static getLicenseNameByString(name:String,translate:TranslateService) {
    if(name=='') {
      name='NONE';
    }
    return translate.instant('LICENSE.NAMES.'+name);
    // return name.replace(/_/g,"-");
  }

  /**
   * return the License URL (e.g. for CC_BY licenses) for a license string and version
   * @param licenseProperty
   * @param licenseVersion
   */
  public static getLicenseUrlByString(licenseProperty: string,licenseVersion:string) {
    const url=(RestConstants.LICENSE_URLS as any)[licenseProperty];
    if(!url)
      return null;
    return url.replace('#version',licenseVersion);
  }

  /**
   * Get a user name for displaying
   * @param user
   * @returns {string}
   */
  public static getUserDisplayName(user:AuthorityProfile|User) {
    return (user.profile.firstName+' '+user.profile.lastName).trim();
  }
    static isSavedSearchObject(node: Node) {
        return node.mediatype=='saved_search';
    }
  /**
   * Get an attribute (property) from a node
   * The attribute will be cached add the object
   * @param translate
   * @param config
   * @param data The node or other object to use
   * @param item The ListItem info for which the value should be resolved
   * @returns {any}
   */
  public static getAttribute(translate:TranslateService,config:ConfigurationService,data : any,item : ListItem) : string {
      if(!item){
        return '';
      }
      if((data as any).propertiesConverted && (data as any).propertiesConverted[item.name]) {
          return (data as any).propertiesConverted[item.name];
      }
      const value=this.getAttributeWithoutCache(translate,config,data,item);
      // Store already converted data inside node/object
      if(!(data as any).propertiesConverted) {
          (data as any).propertiesConverted=[];
      }
      (data as any).propertiesConverted[item.name]=value;
      return value;
  }
  public static getAttributeWithoutCache(translate:TranslateService,config:ConfigurationService,data : any,item : ListItem) : string {
    if(item.type=='NODE') {
      if(data.reference) // collection ref, use original for properties
        data=data.reference;
      if (item.name == RestConstants.CM_MODIFIED_DATE)
        return '<span property="dateModified" title="' + translate.instant('ACCESSIBILITY.LASTMODIFIED') + '">' + NodeHelper.getNodeAttribute(translate,config, data, item) + '</span>';

      if (item.name == RestConstants.CCM_PROP_LICENSE) {
        if (data.license && data.license.icon) {
          return NodeHelper.getLicenseHtml(translate,data);
        }
        return '';
      }
      if (item.name == RestConstants.CCM_PROP_REPLICATIONSOURCE || item.name == RestConstants.CCM_PROP_LIFECYCLECONTRIBUTER_PUBLISHER_FN) {
        if (typeof data.properties[item.name] !== 'undefined' && data.properties[item.name] != '') {
          const rawSrc = data.properties[item.name].toString().trim();
          let src = rawSrc.substring(rawSrc.lastIndexOf(':') + 1).toLowerCase();
          src = src.replace(/\s/g,'_');
          src = src.replace(/\./g,'_');
          src = src.replace(/\//g,'_');
          return '<img alt="'+rawSrc+'" title="'+rawSrc+'" src="'+NodeHelper.getSourceIconPath(src)+'">';
        }
        return '<img alt="repository" src="'+NodeHelper.getSourceIconPath('home')+'">';
      }

      return NodeHelper.getNodeAttribute(translate,config, data, item);
    }
    if(item.type=='COLLECTION') {
      return NodeHelper.getCollectionAttribute(translate,data,item.name);
    }
    if(item.type=='GROUP' || item.type=='ORG') {
      if(item.name=='displayName')
        return data.profile.displayName;
      if(item.name=='groupType')
        return translate.instant('PERMISSIONS.GROUP_TYPE.'+data.profile.groupType);
    }
    if(item.type=='USER') {
      if([RestConstants.AUTHORITY_FIRSTNAME,RestConstants.AUTHORITY_LASTNAME,RestConstants.AUTHORITY_EMAIL].indexOf(item.name)!=-1)
        return data.profile[item.name];
      if(item.name==RestConstants.AUTHORITY_STATUS) {
        return translate.instant('PERMISSIONS.USER_STATUS.'+data.status.status);
      }
    }
    return data[item.name];
  }

  /**
   * Add custom options to the node menu (loaded via config)
   */
  public static applyCustomNodeOptions(toast:Toast, http:HttpClient, connector:RestConnectorService, custom: any,allNodes:Node[], selectedNodes: Node[], options: OptionItem[],replaceUrl:any={}) {
    if (custom) {
      for (const c of custom) {
        if(c.remove) {
          const i=Helper.indexOfObjectArray(options,'name',c.name)
          if(i!=-1)
            options.splice(i,1);
          continue;
        }
        let position = c.position;
        if (c.position < 0)
          position = options.length - c.position;
        const item = new OptionItem(c.name, c.icon, (node: Node) => {
          const nodes = node == null ? selectedNodes : [node];
          let ids = '';
          if(nodes) {
            for (const node of nodes) {
              if (ids)
                ids += ',';
              ids += node.ref.id;
            }
          }
          let url = c.url.replace(':id', ids)
          url = url.replace(':api', connector.getAbsoluteEndpointUrl());
          if(replaceUrl) {
            for(const key in replaceUrl) {
              url = url.replace(key,encodeURIComponent(replaceUrl[key]));
            }
          }
          if (!c.ajax) {
            window.open(url);
            return;
          }
          toast.showProgressDialog();
          http.get(url).subscribe((data: any) => {
            if (data.success)
              toast.error(data.success, null, data.message ? data.success : data.message, data.message);
            else if (data.error)
              toast.error(null, data.error, null, data.message ? data.error : data.message, data.message);
            else
              toast.error(null);
            toast.closeModalDialog();
          }, (error: any) => {
            toast.error(error);
            toast.closeModalDialog();
          });
        });
        item.isSeparate = c.isSeperate;
        item.enabledCallback=(node:Node)=> {
            if (c.permission) {
                return NodeHelper.getNodesRight(NodeHelper.getActionbarNodes(selectedNodes, node), c.permission);
            }
            return true;
        }
        item.isEnabled=item.enabledCallback(null);
        item.showCallback=(node:Node)=> {
            const nodes=NodeHelper.getActionbarNodes(selectedNodes,node);
            if(c.mode=='nodes' && (!nodes || nodes.length))
                return false;
            if(c.mode=='noNodes' && nodes && nodes.length)
                return false;
            if(c.mode=='noNodesNotEmpty' && (nodes && nodes.length || !allNodes || !allNodes.length))
                return false;
            if (c.mode=='nodes' && c.isDirectory != 'any' && nodes && c.isDirectory != nodes[0].isDirectory)
                return false;
            if(c.toolpermission && !connector.hasToolPermissionInstant(c.toolpermission))
                return false;
            if (!c.multiple && nodes && nodes.length > 1)
                return false;
            return true;
        }
        options.splice(position, 0, item);
      }
    }
  }

  /**
   * Apply (redirect url) node for usage by LMS systems
   * @param router
   * @param node
   */
  static addNodeToLms(router:Router,storage:TemporaryStorageService,node: Node,reurl:string) {
      storage.set(TemporaryStorageService.APPLY_TO_LMS_PARAMETER_NODE,node);
      router.navigate([UIConstants.ROUTER_PREFIX+'apply-to-lms',node.ref.repo, node.ref.id],{queryParams:{reurl}});
  }
  /**
   * Download one or multiple nodes
   * @param node
   */
  static downloadNodes(connector:RestConnectorService, nodes: Node[], fileName = 'download.zip') {
    if(nodes.length === 1)
      return this.downloadNode(connector.getBridgeService(),nodes[0]);

    const nodesString=RestHelper.getNodeIds(nodes).join(',');
    const url=connector.getAbsoluteEndpointUrl()+
        '../eduservlet/download?appId='+
        encodeURIComponent(nodes[0].ref.repo)+
        '&nodeIds='+encodeURIComponent(nodesString)+'&fileName='+encodeURIComponent(fileName);
    this.downloadUrl(connector.getBridgeService(),url,fileName);
  }

  static getLRMIProperty(data: any, item: ListItem) {
    // http://dublincore.org/dcx/lrmi-terms/2014-10-24/
    if(item.type=='NODE') {
      if(item.name==RestConstants.CM_NAME || item.name==RestConstants.CM_PROP_TITLE) {
        return 'name';
      }
      if(item.name==RestConstants.CM_CREATOR) {
        return 'author';
      }
      if(item.name==RestConstants.CM_PROP_C_CREATED) {
        return 'dateCreated';
      }
    }
    return '';
  }
  static getLRMIAttribute(translate:TranslateService,config:ConfigurationService,data: any, item: ListItem) {
    // http://dublincore.org/dcx/lrmi-terms/2014-10-24/
    if(item.type=='NODE') {
      if(data.reference)
        data=data.reference;
      if(item.name==RestConstants.CM_PROP_C_CREATED || item.name==RestConstants.CM_MODIFIED_DATE) {
        return data.properties[item.name+'ISO8601'];
      }
    }
    return NodeHelper.getAttribute(translate,config,data,item);
  }

  public static getLicenseHtml(translate:TranslateService,data:Node) {
    return '<span title="'+NodeHelper.getLicenseName(data,translate)+'"><img alt="'+NodeHelper.getLicenseName(data,translate)+'" src="'+NodeHelper.getLicenseIcon(data)+'"></span>';
  }
  public static getSourceIconRepoPath(repo:Repository) {
    if(repo.icon)
      return repo.icon;
    if(repo.isHomeRepo)
      return NodeHelper.getSourceIconPath('home');
    return NodeHelper.getSourceIconPath(repo.repositoryType.toLowerCase());
  }
  public static getSourceIconPath(src: string) {
    return 'assets/images/sources/' + src.toLowerCase() + '.png';
  }
  public static getWorkflowStatusById(config:ConfigurationService,id:string) : WorkflowDefinition {
    const workflows=NodeHelper.getWorkflows(config);
    let pos=Helper.indexOfObjectArray(workflows,'id',id);
    if(pos==-1) pos=0;
    const workflow=workflows[pos];
    return workflow;
  }
  public static getWorkflowStatus(config:ConfigurationService,node:Node) : WorkflowDefinition {
    let value=node.properties[RestConstants.CCM_PROP_WF_STATUS];
    if(value) value=value[0];
    if(!value)
      return NodeHelper.getWorkflows(config)[0];
   return NodeHelper.getWorkflowStatusById(config,value);
  }
  static getWorkflows(config: ConfigurationService) : WorkflowDefinition[] {
    return config.instant('workflows',[
      RestConstants.WORKFLOW_STATUS_UNCHECKED,
      RestConstants.WORKFLOW_STATUS_TO_CHECK,
      RestConstants.WORKFLOW_STATUS_HASFLAWS,
      RestConstants.WORKFLOW_STATUS_CHECKED,
    ]);
  }

  static allFiles(nodes: any[]) {
    let allFiles=true;
    if(nodes) {
      for (let node of nodes) {
        if(!node)
          continue;
        if(node.reference)
          node=node.reference;
        if (node.isDirectory || node.type!=RestConstants.CCM_TYPE_IO)
          allFiles = false;
      }
    }
    return allFiles;
  }
    static allFolders(nodes: Node[]) {
        let allFolders=true;
        if(nodes) {
            for (const node of nodes) {
                if (!node.isDirectory)
                    allFolders = false;
            }
        }
        return allFolders;
    }
  static hasAnimatedPreview(node: Node) {
    return !node.preview.isIcon && (node.mediatype=='file-video' || node.mimetype=='image/gif');
  }

  static askCCPublish(translate:TranslateService,node: Node) {
      const mail=node.createdBy.firstName+' '+node.createdBy.lastName+'<'+node.createdBy.mailbox+'>';
      const subject=translate.instant('ASK_CC_PUBLISH_SUBJECT',{name:RestHelper.getTitle(node)});
      window.location.href='mailto:'+mail+'?subject='+encodeURIComponent(subject);
  }

    /**
     * checks if a doi handle is active (node must be explicitly public and handle it must be present)
     * @param {Node} node
     * @param {Permissions} permissions
     * @returns {boolean}
     */
  static isDOIActive(node: Node, permissions: Permissions) {
    if(node.aspects.indexOf(RestConstants.CCM_ASPECT_PUBLISHED)!=-1 && node.properties[RestConstants.CCM_PROP_PUBLISHED_HANDLE_ID]) {
        for (const permission of permissions.localPermissions.permissions) {
            if (permission.authority.authorityName == RestConstants.AUTHORITY_EVERYONE)
                return true;
        }
    }
      return false;
  }

  static propertiesFromConnector(event: any) {
      const name=event.name+'.'+event.type.filetype;
      const prop=RestHelper.createNameProperty(name);
      prop[RestConstants.LOM_PROP_TECHNICAL_FORMAT]=[event.type.mimetype];
      if(event.type.mimetype=='application/zip') {
          prop[RestConstants.CCM_PROP_CCRESSOURCETYPE] = [event.type.ccressourcetype];
          prop[RestConstants.CCM_PROP_CCRESSOURCESUBTYPE] = [event.type.ccresourcesubtype];
          prop[RestConstants.CCM_PROP_CCRESSOURCEVERSION] = [event.type.ccressourceversion];
      }
      if(event.type.editorType) {
          prop[RestConstants.CCM_PROP_EDITOR_TYPE] = [event.type.editorType];
      }
      return prop;
  }
  public static getActionbarNodes<T>(nodes:T[],node:T):T[] {
      return node ? [node] : nodes && nodes.length ? nodes  : null;
  }

    static referenceOriginalExists(node: Node|CollectionReference) {
      if(node==null)
        return true;
      return (node.hasOwnProperty('originalId') ? (node as any).originalId!=null : true)
    }

  static isNodeCollection(node: Node | any) {
    return node.aspects && node.aspects.indexOf(RestConstants.CCM_ASPECT_COLLECTION) !==-1 || node.collection;
  }

  /**
   * get the value for all nodes, if it is identical. Otherwise, the fallback is returned
   * @param prop
   * @param fallbackNotIdentical Fallback when they're not equaling
   * @param fallbackIsEmpty Fallback when all are empty
   * @param asArray If false, only the first element of the property array will be returned
   */
  static getValueForAll(nodes: Node[], prop:string,fallbackNotIdentical:any='',fallbackIsEmpty=fallbackNotIdentical,asArray=true) {
    let found=null;
    let foundAny=false;

    for (let node of nodes) {
      const v = node.properties[prop];
      const value = v ? asArray ? v : v[0] : fallbackIsEmpty;
      if(foundAny && found !== value)
        return fallbackNotIdentical;
      found = value;
      foundAny = true;
    }
    if(!foundAny)
      return fallbackIsEmpty;
    return found;
  }

  static createUrlLink(link : LinkData) {
    const properties: any = {};
    const aspects: string[] = [];
    const url = NodeHelper.addHttpIfRequired(link.link);
    properties[RestConstants.CCM_PROP_IO_WWWURL]=[url];
    if(link.lti){
      aspects.push(RestConstants.CCM_ASPECT_TOOL_INSTANCE_LINK);
      properties[RestConstants.CCM_PROP_TOOL_INSTANCE_KEY]=[link.consumerKey];
      properties[RestConstants.CCM_PROP_TOOL_INSTANCE_SECRET]=[link.sharedSecret];
    }
    properties[RestConstants.CCM_PROP_LINKTYPE]=[RestConstants.LINKTYPE_USER_GENERATED];
    return { properties, aspects, url };
  }

  static addHttpIfRequired(link: string) {
    if (link.indexOf('://') == -1) {
      return 'http://' + link;
    }
    return link;
  }

}
export class LinkData {
  constructor(public link: string) {}
  lti: boolean;
  consumerKey: string;
  sharedSecret: string;
}
