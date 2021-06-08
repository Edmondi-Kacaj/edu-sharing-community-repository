import {NgModule} from '@angular/core';
import {DECLARATIONS} from './declarations';
import {IMPORTS} from './imports';
import {PROVIDERS} from './providers';
import {RouterComponent} from './router/router.component';
import {DECLARATIONS_RECYCLE} from './modules/node-list/declarations';
import {DECLARATIONS_WORKSPACE} from './modules/workspace/declarations';
import {DECLARATIONS_SEARCH} from './modules/search/declarations';
import {PROVIDERS_SEARCH} from './modules/search/providers';
import {DECLARATIONS_COLLECTIONS} from './modules/collections/declarations';
import {DECLARATIONS_LOGIN} from './modules/login/declarations';
import {DECLARATIONS_LOGINAPP} from './modules/login-app/declarations';
import {DECLARATIONS_PERMISSIONS} from './modules/permissions/declarations';
import {DECLARATIONS_OER} from './modules/oer/declarations';
import {DECLARATIONS_ADMIN} from './modules/admin/declarations';
import {DECLARATIONS_MANAGEMENT_DIALOGS} from './modules/management-dialogs/declarations';
import {DECLARATIONS_MESSAGES} from './modules/messages/declarations';
import {DECLARATIONS_UPLOAD} from './modules/upload/declarations';
import {DECLARATIONS_STREAM} from './modules/stream/declarations';
import {DECLARATIONS_PROFILES} from './modules/profiles/declarations';
import {DECLARATIONS_STARTUP} from './modules/startup/declarations';
import {DECLARATIONS_SHARE_APP} from './modules/share-app/declarations';
import {DECLARATIONS_SHARING} from './modules/sharing/declarations';
import {DECLARATIONS_REGISTER} from './modules/register/declarations';
import {DECLARATIONS_SERVICES} from "./modules/services/declarations";
import {DECLARATIONS_FILE_UPLOAD} from './modules/file-upload/declarations';
import {CommentsListComponent} from "./modules/management-dialogs/node-comments/comments-list/comments-list.component";
import {MdsWidgetComponent} from "./common/ui/mds-viewer/widget/mds-widget.component";
import { MAT_LABEL_GLOBAL_OPTIONS } from "@angular/material/core";
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from "@angular/material/form-field";
import { MAT_TOOLTIP_DEFAULT_OPTIONS } from "@angular/material/tooltip";
import {ButtonsTestComponent} from './common/test/buttons/buttons-test.component';
import {InputsTestComponent} from './common/test/inputs/inputs-test.component';
import {UserAvatarTestComponent} from './common/test/user-avatar/user-avatar-test.component';
import {ModalTestComponent} from './common/test/modal/modal-test.component';
import { MainMenuSidebarComponent } from './common/ui/main-menu-sidebar/main-menu-sidebar.component';
import { MainMenuBottomComponent } from './common/ui/main-menu-bottom/main-menu-bottom.component';
import { MainMenuDropdownComponent } from './common/ui/main-menu-dropdown/main-menu-dropdown.component';
import { LuceneTemplateMemoryComponent } from './modules/admin/lucene-template-memory/lucene-template-memory.component';
import { CheckTextOverflowDirective } from './common/directives/check-text-overflow.directive';


// http://blog.angular-university.io/angular2-ngmodule/
// -> Making modules more readable using the spread operator


@NgModule({
    declarations: [
        DECLARATIONS,
        DECLARATIONS_RECYCLE,
        DECLARATIONS_WORKSPACE,
        DECLARATIONS_SEARCH,
        DECLARATIONS_COLLECTIONS,
        DECLARATIONS_LOGIN,
        DECLARATIONS_REGISTER,
        DECLARATIONS_LOGINAPP,
        DECLARATIONS_FILE_UPLOAD,
        DECLARATIONS_STARTUP,
        DECLARATIONS_PERMISSIONS,
        DECLARATIONS_OER,
        DECLARATIONS_STREAM,
        DECLARATIONS_MANAGEMENT_DIALOGS,
        DECLARATIONS_ADMIN,
        DECLARATIONS_UPLOAD,
        DECLARATIONS_PROFILES,
        DECLARATIONS_MESSAGES,
        DECLARATIONS_SHARING,
        DECLARATIONS_SHARE_APP,
        DECLARATIONS_SERVICES,
        MainMenuSidebarComponent,
        MainMenuBottomComponent,
        MainMenuDropdownComponent,
        LuceneTemplateMemoryComponent,
        CheckTextOverflowDirective,
    ],
    imports: IMPORTS,
    providers: [
        PROVIDERS,
        PROVIDERS_SEARCH,
        {provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: {appearance: 'outline'}},
        {provide: MAT_TOOLTIP_DEFAULT_OPTIONS, useValue: {showDelay: 500}}
    ],
    exports: [
        DECLARATIONS,
        DECLARATIONS_RECYCLE,
        DECLARATIONS_WORKSPACE,
        DECLARATIONS_SEARCH,
        DECLARATIONS_COLLECTIONS,
        DECLARATIONS_LOGIN,
        DECLARATIONS_REGISTER,
        DECLARATIONS_LOGINAPP,
        DECLARATIONS_FILE_UPLOAD,
        DECLARATIONS_STARTUP,
        DECLARATIONS_PERMISSIONS,
        DECLARATIONS_OER,
        DECLARATIONS_STREAM,
        DECLARATIONS_MANAGEMENT_DIALOGS,
        DECLARATIONS_ADMIN,
        DECLARATIONS_UPLOAD,
        DECLARATIONS_PROFILES,
        DECLARATIONS_MESSAGES,
        DECLARATIONS_SHARING,
        DECLARATIONS_SHARE_APP,
        DECLARATIONS_SERVICES
    ],
    bootstrap: [RouterComponent]
})
export class AppModule { }
