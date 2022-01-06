import {first, filter} from 'rxjs/operators';
import {Component, ElementRef, Input, OnInit, ViewChild} from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Node } from '../../../../../core-module/rest/data-object';
import { RestConstants } from '../../../../../core-module/rest/rest-constants';
import { RestIamService } from '../../../../../core-module/rest/services/rest-iam.service';
import { UIService } from '../../../../../core-module/rest/services/ui.service';
import { VCard } from '../../../../../core-module/ui/VCard';
import { MainNavService } from '../../../../services/main-nav.service';
import { MdsEditorInstanceService } from '../../mds-editor-instance.service';
import { NativeWidgetComponent } from '../../mds-editor-view/mds-editor-view.component';
import { Values } from '../../types';
import {MdsEditorWidgetBase, ValueType} from '../mds-editor-widget-base';
import {FormControl, FormGroup} from '@angular/forms';
import {TranslateService} from '@ngx-translate/core';
import {Toast} from '../../../../../core-ui-module/toast';
import {DateHelper} from '../../../../../core-ui-module/DateHelper';

export interface AuthorData {
    freetext: string;
    author: VCard;
}

@Component({
    selector: 'es-mds-editor-widget-vcard',
    templateUrl: './mds-editor-widget-vcard.component.html',
    styleUrls: ['./mds-editor-widget-vcard.component.scss'],
})
export class MdsEditorWidgetVCardComponent extends MdsEditorWidgetBase implements OnInit {
    static readonly constraints = {
        requiresNode: true,
        supportsBulk: false,
    };
    @ViewChild('inputElement') inputElement: ElementRef;
    @ViewChild('textAreaElement') textAreaElement: ElementRef;
    readonly valueType: ValueType = ValueType.String;

    formControl: FormGroup;

    constructor(
        mdsEditorInstance: MdsEditorInstanceService,
        translate: TranslateService,
        private toast: Toast,
    ) {
        super(mdsEditorInstance, translate);
    }

    ngOnInit(): void {
        let initialValue = this.widget.getInitialValues().jointValues;
        if(!initialValue) {
            initialValue = [''];
        }
        const vcard = new VCard(initialValue[0]);
        this.formControl = new FormGroup({
            givenname: new FormControl(vcard.givenname),
            surname: new FormControl(vcard.surname),
        }, this.getStandardValidators());
        this.formControl.valueChanges.pipe(
            filter((value) => value !== null))
            .subscribe((value) => {
                vcard.givenname = value.givenname;
                vcard.surname = value.surname;
                let result = initialValue.slice();
                if(vcard.isValid()) {
                    result[0] = vcard.toVCardString();
                } else {
                    result = initialValue.slice(1);
                }
                this.setValue(result);
            });
    }

    focus(): void {
        this.inputElement?.nativeElement?.focus();
        this.textAreaElement?.nativeElement?.focus();
    }

    blur(): void {
        this.onBlur.emit();
    }

}
