import {ApplicationRef, Component, EventEmitter, Input, Output, ViewChild} from '@angular/core';
import {Authority, AuthorityProfile, DialogButton, Group, LocalPermissions, Organization, Permission, Permissions, RestConnectorService, RestOrganizationService} from '../../../../core-module/core.module';
import {Toast} from '../../../../core-ui-module/toast';
import {RestNodeService} from '../../../../core-module/core.module';
import {Connector, Node} from '../../../../core-module/core.module';
import {ConfigurationService} from '../../../../core-module/core.module';
import {UIHelper} from '../../../../core-ui-module/ui-helper';
import {RestIamService} from '../../../../core-module/core.module';
import {TranslateService} from '@ngx-translate/core';
import {trigger} from '@angular/animations';
import {UIAnimation} from '../../../../core-module/ui/ui-animation';
import {RestConstants} from '../../../../core-module/core.module';
import {Router} from '@angular/router';
import {RestHelper} from '../../../../core-module/core.module';
import {RestConnectorsService} from '../../../../core-module/core.module';
import {FrameEventsService} from '../../../../core-module/core.module';

import {OPEN_URL_MODE} from '../../../../core-module/ui/ui-constants';
import {BridgeService} from '../../../../core-bridge-module/bridge.service';
import {forkJoin, Observable, Observer} from 'rxjs';
import {MatButtonToggleGroup} from '@angular/material/button-toggle';
import {Helper} from '../../../../core-module/rest/helper';
import {ShareMode, SharePublishComponent} from '../../../workspace/share/share-publish/share-publish.component';

type Org = {organization: Organization, groups?: any};

class SimpleEditGroupConfig {
  toolpermission?: string;
  groups: string[];
}

@Component({
  selector: 'es-simple-edit-invite',
  templateUrl: 'simple-edit-invite.component.html',
  styleUrls: ['simple-edit-invite.component.scss'],
  animations: [
    trigger('fade', UIAnimation.fade()),
    trigger('cardAnimation', UIAnimation.cardAnimation())
  ]
})
export class SimpleEditInviteComponent {
  @ViewChild('orgGroup') orgGroup: MatButtonToggleGroup;
  @ViewChild('globalGroup') globalGroup: MatButtonToggleGroup;
  _nodes: Node[];
  multipleParents: boolean;
  dirty = false;
  parentPermissions: Permission[];
  parentAuthorities: Permission[] = [];
  organizations: Org[];
  /**
   * When true, we know that we only handling with simple permissions
   * this will cause that editing permission will REPLACE the permissions, rather than EXPAND them
   */
  stablePermissionState = false;
  organizationGroups: string[];
  globalGroups: Group[]|any = [];
  private nodesPermissions: Permissions[];
  private initialState: string;
  recentAuthorities: AuthorityProfile[];
  private currentPermissions: Permission[];
  tpInvite: boolean;
  tpInviteEveryone: boolean;
  missingNodePermissions: boolean;
  inherited: boolean;
  @Input() set nodes (nodes : Node[]) {
    this._nodes = nodes;
    this.prepare();
  }
  @Input() fromUpload : boolean;
  @Output() onInitFinished = new EventEmitter<boolean>();
  @Output() onError = new EventEmitter<any>();

