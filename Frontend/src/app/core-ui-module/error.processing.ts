import {Injectable} from '@angular/core';
import {Toast} from './toast';
import { Observable, Subscription} from 'rxjs';

@Injectable()
export class ErrorProcessingService {
    constructor(private toast: Toast) {
    }

    /**
     * handle a rest request including automatically showing and cancelling progress dialogs
     * and showing mapped error messages if the api failed
     */
    handleRestRequest<T>(request: Observable<T>, showProgress = true): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            if (showProgress) {
                this.toast.showProgressDialog();
            }
            request.subscribe((result) => {
                if(showProgress) {
                    this.toast.closeModalDialog();
                }
                resolve(result)
            }, (error) => {
                if (showProgress) {
                    this.toast.closeModalDialog()
                }
                this.toast.error(error);
                reject(error);
            });
        });
    }
}
