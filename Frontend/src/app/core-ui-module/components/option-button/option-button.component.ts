import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { Node } from '../../../core-module/rest/data-object';
import { NodeHelperService } from '../../node-helper.service';
import { ListTableComponent } from '../list-table/list-table.component';
import {OptionItem} from '../../option-item';

// TODO: Decide if providing focus highlights and ripples with this component is a good idea. When
// using `app-node-url` for cards, we might need highlights and ripples for the whole card while
// `app-node-url` should only wrap the title since links with lots of content confuse screen
// readers.

@Component({
    selector: 'es-option-button',
    template: `
        <button mat-icon-button
                color="primary"
                matTooltip="{{option.name | translate}}"
                [class.display-none]="!optionIsShown(option, node)"
                [disabled]="!optionIsValid(option, node)"
                (click)="optionIsShown(option, node) ? option.callback(node) : null">
            <i icon="{{option.icon}}" [aria]="false"></i>
        </button>
    `,
})
export class OptionButtonComponent {
    @Input() option: OptionItem;
    @Input() node: Node;

    optionIsValid(optionItem: OptionItem, node: Node): boolean {
        if (optionItem.enabledCallback) {
            return optionItem.enabledCallback(node);
        }
        return optionItem.isEnabled;
    }

    optionIsShown(optionItem: OptionItem, node: Node): boolean {
        if (optionItem.showCallback) {
            return optionItem.showCallback(node);
        }
        return true;
    }

}
