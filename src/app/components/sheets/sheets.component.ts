import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule, HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-sheets',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  template: `
    <div class="view-container">
      <div class="search-header">
        <div class="search-card">
          <span class="search-icon">🔍</span>
          <input 
            type="text" 
            [(ngModel)]="searchTerm" 
            (keyup.enter)="onSearch()"
            placeholder="Buscar registros..." 
            class="search-input"
          />
        </div>
        
        <div class="actions-group">
          <div class="category-wrapper">
            <select [(ngModel)]="categoria" (change)="onCategoryChange()" class="modern-select">
              <option value="cartera">Cartera</option>
              <option value="op">Factoring Op</option>
              <option value="pagos">Factoring Pagos</option>
              <option value="opf">Confirming</option>
            </select>
          </div>
          <button (click)="loadHistory()" class="btn-action" [class.loading]="isLoading">
            <span class="icon">🔄</span>
            <span class="text">{{ isLoading ? 'Cargando...' : 'Actualizar' }}</span>
          </button>
        </div>
      </div>

      <div class="content-card">
        <div class="table-container">
          <table class="modern-table">
            <thead>
              <tr>
                <th 
                  *ngFor="let col of getColumns()" 
                  (click)="sortByColumn(col)"
                  [class.sortable]="true"
                >
                  <div class="th-content">
                    {{ formatHeader(col) }}
                    <span class="sort-icon" *ngIf="sortBy === col">
                      {{ sortDir === 'asc' ? '↑' : '↓' }}
                    </span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of data">
                <td *ngFor="let col of getColumns()">
                  <ng-container [ngSwitch]="col">
                    <ng-container *ngSwitchCase="'id'">
                      <span class="id-badge">#{{ row[col] }}</span>
                    </ng-container>
                    
                    <!-- Editable Fields for Cartera -->
                    <ng-container *ngSwitchCase="'observaciones'">
                      <div class="editable-cell">
                        <input 
                          *ngIf="categoria === 'cartera'"
                          type="text" 
                          [(ngModel)]="row[col]" 
                          (blur)="saveRecord(row)"
                          placeholder="Agregar nota..."
                          class="table-input"
                        />
                        <span class="save-status inline" [class.success]="saveStatus[row.id] === 'success'" [class.saving]="saveStatus[row.id] === 'saving'">
                          {{ saveStatus[row.id] === 'saving' ? '⏳' : (saveStatus[row.id] === 'success' ? '✅' : '') }}
                        </span>
                        <span *ngIf="categoria !== 'cartera'">{{ row[col] || '-' }}</span>
                      </div>
                    </ng-container>

                    <ng-container *ngSwitchCase="'sector_economico'">
                      <div class="editable-cell">
                        <select 
                          *ngIf="categoria === 'cartera'"
                          [(ngModel)]="row[col]" 
                          (change)="saveRecord(row)"
                          class="table-select sector-select"
                          [title]="row['actividad_economica'] || ''"
                        >
                          <option *ngFor="let s of sectors" [value]="s.nombre">{{ s.nombre }}</option>
                        </select>
                        <span class="save-status inline" [class.success]="saveStatus[row.id] === 'success'" [class.saving]="saveStatus[row.id] === 'saving'">
                          {{ saveStatus[row.id] === 'saving' ? '⏳' : (saveStatus[row.id] === 'success' ? '✅' : '') }}
                        </span>
                        <span *ngIf="categoria !== 'cartera'">{{ row[col] || '-' }}</span>
                      </div>
                    </ng-container>

                    <ng-container *ngSwitchCase="'actividad_economica'">
                      <span class="activity-text" [title]="row[col]">{{ row[col] || '-' }}</span>
                    </ng-container>

                    <!-- Currency Formatting -->
                    <span *ngSwitchCase="'valor_desembolso'">{{ row[col] | currency:'USD':'symbol':'1.0-2' }}</span>
                    <span *ngSwitchCase="'saldo_capital'">{{ row[col] | currency:'USD':'symbol':'1.0-2' }}</span>
                    <span *ngSwitchCase="'valor_vencido'">{{ row[col] | currency:'USD':'symbol':'1.0-2' }}</span>
                    <span *ngSwitchCase="'valor_mora'">{{ row[col] | currency:'USD':'symbol':'1.0-2' }}</span>
                    
                    <span *ngSwitchDefault>{{ row[col] !== null ? row[col] : '-' }}</span>
                  </ng-container>
                </td>
              </tr>
              <tr *ngIf="data.length === 0 && !isLoading">
                <td [attr.colspan]="getColumns().length" class="empty-row">
                  No se encontraron registros activos.
                </td>
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
              <button 
                (click)="changePage(currentPage - 1)" 
                [disabled]="currentPage === 1 || isLoading"
                class="btn-nav"
              >
                ‹
              </button>
              <button 
                (click)="changePage(currentPage + 1)" 
                [disabled]="currentPage === lastPage || isLoading"
                class="btn-nav"
              >
                ›
              </button>
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
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .view-container {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 24px;
      min-height: 100vh;
      box-sizing: border-box;
    }

    /* Search Header Styling */
    .search-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
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
      transition: box-shadow 0.2s;

      &:focus-within {
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        border-color: #cbd5e1;
      }

      .search-icon {
        color: #94a3b8;
        font-size: 18px;
        margin-right: 12px;
      }

      .search-input {
        border: none;
        outline: none;
        width: 100%;
        color: #1e293b;
        font-size: 15px;
        background: transparent;

        &::placeholder { color: #94a3b8; }
      }
    }

    .actions-group {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .modern-select {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 16px;
      color: #334155;
      font-size: 14px;
      outline: none;
      cursor: pointer;
      height: 40px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);

      &:hover { border-color: #cbd5e1; }
    }

    .btn-action {
      background: #1e293b;
      color: white;
      border: none;
      border-radius: 8px;
      height: 40px;
      padding: 0 20px;
      font-weight: 500;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;

      &:hover { background: #0f172a; }
      &.loading .icon { animation: spin 1s linear infinite; }
    }

    /* Content Card & Table Styling */
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

    .table-container {
      overflow-x: auto;
    }

    .modern-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;

      th {
        background: #fcfcfc;
        padding: 12px 24px;
        color: #64748b;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        border-bottom: 1px solid #f1f5f9;
        position: sticky;
        top: 0;
        z-index: 10;
        cursor: pointer;
        user-select: none;

        &:hover { color: #1e293b; }

        .th-content {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sort-icon { color: #3b82f6; font-size: 14px; }
      }

      td {
        padding: 12px 24px;
        border-bottom: 1px solid #f1f5f9;
        color: #334155;
        font-size: 14px;
        white-space: nowrap;
      }

      tr:hover td {
        background-color: #f8fafc;
      }

      .table-input {
        border: 1px solid transparent;
        border-radius: 4px;
        padding: 4px 8px;
        width: 100%;
        min-width: 150px;
        font-size: 13px;
        color: #334155;
        background: transparent;
        transition: all 0.2s;

        &:hover, &:focus {
          border-color: #cbd5e1;
          background: white;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          outline: none;
        }
      }

      .sector-input {
        font-weight: 600;
        color: #3b82f6;
        text-transform: uppercase;
        font-size: 11px;
        min-width: 100px;
      }

      .table-select {
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        padding: 4px 8px;
        width: 100%;
        min-width: 140px;
        font-size: 11px;
        font-weight: 600;
        color: #334155;
        background: white;
        cursor: pointer;
        outline: none;

        &:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
        }
      }

      .sector-select {
        color: #3b82f6;
        text-transform: uppercase;
      }

      .activity-text {
        font-size: 12px;
        color: #64748b;
        max-width: 200px;
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .editable-cell {
        display: flex;
        align-items: center;
        gap: 8px;
        position: relative;
        min-width: 180px;
      }

      .save-status {
        font-size: 14px;
        opacity: 0;
        transition: opacity 0.2s;
        flex-shrink: 0;
        margin-left: 4px;
        
        &.success, &.saving { opacity: 1; }
      }

      .id-badge {
        color: #94a3b8;
        font-size: 13px;
        font-weight: 500;
      }

      .empty-row {
        padding: 48px;
        text-align: center;
        color: #94a3b8;
        font-style: italic;
      }
    }

    /* Footer Pagination Styling */
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

    .pagination-controls {
      display: flex;
      align-items: center;
      gap: 32px;
    }

    .per-page-group {
      display: flex;
      align-items: center;
      gap: 12px;

      .compact-select {
        border: none;
        background: none;
        color: #1e293b;
        font-weight: 600;
        cursor: pointer;
        outline: none;
        padding-right: 4px;
      }
    }

    .nav-buttons {
      display: flex;
      gap: 8px;
    }

    .btn-nav {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      background: white;
      color: #64748b;
      font-size: 18px;
      cursor: pointer;
      transition: all 0.2s;

      &:hover:not(:disabled) {
        border-color: #cbd5e1;
        background: #f8fafc;
        color: #1e293b;
      }

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `]
})
export class SheetsComponent implements OnInit {
  categoria = 'cartera';
  data: any[] = [];
  isLoading = false;
  math = Math;
  saveStatus: { [id: number]: 'saving' | 'success' | 'error' | null } = {};
  sectors: any[] = [];

  // Parámetros de tabla
  searchTerm: string = '';
  sortBy: string = 'id';
  sortDir: 'asc' | 'desc' = 'desc';
  currentPage: number = 1;
  lastPage: number = 1;
  totalItems: number = 0;
  perPage: number = 5;

  // TODO: Use environment variable instead of hardcoded URL in production
  private baseUrl = 'http://localhost:8000/api';

  constructor(private http: HttpClient) { }

  ngOnInit() {
    this.loadHistory();
    this.loadSectors();
  }

  loadSectors() {
    this.http.get<any[]>(`${this.baseUrl}/sectores`).subscribe(res => {
      this.sectors = res;
    });
  }

  loadHistory() {
    this.isLoading = true;
    const url = new URL(`${this.baseUrl}/history/${this.categoria}`);
    if (this.searchTerm) url.searchParams.append('search', this.searchTerm);
    if (this.sortBy) url.searchParams.append('sortBy', this.sortBy);
    if (this.sortDir) url.searchParams.append('sortDir', this.sortDir);
    url.searchParams.append('page', this.currentPage.toString());
    url.searchParams.append('perPage', this.perPage.toString());

    this.http.get<any>(url.toString()).subscribe({
      next: (response) => {
        this.data = response.data || [];
        this.currentPage = response.current_page || 1;
        this.lastPage = response.last_page || 1;
        this.totalItems = response.total || 0;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error fetching database data', error);
        this.data = [];
        this.isLoading = false;
      }
    });
  }

  saveRecord(row: any) {
    this.saveStatus[row.id] = 'saving';
    const url = `${this.baseUrl}/history/${this.categoria}/${row.id}`;
    // Only send relevant editable fields
    const payload = {
      observaciones: row.observaciones,
      sector_economico: row.sector_economico,
      ciudad: row.ciudad
    };

    this.http.patch(url, payload).subscribe({
      next: () => {
        this.saveStatus[row.id] = 'success';
        setTimeout(() => {
          if (this.saveStatus[row.id] === 'success') {
            this.saveStatus[row.id] = null;
          }
        }, 3000);
      },
      error: (err) => {
        console.error('Error updating record', err);
        this.saveStatus[row.id] = 'error';
      }
    });
  }

  onSearch() {
    this.currentPage = 1;
    this.loadHistory();
  }

  onPerPageChange() {
    this.currentPage = 1;
    this.loadHistory();
  }

  onCategoryChange() {
    this.searchTerm = '';
    this.sortBy = 'id';
    this.sortDir = 'desc';
    this.currentPage = 1;
    this.loadHistory();
  }

  sortByColumn(col: string) {
    if (this.sortBy === col) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = col;
      this.sortDir = 'asc';
    }
    this.loadHistory();
  }

  changePage(page: number) {
    if (page >= 1 && page <= this.lastPage) {
      this.currentPage = page;
      this.loadHistory();
    }
  }

  getColumns(): string[] {
    if (this.data.length === 0) return [];

    const allKeys = Object.keys(this.data[0]);

    if (this.categoria === 'cartera') {
      // Custom Order for Cartera
      const prioritized = [
        'id', 'numero_radicado', 'cliente', 'identificacion',
        'actividad_economica', 'sector_economico', 'ciudad',
        'valor_desembolso', 'saldo_capital',
        'vencido', 'dias_vencido', 'valor_vencido', 'tiene_mora', 'valor_mora',
        'observaciones'
      ];

      // Filter out keys we don't want and add remaining keys at the end
      const filtered = prioritized.filter(k => allKeys.includes(k));
      const excluded = ['updated_at', 'created_at', 'tipo_garantia', 'estado_garantia', 'garantia_detalle', 'estado_capital', 'fecha_vencimiento_capital'];
      const others = allKeys.filter(k => !prioritized.includes(k) && !excluded.includes(k));

      return [...filtered, ...others];
    }

    return allKeys.filter(k => !['updated_at', 'created_at'].includes(k));
  }

  formatHeader(key: string): string {
    if (key === 'valor_desembolso') return 'DESEMBOLSO';
    if (key === 'numero_radicado') return 'RADICADO';
    return key.replace(/_/g, ' ').toUpperCase();
  }
}