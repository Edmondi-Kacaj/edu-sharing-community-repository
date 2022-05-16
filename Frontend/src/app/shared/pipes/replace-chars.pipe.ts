import { Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Pipe({ name: 'replaceChars' })
export class ReplaceCharsPipe implements PipeTransform {
    transform(value: string, args: any): string {
        let i = 0;
        if (!Array.isArray(args.search)) {
            args.search = [args.search];
        }
        if (args.replace && !Array.isArray(args.replace)) {
            args.replace = [args.replace];
        }
        for (let arg of args.search) {
            value = value.split(arg).join(args.replace ? args.replace[i] : '');
            i++;
        }
        return value;
    }
    constructor(private translate: TranslateService) {}
}
