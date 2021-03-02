import {
    Component,
    ElementRef,
    EventEmitter,
    Input,
    Output,
    ViewChild,
} from '@angular/core';
import { UIHelper } from '../../ui-helper';
import { FloatLabelType } from '@angular/material/form-field';

@Component({
    selector: 'input-password',
    templateUrl: 'input-password.component.html',
    styleUrls: ['input-password.component.scss'],
})
export class InputPasswordComponent {
    @Input() id = 'passwordInput';
    @Input() required = false;
    @Input() autocomplete: string;
    @Input() inputClass = '';
    @Input() hint = '';
    @Input() label = '';
    @Input() floatLabel: FloatLabelType = 'auto';
    @Input() displayStrength = false;
    @Input() placeholder = '';
    @Input() set value(_value: string) {
        this._value = _value;
        this.valueChange.emit(_value);
        this.passwordStrength = UIHelper.getPasswordStrengthString(_value);
    }
    get value() {
        return this._value;
    }

    @Output() valueChange = new EventEmitter();
    @Output() change = new EventEmitter();
    @Output() keydown = new EventEmitter();
    @Output() keyup = new EventEmitter();
    @Output() ngModelChange = new EventEmitter();

    @ViewChild('input') nativeInput: ElementRef;

    passwordStrength: string;
    showPassword = false;
    
    private _value: string;

    getInputType(): string {
        if (this.showPassword) {
            return 'text';
        } else {
            return 'password';
        }
    }

    getShowPasswordLabel(): string {
        if (this.showPassword) {
            return 'LOGIN.HIDE_PASSWORD';
        } else {
            return 'LOGIN.SHOW_PASSWORD';
        }
    }
}
