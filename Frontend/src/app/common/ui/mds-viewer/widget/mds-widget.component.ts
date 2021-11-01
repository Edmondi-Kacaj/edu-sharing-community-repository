import {Component, Input, OnInit} from '@angular/core';
import {MdsEditorWidgetBase, ValueType} from '../../mds-editor/widgets/mds-editor-widget-base';
import {Widget} from '../../mds-editor/mds-editor-instance.service';
import {RestConstants} from '../../../../core-module/rest/rest-constants';
import {FormatSizePipe} from '../../../../core-ui-module/pipes/file-size.pipe';
import {DatePipe} from '@angular/common';
import {NodeDatePipe} from '../../../../core-ui-module/pipes/date.pipe';
import {DateHelper} from '../../../../core-ui-module/DateHelper';

@Component({
    selector: 'mds-widget',
    templateUrl: 'mds-widget.component.html',
    styleUrls: ['mds-widget.component.scss'],
})
export class MdsWidgetComponent extends MdsEditorWidgetBase implements OnInit{
    readonly valueType = ValueType.String;
    value:string[];
    @Input() widget: Widget;

    getBasicType() {
        switch(this.widget.definition.type) {
            case 'text':
            case 'email':
            case 'month':
            case 'color':
            case 'textarea':
            case 'singleoption':
                return 'text';
            case 'number':
                return 'number';
            case 'date':
                return 'date';
            case 'vcard':
                return 'vcard';
            case 'multivalueFixedBadges':
            case 'multivalueSuggestBadges':
            case 'multivalueBadges':
            case 'multivalueTree':
                return 'array';
            case 'slider':
                return 'slider';
            case 'duration':
                return 'duration';
            case 'range':
                return 'range';
        }
        return 'unknown';
    }
    ngOnInit(): void {
        if(this.widget.definition.type === 'range') {
            const id = this.widget.definition.id;
            const values = this.mdsEditorInstance.values$.value;
            this.value = [values[id + '_from']?.[0], values[id + '_to']?.[0]];
        } else if (this.widget.getInitialValues()?.jointValues) {
            this.value = this.getValue(this.widget.getInitialValues().jointValues);
        }
    }
    getValue(data: string[]) {
        let value = data;
        if(!value || !value[0]) {
            return null;
        }
        if(this.widget.definition.values) {
            const mapping=this.widget.definition.values.filter((v:any) => data.filter((d) => d === v.id).length > 0).map((v) => v.caption);
            if(mapping){
                return mapping;
            }
        }
        return data;
    }
    refresh() {
        this.ngOnInit();
    }

    click() {
        if(this.widget.definition.link === '_BLANK') {
            window.open(this.value[0]);
        } else {
            console.warn('Unsupported link type ' + this.widget.definition.link);
        }
    }

    isEmpty() {
        return this.value?.every((v) => !v) || this.value?.length === 0 || !this.value;
    }
    formatDate() {
        return this.value.map((v) => {
            if(this.widget.definition.format) {
                return new DatePipe(null).transform(v, this.widget.definition.format);
            } else {
                return DateHelper.formatDate(this.translate,v,{
                    showAlwaysTime: true
                });
            }
        });
    }
    formatNumber() {
        return this.value.map((v) => {
            if(this.widget.definition.format === 'bytes') {
                return new FormatSizePipe().transform(v);
            }
            return v;
        });
    }
}
