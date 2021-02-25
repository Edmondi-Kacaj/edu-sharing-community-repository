import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import {
    MatAutocomplete,
    MatAutocompleteSelectedEvent,
    MatAutocompleteTrigger,
} from '@angular/material/autocomplete';
import { MatChipInputEvent } from '@angular/material/chips';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, combineLatest, from, Observable } from 'rxjs';
import {
    debounceTime,
    distinctUntilChanged,
    filter,
    map,
    startWith,
    switchMap,
} from 'rxjs/operators';
import { MdsEditorInstanceService } from '../../mds-editor-instance.service';
import { MdsWidgetType, MdsWidgetValue } from '../../types';
import { DisplayValue } from '../DisplayValues';
import { MdsEditorWidgetBase, ValueType } from '../mds-editor-widget-base';

@Component({
    selector: 'app-mds-editor-widget-chips',
    templateUrl: './mds-editor-widget-chips.component.html',
    styleUrls: ['./mds-editor-widget-chips.component.scss'],
})
export class MdsEditorWidgetChipsComponent extends MdsEditorWidgetBase implements OnInit {
    @ViewChild('input') input: ElementRef<HTMLInputElement>;
    @ViewChild(MatAutocompleteTrigger, { read: MatAutocompleteTrigger })
    trigger: MatAutocompleteTrigger;
    @ViewChild('auto') matAutocomplete: MatAutocomplete;

    readonly valueType: ValueType = ValueType.MultiValue;
    readonly separatorKeysCodes: number[] = [ENTER, COMMA];
    inputControl = new FormControl();
    chipsControl: FormControl;
    filteredValues: Observable<DisplayValue[]>;
    indeterminateValues$: BehaviorSubject<string[]>;
    showDropdownArrow: boolean;

    constructor(
        mdsEditorInstance: MdsEditorInstanceService,
        translate: TranslateService,
        private changeDetectorRef: ChangeDetectorRef,
    ) {
        super(mdsEditorInstance, translate);
    }

    ngOnInit(): void {
        this.chipsControl = new FormControl(
            [
                ...this.widget.getInitialValues().jointValues,
                ...(this.widget.getInitialValues().individualValues ?? []),
            ].map((value) => this.toDisplayValues(value)),
            this.getStandardValidators(),
        );
        this.indeterminateValues$ = new BehaviorSubject(
            this.widget.getInitialValues().individualValues,
        );
        if (
            this.widget.definition.type === MdsWidgetType.MultiValueBadges ||
            this.widget.definition.type === MdsWidgetType.MultiValueSuggestBadges
        ) {
            this.widget.definition.bottomCaption =
                this.widget.definition.bottomCaption ??
                this.translate.instant('WORKSPACE.EDITOR.HINT_ENTER');
            this.changeDetectorRef.detectChanges();
        }
        this.chipsControl.valueChanges
            .pipe(distinctUntilChanged())
            .subscribe((values: DisplayValue[]) => this.setValue(values.map((value) => value.key)));
        if (
            this.widget.definition.type === MdsWidgetType.MultiValueSuggestBadges ||
            this.widget.definition.type === MdsWidgetType.MultiValueFixedBadges
        ) {
            this.filteredValues = this.subscribeForSuggestionUpdates();
        }
        this.showDropdownArrow =
            this.widget.definition.type === MdsWidgetType.MultiValueFixedBadges &&
            !!this.widget.definition.values;

        this.indeterminateValues$.subscribe((indeterminateValues) =>
            this.widget.setIndeterminateValues(indeterminateValues),
        );
        this.widget.addValue.subscribe((value: MdsWidgetValue) =>
            this.add(this.toDisplayValues(value)),
        );
    }

    onInputTokenEnd(event: MatChipInputEvent): void {
        if (this.widget.definition.type === MdsWidgetType.MultiValueFixedBadges) {
            return;
        }
        const input = event.input;
        const value = (event.value || '').trim();
        if (value) {
            this.add(this.toDisplayValues(value));
        }
        if (input) {
            input.value = '';
        }
    }

