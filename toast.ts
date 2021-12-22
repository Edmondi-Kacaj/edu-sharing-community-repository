import { Injectable, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ToastData, ToastyService } from 'ngx-toasty';
import { BehaviorSubject, Observable } from 'rxjs';
import { ModalDialogOptions } from '../common/ui/modal-dialog-toast/modal-dialog-toast.component';
import { ProgressType } from '../common/ui/modal-dialog/modal-dialog.component';
import { RestConstants } from '../core-module/rest/rest-constants';
import { TemporaryStorageService } from '../core-module/rest/services/temporary-storage.service';
import { DialogButton } from '../core-module/ui/dialog-button';
import { UIAnimation } from '../core-module/ui/ui-animation';
import { UIConstants } from '../core-module/ui/ui-constants';
import { DateHelper } from './DateHelper';
import {RestConnectorService} from '../core-module/core.module';

@Injectable()
export class Toast {
    private static MIN_TIME_BETWEEN_TOAST = 2000;

    dialogInputValue: string;
    isModalDialogOpen: Observable<boolean>;

    private onShowModal: (params: ModalDialogOptions) => void;
    private dialogTitle: string;
    private dialogMessage: string;
    private dialogParameters: any;
    private lastToastMessage: string;
    private lastToastMessageTime: number;
    private lastToastError: string;
    private lastToastErrorTime: number;
    private linkCallback: () => void;
    private isModalDialogOpenSubject = new BehaviorSubject<boolean>(false);

    constructor(
        private toasty: ToastyService,
        private router: Router,
        private storage: TemporaryStorageService,
        private injector: Injector,
    ) {
        (window as any).toastComponent = this;
        this.isModalDialogOpen = this.isModalDialogOpenSubject.asObservable();
    }

    /**
     * Generates a toast message
     * @param message Translation-String of message
     * @param parameters Parameter bindings for translation
     * @param additional: additional parameter objects {link:{caption:string,callback:Function}}
     */
    toast(
        message: string,
        parameters: any = null,
        dialogTitle: string = null,
        dialogMessage: string = null,
        additional: any = null,
    ): void {
        if (
            this.lastToastMessage === message &&
            Date.now() - this.lastToastMessageTime <
                Toast.MIN_TIME_BETWEEN_TOAST
        )
            return;
        this.lastToastMessage = message;
        this.lastToastMessageTime = Date.now();
        this.injector
            .get(TranslateService)
            .get(message, parameters)
            .subscribe((text: any) => {
                if (dialogTitle) {
                    text +=
                        '<br /><a onclick="window[\'toastComponent\'].openDetails()">' +
                        this.injector.get(TranslateService).instant('DETAILS') +
                        '</a>';
                }
                text = this.handleAdditional(text, additional);
                this.dialogParameters = parameters;
                this.toasty.info(this.getToastOptions(text));
                this.dialogTitle = dialogTitle;
                this.dialogMessage = dialogMessage;
            });
    }

