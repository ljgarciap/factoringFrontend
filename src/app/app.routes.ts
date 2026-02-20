import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { LogsComponent } from './components/logs/logs.component';
import { SheetsComponent } from './components/sheets/sheets.component';
import { UploadComponent } from './components/upload/upload.component';

export const routes: Routes = [
    { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    { path: 'dashboard', component: DashboardComponent },
    { path: 'logs', component: LogsComponent },
    { path: 'sheets', component: SheetsComponent },
    { path: 'upload', component: UploadComponent },
];
