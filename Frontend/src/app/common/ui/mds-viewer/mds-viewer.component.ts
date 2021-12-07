import {
    Component,
    ComponentFactoryResolver,
    ElementRef,
    Injector,
    Input,
    QueryList,
    ViewChildren,
    ViewContainerRef,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { RestConstants, RestMdsService } from '../../../core-module/core.module';
import { UIHelper } from '../../../core-ui-module/ui-helper';
import { MdsEditorInstanceService } from '../mds-editor/mds-editor-instance.service';
import { ViewInstanceService } from '../mds-editor/mds-editor-view/view-instance.service';
import { Values } from '../mds-editor/types';
import { replaceElementWithDiv } from '../mds-editor/util/replace-element-with-div';
import { MdsViewerInstanceService } from './mds-viewer-instance.service';
import { MdsWidgetComponent } from './widget/mds-widget.component';

@Component({
    selector: 'es-mds-viewer',
    templateUrl: 'mds-viewer.component.html',
    styleUrls: ['mds-viewer.component.scss'],
    providers: [MdsEditorInstanceService, ViewInstanceService, MdsViewerInstanceService],
})
export class MdsViewerComponent {
    @ViewChildren('container') container: QueryList<ElementRef>;

    _groupId: string;
    _setId: string;
    _data: Values;
    mds: any;
    templates: any[];

    @Input() set groupId(groupId: string) {
        this._groupId = groupId;
        this.inflate();
    }

    @Input() set setId(setId: string) {
        this._setId = setId;
        this.mdsService.getSet(setId).subscribe((mds) => {
            this.mds = mds;
            this.inflate();
        });
    }

    @Input() set data(data: Values) {
        this._data = data;
        if (this._data[RestConstants.CM_PROP_METADATASET_EDU_METADATASET] != null) {
            this.mdsService
                .getSet(this._data[RestConstants.CM_PROP_METADATASET_EDU_METADATASET][0])
                .subscribe(async (mds) => {
                    this.mds = mds;
                    await this.inflate();
                });
        } else {
            this.mdsService.getSet().subscribe(async (mds) => {
                this.mds = mds;
                await this.inflate();
            });
        }
    }

    /**
     * show group headings (+ icons) for the individual templates
     */
    @Input() showGroupHeadings = true;

    /**
     * The heading level from 1 to 6 to use for widget labels, equivalent to `h1` to `h6`.
     *
     * Default is 2.
     */
    @Input()
    set headingLevel(value: number) {
        this.viewerInstance.headingLevel = value;
    }
    get headingLevel() {
        return this.viewerInstance.headingLevel;
    }

    constructor(
        private mdsService: RestMdsService,
        private mdsEditorInstanceService: MdsEditorInstanceService,
        private factoryResolver: ComponentFactoryResolver,
        private injector: Injector,
        private containerRef: ViewContainerRef,
        private sanitizer: DomSanitizer,
        private viewerInstance: MdsViewerInstanceService,
    ) {}

    getGroup() {
        return this.mds.groups.find((g: any) => g.id == this._groupId);
    }
    getView(id: string) {
        return this.mds.views.find((v: any) => v.id == id);
    }

    private async inflate() {
        if (!this.mds) {
            setTimeout(() => this.inflate(), 1000 / 60);
            return;
        }
        const editor = await this.mdsEditorInstanceService.initWithoutNodes(
            this._groupId,
            this._setId,
            RestConstants.HOME_REPOSITORY,
            'nodes',
            this._data,
        );
        if (editor === 'legacy') {
            console.error(
                'mds viewer component is only supported for groups with angular rendering',
            );
            return;
        }
        this.templates = [];
        for (const view of this.getGroup().views) {
            const v = this.getView(view);
            this.templates.push({
                view: v,
                html: this.sanitizer.bypassSecurityTrustHtml(this.prepareHTML(v.html)),
            });
        }
        // wait for angular to inflate the new binding
        setTimeout(() => {
            for (const widget of this.mdsEditorInstanceService.widgets.value) {
                // @TODO: it would be better to filter by widgets based on template and condition, should be implemented in 5.1
                this.container.toArray().forEach((c) => {
                    let element: HTMLElement = c.nativeElement.getElementsByTagName(
                        widget.definition.id,
                    )?.[0];
                    if (element) {
                        // MdsEditorViewComponent.updateWidgetWithHTMLAttributes(element, w);
                        element = replaceElementWithDiv(element);

                        UIHelper.injectAngularComponent(
                            this.factoryResolver,
                            this.containerRef,
                            MdsWidgetComponent,
                            element,
                            {
                                widget,
                            },
                            {},
                            this.injector,
                        );
                    }
                });
            }
        });
    }

    /**
     * close all custom tags inside the html which are not closed
     * e.g. <cm:name>
     *     -> <cm:name></cm:name>
     * @param html
     */
    private prepareHTML(html: string) {
        for (const w of this.mds.widgets) {
            const start = html.indexOf('<' + w.id);
            if (start == -1) {
                continue;
            }
            const end = html.indexOf('>', start) + 1;
            html = html.substring(0, end) + '</' + w.id + '>' + html.substring(end);
        }
        return html;
    }
}
