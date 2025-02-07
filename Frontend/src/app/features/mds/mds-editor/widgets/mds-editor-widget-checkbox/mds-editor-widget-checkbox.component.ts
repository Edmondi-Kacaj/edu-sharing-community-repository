import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormControl, ValidatorFn } from '@angular/forms';
import { MdsEditorWidgetBase, ValueType } from '../mds-editor-widget-base';

@Component({
    selector: 'es-mds-editor-widget-checkbox',
    templateUrl: './mds-editor-widget-checkbox.component.html',
    styleUrls: ['./mds-editor-widget-checkbox.component.scss'],
})
export class MdsEditorWidgetCheckboxComponent extends MdsEditorWidgetBase implements OnInit {
    readonly valueType: ValueType = ValueType.String;
    formControl: FormControl;
    isIndeterminate: boolean;

    ngOnInit(): void {
        const initialValue = this.widget.getInitialValues().jointValues[0];
        this.isIndeterminate = !!this.widget.getInitialValues().individualValues;
        this.setIndeterminateValues(this.isIndeterminate);
        this.formControl = new FormControl(
            initialValue === 'true',
            this.getStandardValidators({ requiredValidator }),
        );
        this.formControl.valueChanges.subscribe((value: boolean) => {
            this.setValue([value.toString()], this.formControl.dirty);
        });
    }

    onIndeterminateChange(isIndeterminate: boolean): void {
        this.setIndeterminateValues(isIndeterminate);
    }

    private setIndeterminateValues(isIndeterminate: boolean): void {
        if (isIndeterminate) {
            this.widget.setIndeterminateValues(['false', 'true']);
        } else {
            this.widget.setIndeterminateValues(null);
        }
    }
}

const requiredValidator: ValidatorFn = (
    control: AbstractControl,
): { [key: string]: any } | null => {
    const valid = control.value === true;
    return valid ? null : { required: true };
};
