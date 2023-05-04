import { NgModule } from '@angular/core';
import { MdsModule } from '../../features/mds/mds.module';
import { SharedModule } from '../../shared/shared.module';
import { RepositoryIconPipe } from './repository-icon.pipe';
import { SearchPageFilterBarComponent } from './search-page-filter-bar.component';
import { SearchPageResultsAllComponent } from './search-page-results-all.component';
import { SearchPageResultsComponent } from './search-page-results.component';
import { SearchPageRoutingModule } from './search-page-routing.module';
import { SearchPageToolbarComponent } from './search-page-toolbar.component';
import { SearchPageComponent } from './search-page.component';
import { SmallCollectionComponent } from './small-collection/small-collection.component';
import { EduSharingUiModule } from 'ngx-edu-sharing-ui';

@NgModule({
    declarations: [
        SmallCollectionComponent,
        SearchPageComponent,
        SearchPageToolbarComponent,
        SearchPageFilterBarComponent,
        RepositoryIconPipe,
        SearchPageResultsComponent,
        SearchPageResultsAllComponent,
    ],
    imports: [SearchPageRoutingModule, SharedModule, EduSharingUiModule, MdsModule],
    exports: [SmallCollectionComponent],
})
export class SearchPageModule {}