  constructor(
      private nodeApi : RestNodeService,
      private connector : RestConnectorService,
      private applicationRef : ApplicationRef,
      private configService : ConfigurationService,
      private iamApi : RestIamService,
      private organizationApi : RestOrganizationService,
      private toast : Toast,
  ) {
    this.configService.get('simpleEdit.organization.groupTypes',
        [RestConstants.GROUP_TYPE_ADMINISTRATORS]).subscribe((data) =>
        // only display non-empty groups
        this.organizationGroups = data.filter((d: string) => !!d)
  );
    this.configService.get('simpleEdit.globalGroups',
        [{groups: [RestConstants.AUTHORITY_EVERYONE]}]).subscribe((data) => {
      this.loadGlobalGroups(data);
    });
    this.connector.hasToolPermission(RestConstants.TOOLPERMISSION_INVITE).subscribe((tp) => this.tpInvite = tp);
    this.connector.hasToolPermission(RestConstants.TOOLPERMISSION_INVITE_ALLAUTHORITIES).subscribe((tp) => this.tpInviteEveryone = tp);
  }
  isDirty() {
    if(this.hasInvalidState()) {
      return false;
    }
    if (this.dirty) {
      return true;
    }
    return this.getSelectedAuthority()!=null && !Helper.objectEquals(this.initialState, this.getSelectedAuthority());
  }
  save() {
    return new Observable<void>((observer) => {
      if(!this.isDirty()) {
        observer.next();
        observer.complete();
        return;
      }
      const authority = this.getSelectedAuthority();
      let addPermission: Permission = null;
      const publish = authority === RestConstants.AUTHORITY_EVERYONE
      if (authority != null) {
        addPermission = new Permission();
        addPermission.authority = {
          authorityName: authority,
          authorityType: authority.startsWith(RestConstants.GROUP_PREFIX) ?
              RestConstants.AUTHORITY_TYPE_GROUP : RestConstants.AUTHORITY_TYPE_USER,
        };
        // if EVERYONE, we do a "publishing"
        if(publish) {
          addPermission.permissions = [RestConstants.PERMISSION_CONSUMER, RestConstants.ACCESS_CC_PUBLISH];
        } else {
          addPermission.permissions = [RestConstants.PERMISSION_CONSUMER];
        }
      }
      forkJoin(this._nodes.map((n, i) => {
        let permissions = this.nodesPermissions[i].localPermissions;
        // if currentPermissions available (single node mode), we will check the state and override if possible
        if (this.currentPermissions && this.currentPermissions.length) {
          permissions.permissions = [];
        }
        if (addPermission) {
          if (this.stablePermissionState) {
            permissions.permissions = [addPermission];
          } else {
            permissions.permissions =
                UIHelper.mergePermissionsWithHighestPermission(permissions.permissions, [addPermission]);
          }
        }
        if (this.currentPermissions && this.currentPermissions.length) {
          // all global groups will get removed
          this.currentPermissions = this.currentPermissions.filter((p) =>
              this.getAvailableGlobalGroups().indexOf(p.authority.authorityName) === -1
          );
          permissions.permissions =
              UIHelper.mergePermissionsWithHighestPermission(permissions.permissions,this.currentPermissions);
        }
        permissions = RestHelper.copyAndCleanPermissions(permissions.permissions, this.nodesPermissions[i].localPermissions.inherited);
        return this.nodeApi.setNodePermissions(n.ref.id, permissions, false);
      })).subscribe(() => {
        observer.next(null);
        observer.complete();
      }, error => {
        observer.error(error);
        observer.complete();
      });

    });
  }

  private getSelectedAuthority() {
    if (this.hasInvalidState()) {
      return null;
    }
    let authority: string = null;
    if (this.orgGroup.value) {
      if (this.orgGroup.value === 'unset') {
        // do nothing
      } else {
        authority = this.orgGroup.value;
      }
    } else if (this.globalGroup.value) {
      authority = this.globalGroup.value;
    } else {
      console.warn('invalid value for button toggle in simple invite dialog');
    }
    return authority;
  }