    /**
     * Generate a message dialog that a given toolpermission is missing
     * @param toolpermission
     */
    toolpermissionError(permission: string) {
        this.showConfigurableDialog({
            title: 'TOOLPERMISSION_ERROR_TITLE',
            message: this.getToolpermissionMessage(permission),
            isCancelable: true
        })
    }
    /**
     * Generates a toast error message
     */
    error(
        errorObject: any,
        message = 'COMMON_API_ERROR',
        parameters: any = null,
        dialogTitle = '',
        dialogMessage = '',
        additional: any = null,
    ): void {
        let error = errorObject;
        let errorInfo = '';
        let json: any = null;
        if (errorObject) json = errorObject.error;

        try {
            error = json.error + ': ' + json.message;
        } catch (e) {}
        this.dialogTitle = dialogTitle;
        this.dialogMessage = dialogMessage;
        if (message === 'COMMON_API_ERROR') {
            this.dialogMessage = '';
            this.dialogTitle = 'COMMON_API_ERROR_TITLE';
            this.dialogParameters = {
                date: DateHelper.formatDate(
                    this.injector.get(TranslateService),
                    new Date().getTime(),
                    {
                        useRelativeLabels: false,
                        showAlwaysTime: true,
                        showSeconds: true,
                    },
                ),
            };
            try {
                if (json.error.stacktraceArray) {
                    errorInfo = json.stacktraceArray.join('\n');
                }
                if (
                    json.error.indexOf(
                        RestConstants.CONTENT_QUOTA_EXCEPTION,
                    ) !== -1
                ) {
                    message = 'GENERIC_QUOTA_ERROR_TITLE';
                    this.dialogTitle = '';
                }
                if(json.error.indexOf(RestConstants.CONTENT_VIRUS_EXCEPTION)!=-1){
                    message = 'GENERIC_VIRUS_ERROR_TITLE';
                    this.dialogTitle = '';
                }
                else if (
                    json.error.indexOf('DAOToolPermissionException') !== -1
                ) {
                    this.dialogTitle = 'TOOLPERMISSION_ERROR_TITLE';
                    message = 'TOOLPERMISSION_ERROR';
                    const permission = (json ? json.message : error).split(
                        ' ',
                    )[0];
                    this.dialogMessage = this.getToolpermissionMessage(permission);
                } else if (
                    json.error.indexOf('DAORestrictedAccessException') !== -1
                ) {
                    this.dialogTitle = 'RESTRICTED_ACCESS_ERROR_TITLE';
                    this.dialogMessage = 'RESTRICTED_ACCESS_ERROR_MESSAGE';
                } else if (
                    json.error.indexOf('SystemFolderDeleteDeniedException') !==
                    -1
                ) {
                    message = 'SYSTEM_FOLDER_DELETE_ERROR';
                    this.dialogTitle = '';
                } else {
                    this.dialogMessage = '';
                    this.dialogTitle = 'COMMON_API_ERROR_TITLE';
                    if (errorObject) errorInfo = JSON.stringify(json);
                    try {
                        if (json.stacktraceArray) {
                            errorInfo = json.stacktraceArray.join('\n');
                        }
                        if (
                            json.error.indexOf('DAOToolPermissionException') !=
                            -1
                        ) {
                            this.dialogTitle = 'TOOLPERMISSION_ERROR_TITLE';
                            message = 'TOOLPERMISSION_ERROR';
                            const permission = error.split(' ')[0];
                            this.dialogMessage =
                                this.injector
                                    .get(TranslateService)
                                    .instant('TOOLPERMISSION_ERROR_HEADER') +
                                '\n- ' +
                                this.injector
                                    .get(TranslateService)
                                    .instant('TOOLPERMISSION.' + permission) +
                                '\n\n' +
                                this.injector
                                    .get(TranslateService)
                                    .instant('TOOLPERMISSION_ERROR_FOOTER', {
                                        permission,
                                    });
                        } else if (
                            json.error.indexOf(
                                'SystemFolderDeleteDeniedException',
                            ) != -1
                        ) {
                            message = 'SYSTEM_FOLDER_DELETE_ERROR';
                            this.dialogTitle = '';
                        } else if (
                            json.message.indexOf('InvalidLogLevel') != -1
                        ) {
                            errorInfo = json.message;
                        }
                    } catch (e) {}
                }
            } catch (e) {
                error = json;
            }
            if (errorInfo === undefined) {
                errorInfo = '';
            }
            if (errorObject.status === RestConstants.DUPLICATE_NODE_RESPONSE) {
                message = 'WORKSPACE.TOAST.DUPLICATE_NAME';
                parameters = { name };
            } else if (errorObject.status === RestConstants.HTTP_FORBIDDEN) {
                message = 'TOAST.API_FORBIDDEN';
                this.dialogTitle = null;

                const login = this.injector.get(RestConnectorService).getCurrentLogin();
                if (login && login.isGuest) {
                    this.toast('TOAST.API_FORBIDDEN_LOGIN');
                    this.goToLogin();
                    return;
                }
            } else if (errorObject.status == RestConstants.HTTP_UNAUTHORIZED) {
                this.toast('TOAST.API_FORBIDDEN_LOGIN');
                return;
            } else {
                if (!this.dialogMessage) {
                    this.dialogMessage = error + '\n\n' + errorInfo;
                }
                if (!parameters) {
                    parameters = {};
                }
                parameters.error = error;
            }
        }
        if (
            error &&
            error.status ==
                0 /* && this.injector.get(BridgeService).isRunningCordova()*/
        ) {
            message = 'TOAST.NO_CONNECTION';
            this.dialogTitle = null;
        }
        if (
            this.lastToastError == message + JSON.stringify(parameters) &&
            Date.now() - this.lastToastErrorTime < Toast.MIN_TIME_BETWEEN_TOAST
        ) {
            return;
        }
        this.lastToastError = message + JSON.stringify(parameters);
        this.lastToastErrorTime = Date.now();
        this.injector
            .get(TranslateService)
            .get(message, parameters)
            .subscribe((text: any) => {
                if (this.dialogTitle) {
                    text +=
                        '<br /><a onclick="window[\'toastComponent\'].openDetails()">' +
                        this.injector.get(TranslateService).instant('DETAILS') +
                        '</a>';
                }
                text = this.handleAdditional(text, additional);
                this.toasty.error(this.getToastOptions(text));
            });
    }