    onBlurInput(event: FocusEvent): void {
        // ignore mat option focus to prevent resetting before selection is done
        if ((event.relatedTarget as HTMLElement)?.tagName === 'MAT-OPTION') {
            return;
        }
        this.inputControl.setValue(null);
        if ((event.relatedTarget as HTMLElement)?.tagName === 'MAT-CHIP') {
            // `matAutocomplete` doesn't seem to close the autocomplete panel when focus goes to
            // chips, however, navigating the autocomplete options by keyboard doesn't work when the
            // input doesn't have the focus.
            //
            // We don't generally close the panel on blur, so the toggle button doesn't get
            // confused.
            this.trigger.closePanel();
        }
    }

    toggleAutoCompletePanel(): void {
        if (this.trigger.panelOpen) {
            this.trigger.closePanel();
        } else {
            this.trigger.openPanel();
            this.input.nativeElement.focus();
        }
    }

    remove(toBeRemoved: DisplayValue): void {
        const values: DisplayValue[] = this.chipsControl.value;
        if (values.includes(toBeRemoved)) {
            this.chipsControl.setValue(values.filter((value) => value !== toBeRemoved));
        }
        this.removeFromIndeterminateValues(toBeRemoved.key);
    }

    selected(event: MatAutocompleteSelectedEvent) {
        this.add(event.option.value);
        this.input.nativeElement.value = '';
        this.inputControl.setValue(null);
        setTimeout(() => this.trigger.openPanel());
    }

    focus() {
        this.input?.nativeElement?.focus();
    }

    add(value: DisplayValue): void {
        if (!this.chipsControl.value.some((v: DisplayValue) => v.key === value.key)) {
            this.chipsControl.setValue([...this.chipsControl.value, value]);
        }
        this.removeFromIndeterminateValues(value.key);
    }

    private removeFromIndeterminateValues(key: string): void {
        const indeterminateValues = this.indeterminateValues$.value;
        if (key && indeterminateValues?.includes(key)) {
            indeterminateValues.splice(indeterminateValues.indexOf(key), 1);
            this.indeterminateValues$.next(indeterminateValues);
        }
    }

    private subscribeForSuggestionUpdates(): Observable<DisplayValue[]> {
        // Combine observables to update suggestions when either the input field or currently
        // selected values change.
        return combineLatest([
            this.inputControl.valueChanges.pipe(
                startWith(null as string),
                filter(
                    (value: string | null | DisplayValue) =>
                        typeof value === 'string' || value === null,
                ),
                debounceTime(200),
                distinctUntilChanged(),
            ) as Observable<string | null>,
            this.chipsControl.valueChanges.pipe(
                startWith(this.chipsControl.value),
                distinctUntilChanged(),
            ),
        ]).pipe(
            switchMap(([filterString, selectedValues]) =>
                this.filter(filterString, selectedValues),
            ),
        );
    }

    private toDisplayValues(value: MdsWidgetValue | string): DisplayValue {
        if (typeof value === 'string') {
            const knownValue = this.widget.definition.values?.find((v) => v.id === value);
            if (knownValue) {
                value = knownValue;
            } else {
                return {
                    key: value,
                    label: value,
                };
            }
        }
        return {
            key: value.id,
            label: value.caption,
        };
    }

    private filter(
        filterString: string | null,
        selectedValues: DisplayValue[],
    ): Observable<DisplayValue[]> {
        return from(this.widget.getSuggestedValues(filterString)).pipe(
            map((suggestedValues) =>
                suggestedValues
                    .map((suggestedValue) => this.toDisplayValues(suggestedValue))
                    .filter((suggestedValue) =>
                        selectedValues.every(
                            (selectedValue) => suggestedValue.key !== selectedValue.key,
                        ),
                    ),
            ),
        );
    }
}