  private prepare() {
    const parents=Array.from(new Set(this._nodes.map((n) => n.parent.id)));
    this.multipleParents = parents.length > 1;
    if(this.multipleParents) {
      this.setInitialState();
      return;
    }
    if(this._nodes.find((n) => n.access.indexOf(RestConstants.ACCESS_CHANGE_PERMISSIONS) === -1)){
      this.missingNodePermissions = true;
      this.setInitialState();
      return;
    }
    this.nodeApi.getNodePermissions(parents[0]).subscribe((parent) => {
      this.parentPermissions = parent.permissions.localPermissions.permissions.concat(parent.permissions.inheritedPermissions);
      // filter and distinct them first
      const authorities = Array.from(new Set(this.parentPermissions.
          map((p) => p.authority.authorityName).
          filter((a) => a !== this.connector.getCurrentLogin().authorityName && a !== RestConstants.AUTHORITY_ROLE_OWNER)
      ));
      // now, convert them back to objects
      this.parentAuthorities = authorities.map((a) =>
          this.parentPermissions.find((p) => p.authority.authorityName === a)
      );
    }, error => {
      if(error.status === RestConstants.HTTP_FORBIDDEN) {
        this.missingNodePermissions = true;
      } else {
        this.onError.emit(error)
      }
    });
    forkJoin((this._nodes.map((n) => this.nodeApi.getNodePermissions(n.ref.id)))).
    subscribe((permissions) => {
      this.nodesPermissions = permissions.map((p) => p.permissions);
      this.inherited = permissions.some((p) => p.permissions.localPermissions.inherited);
      // The amount of orgs is still limited to the maximum amount returned by default!
      this.organizationApi.getOrganizations('', true).subscribe((orgs) => {
        const filter = this.configService.instant('simpleEdit.organizationFilter');
        if(filter) {
          const reg = new RegExp(filter);
          orgs.organizations = orgs.organizations.filter((o) => {
            return reg.exec(o.authorityName) != null;
          });
        }
        if(orgs.organizations.length >= 1) {
          this.organizations = orgs.organizations.map((o) => {
            return {
              organization: o,
              groups: {}
            }});
          forkJoin(
              this.organizations.map((o) => {
                return new Observable<Org>((observer) => {
                  if(this.organizationGroups?.length) {
                    forkJoin(this.organizationGroups.map((g) =>
                        this.iamApi.getSubgroupByType(o.organization.authorityName, g)
                    )).subscribe(groups => {
                      groups.forEach((g) => {
                        o.groups[g.group.profile.groupType] = g.group;
                      });
                      observer.next(o);
                      observer.complete();
                    }, error => {
                      console.warn('Some group roles could not be found', error)
                      observer.next(o);
                      observer.complete();
                    });
                  } else {
                    observer.next(o);
                    observer.complete();
                  }
                });
              })).subscribe((o) => {
            this.organizations = o;
            this.detectPermissionState();
          });
        } else {
          this.detectPermissionState();
        }
      });
    }, error => {
      this.onError.emit(error);
    });
  }

  private loadGlobalGroups(config: SimpleEditGroupConfig[]) {
    const groupConfigs = config.filter((g) =>
      !g.toolpermission || this.connector.hasToolPermissionInstant(g.toolpermission)
    );
    let groups: string[];
    if(groupConfigs.length === 0) {
      console.warn('Invalid config for simple edit / global groups. No matching entry was found');
      groups = [];
    } else {
      groups = groupConfigs[0].groups || [];
    }
    this.globalGroups = [];
    // filter group everyone and handle it seperately
    if(groups.find((d) => d === RestConstants.AUTHORITY_EVERYONE)) {
      groups = groups.filter((d) => d !== RestConstants.AUTHORITY_EVERYONE);
      this.globalGroups.push({
        authorityName: RestConstants.AUTHORITY_EVERYONE,
        authorityType: RestConstants.AUTHORITY_TYPE_EVERYONE
      });
    }
    forkJoin(groups.map((d) => this.iamApi.getGroup(d))).
    subscribe((groups) =>
        this.globalGroups = groups.map((g) => g.group).concat(this.globalGroups)
    );
  }

  updateValue(mode: 'org' | 'global') {
    if(mode === 'org') {
      this.globalGroup.value = null;
    } else {
      this.orgGroup.value = null;
    }
  }

