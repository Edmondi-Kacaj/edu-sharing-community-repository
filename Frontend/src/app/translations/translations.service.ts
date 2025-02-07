import { Injectable } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Observable, of as observableOf } from 'rxjs';
import { first, map, switchMap, tap } from 'rxjs/operators';
import { BridgeService } from '../core-bridge-module/bridge.service';
import { ConfigurationService, SessionStorageService } from '../core-module/core.module';
import { LANGUAGES } from './languages';

// 'none' means that only labels should be shown (for dev)
const DEFAULT_SUPPORTED_LANGUAGES = ['de', 'en', 'none'];

@Injectable({ providedIn: 'root' })
export class TranslationsService {
    private language: string;
    private languageLoaded = new BehaviorSubject(false);

    constructor(
        private bridge: BridgeService,
        private config: ConfigurationService,
        private route: ActivatedRoute,
        private storage: SessionStorageService,
        private translate: TranslateService,
    ) {}

    /**
     * Determines and configures the language to use and triggers loading of translations with
     * ngx-translate.
     *
     * Call this once in the app component.
     */
    initialize(): Observable<void> {
        const supportedLanguages$: Observable<string[]> = this.config.get(
            'supportedLanguages',
            DEFAULT_SUPPORTED_LANGUAGES,
        );
        if (this.bridge.isRunningCordova()) {
            return supportedLanguages$.pipe(
                switchMap((supportedLanguages: string[]) =>
                    this.initializeCordova(supportedLanguages),
                ),
                map(() => void 0),
            );
        }
        supportedLanguages$
            .pipe(
                tap((supportedLanguages: string[]) => this.translate.addLangs(supportedLanguages)),
                // Select queryParams.locale if set meaningfully
                switchMap((supportedLanguages: string[]) =>
                    this.route.queryParams.pipe(
                        first(),
                        map((params) => {
                            let selectedLanguage: string = null;
                            if (supportedLanguages.indexOf(params.locale) !== -1) {
                                selectedLanguage = params.locale;
                            } else if (params.locale) {
                                console.warn(
                                    `Url requested language ${params.locale}, ` +
                                        'but it was not found or is not configured in the allowed languages: ' +
                                        supportedLanguages,
                                );
                            }
                            return {
                                supportedLanguages,
                                selectedLanguage,
                            };
                        }),
                    ),
                ),
                // Select storage.get('language') if set meaningfully
                switchMap(({ supportedLanguages, selectedLanguage }) => {
                    if (selectedLanguage) {
                        return observableOf({
                            supportedLanguages,
                            selectedLanguage,
                            useStored: false,
                        });
                    } else {
                        return this.storage.get('language').pipe(
                            map((storageLanguage) => {
                                let useStored = false;
                                if (supportedLanguages.indexOf(storageLanguage) !== -1) {
                                    selectedLanguage = storageLanguage;
                                    useStored = true;
                                }
                                return {
                                    supportedLanguages,
                                    selectedLanguage,
                                    useStored,
                                };
                            }),
                        );
                    }
                }),
                // Use browser language if available, otherwise fall back to the first supported
                // language.
                map(({ supportedLanguages, selectedLanguage, useStored }) => {
                    if (selectedLanguage) {
                        return {
                            supportedLanguages,
                            selectedLanguage,
                            useStored,
                        };
                    } else if (
                        // Select browser language if set meaningfully
                        supportedLanguages.indexOf(this.translate.getBrowserLang()) !== -1
                    ) {
                        return {
                            supportedLanguages,
                            selectedLanguage: this.translate.getBrowserLang(),
                            useStored,
                        };
                    } else {
                        // Select first supported language
                        return {
                            supportedLanguages,
                            selectedLanguage: supportedLanguages[0],
                            useStored,
                        };
                    }
                }),
                // Set fallback language
                tap(({ supportedLanguages, selectedLanguage, useStored }) => {
                    if (!useStored) {
                        this.storage.set('language', selectedLanguage);
                    }
                    if (selectedLanguage === 'none') {
                        this.translate.setDefaultLang('none');
                    } else {
                        this.translate.setDefaultLang(supportedLanguages[0]);
                    }
                }),
                // Configure `ngx-translate` to use the determined language and trigger loading of
                // translations.
                switchMap(({ selectedLanguage }) => {
                    // console.log('language used: ' + selectedLanguage);
                    this.language = selectedLanguage;
                    return this.translate.use(selectedLanguage).pipe(map(() => void 0));
                }),
            )
            .subscribe(() => {
                // Notify anyone waiting for translations to be loaded.
                this.languageLoaded.next(true);
            });
        return this.waitForInit();
    }

    private initializeCordova(supportedLanguages = DEFAULT_SUPPORTED_LANGUAGES) {
        this.translate.addLangs(supportedLanguages);
        let language = supportedLanguages[0];
        this.translate.setDefaultLang(language);
        this.translate.use(language);
        this.language = language;
        this.bridge
            .getCordova()
            .getLanguage()
            .subscribe((data: string) => {
                if (supportedLanguages.indexOf(data) != -1) {
                    language = data;
                }
                this.language = language;
                this.translate.use(language).subscribe(() => {
                    this.languageLoaded.next(true);
                });
                // this.translate.getTranslation(language).subscribe(() => {
                // });
            });
        return this.waitForInit();
    }

    waitForInit(): Observable<void> {
        return this.languageLoaded.pipe(
            first((languageLoaded) => languageLoaded),
            map(() => void 0),
        );
    }

    /** Same as `translate.currentLang`. */
    getLanguage(): string {
        return this.language;
    }

    getISOLanguage(): string {
        return LANGUAGES[this.language];
    }
}
