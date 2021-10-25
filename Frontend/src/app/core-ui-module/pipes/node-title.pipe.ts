import {PipeTransform, Pipe} from '@angular/core';
import {TranslateService} from "@ngx-translate/core";
import {RestHelper} from '../../core-module/core.module';
import {Node} from '../../core-module/core.module';

@Pipe({name: 'nodeTitle'})
export class NodeTitlePipe implements PipeTransform {
  transform(node : Node,args:string[] = null): string {
    return RestHelper.getTitle(node);
  }
  constructor(private translate : TranslateService){}
}
