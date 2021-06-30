import {Component, Input, EventEmitter, Output, ViewChild, ElementRef} from '@angular/core';
import {DialogButton, Group, RestConnectorService} from "../../../core-module/core.module";
import {Toast} from "../../../core-ui-module/toast";
import {RestNodeService} from "../../../core-module/core.module";
import {
  NodeWrapper, Node, NodePermissions, LocalPermissionsResult, Permission,
  LoginResult, View, STREAM_STATUS, IamUser, AuthorityProfile
} from "../../../core-module/core.module";
import {ConfigurationService} from "../../../core-module/core.module";
import {UIHelper} from "../../../core-ui-module/ui-helper";
import {RestIamService} from "../../../core-module/core.module";
import {TranslateService} from "@ngx-translate/core";
import {MdsComponent} from "../../../common/ui/mds/mds.component";
import {RestConstants} from "../../../core-module/core.module";
import {UIAnimation} from "../../../core-module/ui/ui-animation";
import {trigger} from "@angular/animations";
import {RestStreamService} from "../../../core-module/core.module";
import {RestHelper} from "../../../core-module/core.module";
import {Helper} from "../../../core-module/rest/helper";

enum Step {
  selectGroup,
  confirmGroup
}
@Component({
  selector: 'app-signup-group',
  templateUrl: 'signup-group.component.html',
  styleUrls: ['signup-group.component.scss'],
})
export class SignupGroupComponent  {
  readonly STEP = Step;
  @Output() onCancel = new EventEmitter<void>();
  buttons: DialogButton[];
  dialogStep: Step = Step.selectGroup;
  group: Group;
  groups: Group[];
  password = '';
  groupsLoading = true;
  constructor(
      private connector : RestConnectorService,
      private iam : RestIamService,
      private streamApi : RestStreamService,
      private config : ConfigurationService,
      private toast : Toast,
      private nodeApi : RestNodeService) {
    this.updateButtons();
    this.connector.isLoggedIn(false).subscribe((data:LoginResult)=> {
      const request = {
        count: RestConstants.COUNT_UNLIMITED
      };
      this.iam.searchGroups('*', true, '', '*', request).subscribe((groups) => {
        this.groups = groups.groups;
        this.groupsLoading = false;
      }, error => {
        this.toast.error(error);
        this.groupsLoading = false;
        this.toast.closeModalDialog();
      })
    });
  }

  updateButtons() {
    if(this.dialogStep === Step.selectGroup) {
      this.buttons = DialogButton.getNextCancel(() => this.onCancel.emit(), () => {
        this.dialogStep = Step.confirmGroup;
        this.updateButtons();
      });
      this.buttons[1].disabled = !this.group;
    }
    if(this.dialogStep === Step.confirmGroup) {
      const back = new DialogButton('BACK', DialogButton.TYPE_CANCEL, () => {
        this.dialogStep = Step.selectGroup;
        this.updateButtons();
      });
      const signup = new DialogButton('SIGNUP_GROUP.SIGNUP', DialogButton.TYPE_PRIMARY, () => this.signup());
      signup.disabled = this.group.signupMethod === 'password' && !this.password;
      this.buttons = [
          back,
          signup
      ]
    }
  }

    signup(): void {
      this.toast.showProgressDialog();
      this.iam.signupGroup(this.group.authorityName, this.password).subscribe((result) => {
        if(result !== 'Ok') {
          this.toast.error(null, 'SIGNUP_GROUP.TOAST.' + result);
        } else {
          if(this.group.signupMethod === 'list') {
            this.toast.toast('SIGNUP_GROUP.TOAST.ADDED_TO_LIST');
          } else {
            this.toast.toast('SIGNUP_GROUP.TOAST.ADDED_TO_GROUP', {group: this.group.profile.displayName});
          }
          this.onCancel.emit();
        }
        this.toast.closeModalDialog();
      }, error => {
        this.toast.error(error);
        this.toast.closeModalDialog();
      })
    }

    select(group: Group) {
      this.group = group;
      this.updateButtons();
    }
}
