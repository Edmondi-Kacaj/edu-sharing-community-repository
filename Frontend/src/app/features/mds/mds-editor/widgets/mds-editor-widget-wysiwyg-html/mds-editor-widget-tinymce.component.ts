import {AfterViewInit, Component, OnInit, ViewChild} from '@angular/core';
import {AbstractControl, AbstractControlDirective, FormControl, ValidatorFn} from '@angular/forms';
import { MdsEditorWidgetBase, ValueType } from '../mds-editor-widget-base';
import {TranslateService} from '@ngx-translate/core';
import {MdsEditorInstanceService} from '../../mds-editor-instance.service';
import {EditorComponent} from '@tinymce/tinymce-angular';
import {EventObj} from '@tinymce/tinymce-angular/editor/Events';
import {PlatformLocation} from '@angular/common';
import {
    MdsEditorWidgetContainerComponent
} from '../mds-editor-widget-container/mds-editor-widget-container.component';

@Component({
    selector: 'es-mds-editor-widget-checkbox',
    templateUrl: './mds-editor-widget-tinymce.component.html',
    styleUrls: ['./mds-editor-widget-tinymce.component.scss'],
})
export class MdsEditorWidgetTinyMCE extends MdsEditorWidgetBase implements OnInit, AfterViewInit {
    @ViewChild(EditorComponent) editorComponent: EditorComponent;
    @ViewChild(MdsEditorWidgetContainerComponent) containerComponent: MdsEditorWidgetContainerComponent;
    readonly valueType: ValueType = ValueType.String;
    private editorConfigDefault = {
        branding: false,
        height: 200,
        base_url: this.platformLocation.getBaseHrefFromDOM() + 'tinymce',
        suffix: '.min',
        menubar: false,
        statusbar: false,
        resize: true,
        plugins: ['link'],
        toolbar:
            'h1 h2 h3 h4 | bold italic underline | link | alignleft aligncenter alignright alignjustify | removeformat | undo redo',
        language: this.translate.getDefaultLang()
    };
    editorConfig: Record<string, any>;
    _html = '';
    dummyControl = new FormControl();
    get html() {
        return this._html;
    }
    set html(html: string) {
        this._html = html;
        this.setValue([html]);
    }
    constructor(
        private platformLocation: PlatformLocation,
        public mdsEditorInstance: MdsEditorInstanceService,
        protected translate: TranslateService,
    ) {
       super(mdsEditorInstance, translate);
    }
    ngOnInit(): void {
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

    focus(): void {
        this.editorComponent.editor.focus();
        // this.editor.editorElem.focus();
    }

    blur(): void {
        this.editorComponent.editor.blur();
    }

    ngAfterViewInit(): void {
        this._html = this.widget.getInitialValues().jointValues[0];
        if(this.widget.definition.configuration) {
            this.editorConfig = {...this.editorConfigDefault, ...JSON.parse(this.widget.definition.configuration)};
        } else {
            this.editorConfig = this.editorConfigDefault;
        }
        // dirty workaround for tinyMCE
        setTimeout(() => {
            this.editorComponent.editor.mode.set(this.dummyControl.disabled ? 'readonly' : 'design')
            this.dummyControl.registerOnDisabledChange(isDisabled =>
                this.editorComponent.editor.mode.set(isDisabled ? 'readonly' : 'design')
            );
        });
    }
}
