import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, DatePipe],
  template: `
    <div class="view-container">
      <div class="search-header">
        <div class="search-card">
          <span class="search-icon">🔍</span>
          <input 
            type="text" 
            [(ngModel)]="searchTerm" 
            (keyup.enter)="onSearch()"
            placeholder="Buscar en logs..." 
            class="search-input"
          />
        </div>
        
        <button (click)="loadLogs()" class="btn-action" [class.loading]="isLoading">
          <span class="icon">🔄</span>
          <span class="text">{{ isLoading ? 'Cargando...' : 'Actualizar' }}</span>
        </button>
      </div>

      <div class="content-card">
        <div class="table-container">
          <table class="modern-table">
            <thead>
              <tr>
                <th (click)="sortByColumn('id')" class="sortable">
                  <div class="th-content">
                    ID <span class="sort-icon" *ngIf="sortBy === 'id'">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
                  </div>
                </th>
                <th (click)="sortByColumn('created_at')" class="sortable">
                  <div class="th-content">
                    FECHA/HORA <span class="sort-icon" *ngIf="sortBy === 'created_at'">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
                  </div>
                </th>
                <th (click)="sortByColumn('categoria')" class="sortable">
                  <div class="th-content">
                    CATEGORÍA <span class="sort-icon" *ngIf="sortBy === 'categoria'">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
                  </div>
                </th>
                <th (click)="sortByColumn('filename')" class="sortable">
                  <div class="th-content">
                    ARCHIVO <span class="sort-icon" *ngIf="sortBy === 'filename'">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
                  </div>
                </th>
                <th (click)="sortByColumn('action')" class="sortable">
                  <div class="th-content">
                    ACCIÓN <span class="sort-icon" *ngIf="sortBy === 'action'">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
                  </div>
                </th>
                <th (click)="sortByColumn('records_processed')" class="sortable text-right">
                  <div class="th-content j-end">
                    RÉCORDS <span class="sort-icon" *ngIf="sortBy === 'records_processed'">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let log of logs">
                <td class="id-badge">#{{ log.id }}</td>
                <td class="timestamp">{{ log.created_at | date:'dd/MM/yyyy HH:mm' }}</td>
                <td>
                  <span class="modern-badge category-{{ log.categoria }}">
                    {{ log.categoria || 'N/A' | uppercase }}
                  </span>
                </td>
                <td class="filename">{{ log.filename || '-' }}</td>
                <td>
                  <span class="status-indicator" 
                        [class.success]="log.action.includes('Recibido') || log.action.includes('éxito')"
                        [class.error]="log.action.includes('Error') || log.action.includes('Fallo')">
                    {{ log.action }}
                  </span>
                </td>
                <td class="text-right font-medium">{{ log.records_processed }}</td>
              </tr>
              <tr *ngIf="logs.length === 0 && !isLoading">
                <td colspan="6" class="empty-row">No se encontraron registros de auditoría.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="footer-pagination">
          <div class="pagination-info">
             {{ (currentPage - 1) * perPage + 1 }} - {{ math.min(currentPage * perPage, totalItems) }} de {{ totalItems }}
          </div>
          
          <div class="pagination-controls">
            <div class="per-page-group">
              <span class="label">Ítems por página:</span>
              <select [(ngModel)]="perPage" (change)="onPerPageChange()" class="compact-select">
                <option [ngValue]="5">5</option>
                <option [ngValue]="10">10</option>
                <option [ngValue]="25">25</option>
                <option [ngValue]="50">50</option>
                <option [ngValue]="100">100</option>
              </select>
            </div>
            
            <div class="nav-buttons">
              <button (click)="changePage(currentPage - 1)" [disabled]="currentPage === 1 || isLoading" class="btn-nav">‹</button>
              <button (click)="changePage(currentPage + 1)" [disabled]="currentPage === lastPage || isLoading" class="btn-nav">›</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      background-color: #f8fafc;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }

    .view-container {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 24px;
      min-height: 100vh;
      box-sizing: border-box;
    }

    .search-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .search-card {
      background: white;
      border-radius: 8px;
      padding: 0 16px;
      display: flex;
      align-items: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      border: 1px solid #e2e8f0;
      width: 100%;
      max-width: 400px;
      height: 48px;

      .search-icon { color: #94a3b8; margin-right: 12px; }
      .search-input { border: none; outline: none; width: 100%; font-size: 15px; }
    }

    .btn-action {
      background: #1e293b;
      color: white;
      border: none;
      border-radius: 8px;
      height: 40px;
      padding: 0 20px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;

      &:hover { background: #0f172a; }
      &.loading .icon { animation: spin 1s linear infinite; }
    }

    .content-card {
      background: white;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      border: 1px solid #e2e8f0;
      overflow: visible;
      flex: none;
    }

    .table-container { overflow-x: auto; }

    .modern-table {
      width: 100%;
      border-collapse: collapse;
      
      th {
        padding: 14px 24px;
        color: #64748b;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        border-bottom: 1px solid #f1f5f9;
        position: sticky;
        top: 0;
        background: #fcfcfc;
        z-index: 10;
        cursor: pointer;

        .th-content { display: flex; align-items: center; gap: 8px; }
        .j-end { justify-content: flex-end; }
        .sort-icon { color: #3b82f6; }
      }

      td {
        padding: 16px 24px;
        border-bottom: 1px solid #f1f5f9;
        color: #334155;
        font-size: 14px;
      }

      tr:hover td { background-color: #f8fafc; }
    }

    .modern-badge {
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
    }

    .category-cartera { background: #eff6ff; color: #1d4ed8; }
    .category-op { background: #f0fdf4; color: #15803d; }
    .category-pagos { background: #fff7ed; color: #9a3412; }
    .category-opf { background: #faf5ff; color: #7e22ce; }

    .status-indicator {
      font-weight: 600;
      &.success { color: #10b981; }
      &.error { color: #ef4444; }
    }

    .footer-pagination {
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #fcfcfc;
      border-top: 1px solid #f1f5f9;
      color: #64748b;
      font-size: 13px;
    }

    .pagination-controls { display: flex; align-items: center; gap: 32px; }
    .per-page-group { display: flex; align-items: center; gap: 12px; }
    .compact-select { border: none; background: none; font-weight: 600; cursor: pointer; color: #1e293b; }
    .nav-buttons { display: flex; gap: 8px; }
    .btn-nav { width: 32px; height: 32px; border: 1px solid #e2e8f0; background: white; border-radius: 6px; cursor: pointer; }

    .id-badge { color: #94a3b8; font-weight: 500; width: 60px; }
    .timestamp { color: #64748b; width: 150px; }
    .filename { color: #0284c7; font-weight: 500; }
    .text-right { text-align: right; }
    .font-medium { font-weight: 500; }
    .empty-row { padding: 48px; text-align: center; color: #94a3b8; }

    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  `]
})
export class LogsComponent implements OnInit {
  logs: any[] = [];
  isLoading = false;
  math = Math;

