import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal, ComponentType } from '@angular/cdk/portal';
import { Injectable, Injector } from '@angular/core';
import { Observable } from 'rxjs';
import { map, skipWhile, takeUntil, tap } from 'rxjs/operators';
import { CardDialogConfig, CARD_DIALOG_DATA } from './card-dialog-config';
import { CardDialogContainerComponent } from './card-dialog-container/card-dialog-container.component';
import { CardDialogRef } from './card-dialog-ref';
import { CardDialogState, ViewMode } from './card-dialog-state';

// export const CARD_DIALOG_STATE = new InjectionToken<CardDialogState>('CardDialogState');
// export const CARD_DIALOG_OVERLAY_REF = new InjectionToken<CardDialogState>('CardDialogOverlayRef');

/**
 * Provides cards for modal dialogs via overlays, similar to `MatDialog`.
 */
@Injectable({
    providedIn: 'root',
})
export class CardDialogService {
    constructor(
        private injector: Injector,
        private overlay: Overlay,
        private breakpointObserver: BreakpointObserver,
    ) {}

    open<T, D, R>(component: ComponentType<T>, config?: CardDialogConfig<D>): CardDialogRef<D, R> {
        config = this.applyCardConfigDefaults(config);
        const overlayRef = this.createOverlay(config);
        const state = new CardDialogState();
        const containerRef = overlayRef.attach(new ComponentPortal(CardDialogContainerComponent));
        const dialogRef = new CardDialogRef<D, R>(overlayRef, containerRef.instance, config, state);
        containerRef.instance.dialogRef = dialogRef;
        this.registerSizeAndPositionSwitch(overlayRef, dialogRef);
        const contentInjector = Injector.create({
            parent: this.injector,
            providers: [
                { provide: CARD_DIALOG_DATA, useValue: config.data },
                { provide: CardDialogRef, useValue: dialogRef },
            ],
        });
        containerRef.instance.attachComponentPortal(
            new ComponentPortal(component, undefined, contentInjector),
        );
        // Notify the dialog container that the content has been attached.
        containerRef.instance.initializeWithAttachedContent();
        return dialogRef;
    }

    private applyCardConfigDefaults<D>(config: CardDialogConfig<D> = {}): CardDialogConfig<D> {
        return {
            ...new CardDialogConfig<D>(),
            ...config,
        };
    }

    private createOverlay(config: CardDialogConfig): OverlayRef {
        return this.overlay.create({
            hasBackdrop: true,
            panelClass: 'card-dialog-pane',
            positionStrategy: this.overlay
                .position()
                .global()
                .centerHorizontally()
                .centerVertically(),
            scrollStrategy: this.overlay.scrollStrategies.block(),
            height: config.height,
            minHeight: config.minHeight,
            maxHeight: config.maxHeight,
            width: config.width,
            minWidth: config.minWidth,
            maxWidth: config.maxWidth,
        });
    }

    private registerSizeAndPositionSwitch(overlayRef: OverlayRef, dialogRef: CardDialogRef): void {
        this.createViewModeObservable()
            .pipe(
                takeUntil(overlayRef.detachments()),
                tap((viewMode) => dialogRef.patchState({ viewMode })),
                // Don't need to reset, when we haven't switched to mobile view yet.
                skipWhile((mode) => mode === 'default'),
            )
            .subscribe((mode) => {
                switch (mode) {
                    case 'default':
                        this.resetSizeAndPosition(dialogRef.config, overlayRef);
                        break;
                    case 'mobile':
                        this.setMobileSizeAndPosition(overlayRef);
                        break;
                }
            });
    }

    private createViewModeObservable(): Observable<ViewMode> {
        return this.breakpointObserver
            .observe([Breakpoints.XSmall])
            .pipe(map(({ matches }) => (matches ? 'mobile' : 'default')));
    }

    private resetSizeAndPosition(config: CardDialogConfig, overlayRef: OverlayRef): void {
        overlayRef.updateSize({
            height: config.height,
            minHeight: config.minHeight,
            maxHeight: config.maxHeight,
            width: config.width,
            minWidth: config.minWidth,
            maxWidth: config.maxWidth,
        });
        overlayRef.updatePositionStrategy(
            this.overlay.position().global().centerHorizontally().centerVertically(),
        );
    }

    private setMobileSizeAndPosition(overlayRef: OverlayRef): void {
        overlayRef.updateSize({
            maxHeight: 'calc(100% - 25px)',
            minHeight: '80%',
            width: '100%',
            maxWidth: null,
        });
        overlayRef.updatePositionStrategy(this.overlay.position().global().bottom());
    }
}