    goToLogin() {
        this.router.navigate([UIConstants.ROUTER_PREFIX + 'login'], {
            queryParams: { next: window.location },
        });
    }

    onShowModalDialog(param: (params: any) => void) {
        this.onShowModal = param;
    }

    closeModalDialog() {
        this.onShowModal({ title: null, message: null });
        this.isModalDialogOpenSubject.next(false);
    }

    showConfigurableDialog(options: ModalDialogOptions) {
        this.onShowModal(options);
        this.isModalDialogOpenSubject.next(true);
    }

    showModalDialog(
        title: string,
        message: string,
        buttons: DialogButton[],
        isCancelable = true,
        onCancel: () => void = null,
        messageParameters: any = null,
    ) {
        this.showConfigurableDialog({
            title,
            message,
            isCancelable,
            messageParameters,
            onCancel,
            buttons,
        });
    }

    showInputDialog(
        title: string,
        message: string,
        label: string,
        buttons: DialogButton[],
        isCancelable = true,
        onCancel: () => void = null,
        messageParameters: any = null,
    ) {
        this.showConfigurableDialog({
            title,
            message,
            input: label,
            isCancelable,
            messageParameters,
            onCancel,
            buttons,
        });
    }

    showProgressDialog(
        title = 'PROGRESS_DIALOG_DEFAULT_TITLE',
        message = 'PROGRESS_DIALOG_DEFAULT_MESSAGE',
        type = ProgressType.Indeterminate,
    ) {
        this.showConfigurableDialog({ title, message, progressType: type });
    }

    private openDetails(buttons: DialogButton[] = null) {
        this.onShowModal({
            title: this.dialogTitle,
            message: this.dialogMessage,
            messageParameters: this.dialogParameters,
            buttons,
            isCancelable: true,
        });
        this.isModalDialogOpenSubject.next(true);
    }

    private getToastOptions(text: string) {
        const timeout = 8000 + UIAnimation.ANIMATION_TIME_NORMAL;
        return {
            title: '',
            msg: text,
            showClose: true,
            animate: 'scale',
            timeout,
            onAdd: (toast: ToastData) => {
                setTimeout(() => {
                    const elements = document.getElementsByClassName(
                        'toasty-theme-default',
                    );
                    const element: any = elements[elements.length - 1];
                    element.style.opacity = 1;
                    element.style.transform = 'translateY(0)';
                    setTimeout(() => {
                        element.style.opacity = 0;
                    }, timeout - UIAnimation.ANIMATION_TIME_NORMAL);
                }, 10);
            },
            onRemove(toast: ToastData) {},
        };
    }

    private handleAdditional(text: string, additional: any) {
        if (additional && additional.link) {
            text +=
                '<br /><a onclick="window[\'toastComponent\'].linkCallback()">' +
                this.injector
                    .get(TranslateService)
                    .instant(additional.link.caption) +
                '</a>';
            this.linkCallback = additional.link.callback;
        }
        return text;
    }

    private getToolpermissionMessage(permission: string) {
        return this.injector
            .get(TranslateService)
            .instant('TOOLPERMISSION_ERROR_HEADER') +
        '\n- ' +
        this.injector
            .get(TranslateService)
            .instant('TOOLPERMISSION.' + permission) +
        '\n\n' +
        this.injector
            .get(TranslateService)
            .instant('TOOLPERMISSION_ERROR_FOOTER', {
                permission,
            });
    }

    clientConfigError(configKey: string, details: string = null) {
        this.error(null, 'client.config.xml configuration for key (' + configKey + ')' +
            (details ? ': ' + details : '')
        );
    }
}
