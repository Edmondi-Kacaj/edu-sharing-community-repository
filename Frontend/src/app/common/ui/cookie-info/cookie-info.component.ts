import { trigger } from '@angular/animations';
import { Component, OnInit } from '@angular/core';
import { ConfigurationService, DialogButton } from '../../../core-module/core.module';
import { UIAnimation } from '../../../core-module/ui/ui-animation';
import { CordovaService } from '../../services/cordova.service';

@Component({
    selector: 'cookie-info',
    templateUrl: 'cookie-info.component.html',
    styleUrls: ['cookie-info.component.scss'],
    animations: [
        trigger('fromBottom', UIAnimation.fromBottom(UIAnimation.ANIMATION_TIME_SLOW)),
        trigger('overlay', UIAnimation.openOverlay()),
    ],
})
export class CookieInfoComponent implements OnInit {
    readonly buttons = [
        new DialogButton('COOKIE_INFO.DECLINE', DialogButton.TYPE_CANCEL, () =>
            window.history.back(),
        ),
        new DialogButton('COOKIE_INFO.ACCEPT', DialogButton.TYPE_PRIMARY, () => this.accept()),
    ];
    show = false;
    details = false;

    private readonly storageKey = 'COOKIE_INFO_ACCEPTED';

    constructor(private cordova: CordovaService, private config: ConfigurationService) {}

    async ngOnInit() {
        this.show =
            !this.cordova.isRunningCordova() &&
            localStorage.getItem(this.storageKey) !== 'true' &&
            (await this.config.get('privacy.cookieDisclaimer', false).toPromise());
    }

    accept() {
        localStorage.setItem(this.storageKey, 'true');
        this.show = false;
    }
}
