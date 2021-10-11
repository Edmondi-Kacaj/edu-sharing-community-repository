import { Component, OnInit } from '@angular/core';
import {NativeWidgetComponent} from '../../mds-editor-view/mds-editor-view.component';
import {BehaviorSubject} from 'rxjs';
import {MdsEditorInstanceService} from '../../mds-editor-instance.service';
import {RestConstants} from '../../../../../core-module/rest/rest-constants';

@Component({
    selector: 'app-mds-editor-widget-version',
    templateUrl: './mds-editor-widget-version.component.html',
    styleUrls: ['./mds-editor-widget-version.component.scss'],
})
export class MdsEditorWidgetVersionComponent implements OnInit, NativeWidgetComponent {
    static readonly constraints = {
        requiresNode: true,
        supportsBulk: false,
    };
    hasChanges = new BehaviorSubject<boolean>(false);

    comment: string;
    file: File;
    show: boolean;

    constructor(
        private mdsEditorValues: MdsEditorInstanceService,
    ) {}

    ngOnInit(): void {
        this.mdsEditorValues.nodes$.subscribe((nodes) =>
            this.show = nodes.some((n) =>
                !n?.properties[RestConstants.CCM_PROP_IO_WWWURL]?.[0]
            )
        );
    }

    onChange(): void {
        this.updateState();
    }

    setFile(event: Event) {
        this.file = (event.target as HTMLInputElement).files?.[0];
        this.updateState();
    }

    private updateState() {
        this.hasChanges.next(!!this.comment || !!this.file);
    }
}