  private async detectPermissionState() {
    // wait 1 tick so that the mat toggle is ready to accept values
    await this.applicationRef.tick();
    if (this.hasInvalidState()) {
      this.setInitialState();
      return;
    }
    const availableToggleGroups = this.getAvailableGlobalGroups();
    let unset = false;
    let invalid = false;
    let activeToggle: string;
    for (const perm of this.nodesPermissions) {
      const list = perm.localPermissions.permissions;
      // filter((p) => p.authority.authorityName !== this.connector.getCurrentLogin().authorityName);
      if (this._nodes.length === 1) {
        this.currentPermissions = list;
      } else {
        this.currentPermissions = [];
      }
      if (list.length > 0) {
        const consumers = list.filter((p) => p.permissions.indexOf(RestConstants.PERMISSION_CONSUMER) !== -1);
        const toggle = consumers.filter((c) => availableToggleGroups.indexOf(c.authority.authorityName) !== -1);
        if (toggle.length === 1 && (!activeToggle || activeToggle === toggle[0].authority.authorityName)) {
          activeToggle = toggle[0].authority.authorityName;
        } else {
          invalid = true;
        }
      } else {
        unset = true;
      }
    }
    this.stablePermissionState = !invalid;
    if (unset || invalid) {
      this.orgGroup.value = 'unset';
    } else {
      if (this.organizations?.length && activeToggle) {
        const match = this.organizations.find(
            (o) => o.organization.authorityName === activeToggle
        );
        if (match) {
          this.orgGroup.value = match.organization.authorityName;
          this.setInitialState();
          return;
        }
      }
      if (this.organizations?.length) {
        for (const org of this.organizations) {
          for (const key of Object.keys(org.groups)) {
            if (activeToggle === org.groups[key].authorityName) {
              this.orgGroup.value = activeToggle;
              this.setInitialState();
              return;
            }
          }
        }
      }
      if (this.globalGroups) {
        for (const globalGroup of this.globalGroups) {
          if (activeToggle === globalGroup.authorityName) {
            this.globalGroup.value = activeToggle;
            this.setInitialState();
            return;
          }
        }
      }
      this.orgGroup.value = 'unset';
    }
    this.setInitialState();
  }

  private getAvailableGlobalGroups() {
    let availableToggleGroups: string[] = [];
    if (this.organizations?.length) {
      availableToggleGroups = availableToggleGroups.concat(this.organizations.map(
          (o) => o.organization.authorityName)
      );
      for(const org of this.organizations) {
        for (const key of Object.keys(org.groups)) {
          availableToggleGroups.push(org.groups[key].authorityName);
        }
      }
    }
    if (this.globalGroups) {
      for (const globalGroup of this.globalGroups) {
        availableToggleGroups.push(globalGroup.authorityName);
      }
    }
    return availableToggleGroups;
  }

  hasInvalidState() {
    return this.multipleParents || (this.inherited && this.parentAuthorities.length > 0) ||
        !this.tpInvite || this.missingNodePermissions;
  }

  private setInitialState() {
    this.iamApi.getRecentlyInvited().subscribe((recent) => {
      this.recentAuthorities = recent.authorities.filter(
          (a) => this.getAvailableGlobalGroups().indexOf(a.authorityName) === -1
      ).slice(0,6);
      this.initialState = this.getSelectedAuthority();
      this.onInitFinished.emit(true);
    }, error => this.onError.emit(error));
  }

  isInvited(authority: AuthorityProfile): boolean {
    return this.currentPermissions ?
        !!this.currentPermissions.find((p) => p.authority.authorityName === authority.authorityName) :
        false;
  }

  toggleInvitation(authority: AuthorityProfile) {
    this.dirty = true;
    if (this.isInvited(authority)) {
      this.currentPermissions = this.currentPermissions.filter((p) => p.authority.authorityName !== authority.authorityName);
      console.log(this.currentPermissions);
    } else {
      const permission =new Permission();
      permission.authority = {
        authorityName: authority.authorityName,
        authorityType: authority.authorityType
      };
      permission.permissions = [RestConstants.PERMISSION_CONSUMER];
      this.currentPermissions.push(permission);
    }
  }
}
