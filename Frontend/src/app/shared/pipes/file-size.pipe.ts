import {PipeTransform, Pipe} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Pipe({name: 'formatSize'})
export class FormatSizePipe implements PipeTransform {

  constructor(private translate: TranslateService) {}

  transform(value : any,args:string[] = null): string {
    let names=["bytes","KB","MB","GB","TB"];
    let i=0;
    if(isNaN(value))
      return value;
    if(value==null)
      value=0;
    while(value>=1024 && i<names.length){
      value/=1024;
      i++;
    }
    //return value+" "+names[i];
    return value.toLocaleString(this.translate.currentLang,{maximumFractionDigits:1})+" "+names[i];
  }
}