  // Parámetros de tabla
  searchTerm: string = '';
  sortBy: string = 'id';
  sortDir: 'desc' | 'asc' = 'desc';
  currentPage: number = 1;
  lastPage: number = 1;
  totalItems: number = 0;
  perPage: number = 5;

  // TODO: Use environment variable instead of hardcoded URL in production
  private apiUrl = 'http://localhost:8000/api/logs';

  constructor(private http: HttpClient) { }

  ngOnInit() {
    this.loadLogs();
  }

  loadLogs() {
    this.isLoading = true;

    // Construir URL con parámetros
    const url = new URL(this.apiUrl);
    if (this.searchTerm) url.searchParams.append('search', this.searchTerm);
    if (this.sortBy) url.searchParams.append('sortBy', this.sortBy);
    if (this.sortDir) url.searchParams.append('sortDir', this.sortDir);
    url.searchParams.append('page', this.currentPage.toString());
    url.searchParams.append('perPage', this.perPage.toString());

    this.http.get<any>(url.toString()).subscribe({
      next: (response) => {
        // Paginación Laravel: response.data contiene los array
        this.logs = response.data || response;
        this.currentPage = response.current_page || 1;
        this.lastPage = response.last_page || 1;
        this.totalItems = response.total || 0;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error fetching logs', error);
        this.logs = [];
        this.isLoading = false;
      }
    });
  }

  onSearch() {
    this.currentPage = 1;
    this.loadLogs();
  }

  onPerPageChange() {
    this.currentPage = 1;
    this.loadLogs();
  }

  sortByColumn(col: string) {
    if (this.sortBy === col) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = col;
      this.sortDir = 'asc';
    }
    this.loadLogs();
  }

  changePage(page: number) {
    if (page >= 1 && page <= this.lastPage) {
      this.currentPage = page;
      this.loadLogs();
    }
  }
}
