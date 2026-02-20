import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType, Chart, registerables } from 'chart.js';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Register all Chart.js components
Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule, BaseChartDirective],
  providers: [provideCharts(withDefaultRegisterables())],
  template: `
    <div class="dashboard-wrapper" #dashboardContent>
      <div class="toolbar">
        <div class="info">
          <h3>📊 Análisis de Cartera & Operaciones</h3>
          <p>Métricas clave y filtros dinámicos.</p>
        </div>
        
        <div class="filters-row">
          <div class="filter-group">
            <label>Inicio</label>
            <input type="date" [(ngModel)]="filterFechaInicio" (change)="loadStats()" class="input-date">
          </div>
          <div class="filter-group">
            <label>Fin</label>
            <input type="date" [(ngModel)]="filterFechaFin" (change)="loadStats()" class="input-date">
          </div>
          <div class="filter-group">
            <label>Cliente/ID</label>
            <div class="search-input-wrapper">
              <input type="text" [(ngModel)]="filterCliente" (keyup.enter)="loadStats()" (blur)="loadStats()" placeholder="Nombre o ID..." class="input-search">
              <button *ngIf="filterCliente" (click)="filterCliente = ''; loadStats()" class="btn-clear-search">✕</button>
            </div>
          </div>
        </div>

        <div class="actions">
          <div class="tabs">
            <button (click)="currentTab = 'cartera'" [class.active]="currentTab === 'cartera'">Cartera</button>
            <button (click)="currentTab = 'pagos'" [class.active]="currentTab === 'pagos'">Pagos & Recaudos</button>
            <button (click)="currentTab = 'mora'" [class.active]="currentTab === 'mora'">Gestión de Mora</button>
          </div>

          <div class="btn-group">
            <button (click)="loadStats()" class="btn-refresh" [class.spinning]="isRefreshing">
              <span class="icon">{{ isRefreshing ? '⌛' : '🔄' }}</span> 
            </button>
            <button (click)="exportToPdf()" class="btn-export-pdf" [disabled]="isGeneratingPdf">
              <span class="icon">{{ isGeneratingPdf ? '⌛' : '📄' }}</span> 
              {{ isGeneratingPdf ? 'Generando...' : 'PDF' }}
            </button>
          </div>
        </div>
      </div>
      
      <div class="content-scroll" *ngIf="!isLoading && stats">
        
        <!-- TAB: CARTERA -->
        <div class="tab-content" *ngIf="currentTab === 'cartera'">
          <div class="kpi-grid">
            <div class="kpi-card blue clickable" (click)="navigateToSheets('cartera')">
              <label>Clientes Únicos</label>
              <div class="value">{{ stats.cartera.unique_clients }}</div>
              <div class="sub">Movimientos/Cliente: {{ stats.cartera.movs_per_client }}</div>
            </div>
            <div class="kpi-card green clickable" (click)="navigateToSheets('cartera')">
              <label>Saldo Capital</label>
              <div class="value">{{ stats.cartera.saldo_capital | currency:'USD':'symbol':'1.0-0' }}</div>
              <div class="sub">Total en cartera activa</div>
            </div>
            <div class="kpi-card orange">
              <label>Índice de Mora</label>
              <div class="value">{{ stats.cartera.mora_index }}%</div>
              <div class="sub">Sobre el capital total</div>
            </div>
          </div>

          <div class="chart-row">
            <div class="chart-container">
              <h4>Distribución por Ciudades (Clic para filtrar)</h4>
              <div class="chart-wrapper">
                <canvas baseChart
                  [data]="cityChartData"
                  [options]="pieChartOptions"
                  (chartClick)="onCityClick($event)"
                  [type]="'doughnut'">
                </canvas>
              </div>
            </div>
            <div class="chart-container">
              <h4>Plan de Amortización (Distribución %)</h4>
              <div class="chart-wrapper">
                <canvas baseChart
                  [data]="amortChartData"
                  [options]="barChartOptions"
                  [type]="'bar'">
                </canvas>
              </div>
            </div>
          </div>

          <div class="report-section mt-4">
            <h4>Reporte de Desembolsos Diarios (Últimos 15 registros)</h4>
            <div class="table-card">
              <table class="simple-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Total Desembolsado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let d of stats.cartera.daily_disbursements">
                    <td>{{ d.fecha_desembolso }}</td>
                    <td class="bold">{{ d.total | currency:'USD':'symbol':'1.0-0' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- TAB: PAGOS & RECAUDOS -->
        <div class="tab-content" *ngIf="currentTab === 'pagos'">
          <div class="kpi-grid">
            <div class="kpi-card purple">
              <label>Total Recaudado</label>
              <div class="value">{{ stats.factoring.total_collected | currency:'USD':'symbol':'1.0-0' }}</div>
              <div class="sub">{{ stats.factoring.pagos_count }} transacciones</div>
            </div>
          </div>
          
          <div class="report-section">
            <h4>Desglose Diario de Recaudos (Capital vs Intereses)</h4>
            <div class="table-card">
              <table class="simple-table">
                <thead>
                  <tr>
                    <th>Fecha Pago</th>
                    <th>Capital (Nominal)</th>
                    <th>Intereses (Dcto Fin)</th>
                    <th>Total Pagado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let p of stats.factoring.daily_payments">
                    <td>{{ p.fecha_pago }}</td>
                    <td>{{ p.capital | currency:'USD':'symbol':'1.0-0' }}</td>
                    <td>{{ p.intereses | currency:'USD':'symbol':'1.0-0' }}</td>
                    <td class="bold">{{ p.total | currency:'USD':'symbol':'1.0-0' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- TAB: MORA -->
        <div class="tab-content" *ngIf="currentTab === 'mora'">
          <div class="kpi-grid">
            <div class="kpi-card orange">
              <label>Mora Actual</label>
              <div class="value">{{ stats.cartera.mora_index }}%</div>
            </div>
          </div>

          <div class="report-section">
            <h4>Detalle de Deudores con Saldo en Mora</h4>
            <div class="table-card">
              <table class="simple-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Identificación</th>
                    <th>Días Vencido</th>
                    <th>Valor en Mora</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let d of stats.cartera.debtors">
                    <td>{{ d.cliente }}</td>
                    <td>{{ d.identificacion }}</td>
                    <td><span class="badge warning">{{ d.dias_vencido }} días</span></td>
                    <td class="danger bold">{{ d.valor_mora | currency:'USD':'symbol':'1.0-0' }}</td>
                    <td>
                      <button class="btn-small" (click)="navigateToSheets('cartera', d.cliente)">Ver Historial</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      <div class="loading-state" *ngIf="isLoading">
        <div class="spinner"></div>
        <p>Cargando Inteligencia de Datos...</p>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-wrapper {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 80px);
      background: #f8f9fa;
      overflow: hidden;
      
      &.exporting {
        height: auto !important;
        overflow: visible !important;
      }
    }

    .toolbar {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      background: white;
      padding: 1rem 2rem;
      border-bottom: 1px solid #e9ecef;
      
      h3 { margin: 0; font-size: 1.1rem; font-weight: 700; color: #344767; }
      p { margin: 0; color: #67748e; font-size: 0.8rem; }
    }

    .filters-row {
      display: flex;
      gap: 1rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      label { font-size: 0.65rem; font-weight: 800; color: #adb5bd; text-transform: uppercase; margin-bottom: 2px; }
      .input-date, .input-search {
        border: 1px solid #e9ecef;
        padding: 6px 10px;
        border-radius: 8px;
        font-size: 0.8rem;
        color: #344767;
        outline: none;
        &:focus { border-color: #5e72e4; }
      }
      .input-search { width: 180px; }
    }

    .search-input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .btn-clear-search {
      position: absolute;
      right: 8px;
      background: none;
      border: none;
      color: #adb5bd;
      cursor: pointer;
      font-size: 0.9rem;
      padding: 4px;
      &:hover { color: #f5365c; }
    }

    .actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .btn-group {
      display: flex;
      gap: 0.5rem;
    }

    .btn-export-pdf {
      background: #f5365c;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      &:hover { background: #f41443; }
    }

    .tabs {
      display: flex;
      background: #f1f3f5;
      padding: 4px;
      border-radius: 10px;
      gap: 4px;

      button {
        border: none;
        background: transparent;
        padding: 6px 18px;
        border-radius: 8px;
        font-size: 0.85rem;
        font-weight: 600;
        color: #6c757d;
        cursor: pointer;
        transition: all 0.2s;

        &.active {
          background: white;
          color: #344767;
          box-shadow: 0 4px 6px rgba(0,0,0,0.07);
        }
      }
    }

    .content-scroll {
      flex-grow: 1;
      overflow-y: auto;
      padding: 2rem;
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .kpi-card {
      background: white;
      padding: 1.5rem;
      border-radius: 15px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.03);
      position: relative;
      overflow: hidden;

      &.clickable { cursor: pointer; &:hover { transform: translateY(-2px); } }
      &::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; }
      &.blue::before { background: #5e72e4; }
      &.green::before { background: #2dce89; }
      &.orange::before { background: #fb6340; }
      &.purple::before { background: #8965e0; }

      label { font-size: 0.7rem; font-weight: 700; color: #adb5bd; text-transform: uppercase; }
      .value { font-size: 1.8rem; font-weight: 800; color: #32325d; margin: 0.4rem 0; }
      .sub { font-size: 0.75rem; color: #8898aa; }
    }

    .chart-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .chart-container {
      background: white;
      padding: 1.5rem;
      border-radius: 15px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.03);
      
      h4 { margin: 0 0 1.2rem 0; font-size: 0.9rem; color: #525f7f; font-weight: 600; }
      .chart-wrapper { height: 280px; position: relative; }
    }

    .report-section {
      h4 { margin-bottom: 1rem; font-size: 1rem; color: #32325d; }
    }

    .table-card {
      background: white;
      border-radius: 15px;
      padding: 1rem;
      box-shadow: 0 4px 12px rgba(0,0,0,0.03);
    }

    .simple-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      
      th { text-align: left; padding: 12px; border-bottom: 2px solid #f8f9fa; color: #adb5bd; font-weight: 600; }
      td { padding: 12px; border-bottom: 1px solid #f8f9fa; color: #525f7f; }
      
      .bold { font-weight: 700; color: #32325d; }
      .danger { color: #f5365c; }
    }

    .badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 700;
      &.warning { background: #fff3e0; color: #ff9800; }
    }

    .btn-small {
      background: #f8f9fa;
      border: 1px solid #e9ecef;
      padding: 4px 10px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.75rem;
      &:hover { background: #e9ecef; }
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 5rem;
    }

    .spinner {
      width: 40px; height: 40px;
      border: 4px solid #e9ecef;
      border-top-color: #5e72e4;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .mt-4 { margin-top: 2rem; }
  `]
})
export class DashboardComponent implements OnInit {
  @ViewChild('dashboardContent') dashboardContent!: ElementRef;

  currentTab: string = 'cartera';
  isRefreshing = false;
  isLoading = true;
  isGeneratingPdf = false;
  stats: any = null;
  private apiUrl = 'http://localhost:8000/api/dashboard/stats';

  // Filters
  filterFechaInicio: string = '';
  filterFechaFin: string = '';
  filterCliente: string = '';

  // Chart: Ciudades
  public cityChartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [{ data: [], backgroundColor: ['#5e72e4', '#2dce89', '#fb6340', '#11cdef', '#f5365c', '#8965e0', '#ffd600'] }]
  };

  // Chart: Amortización
  public amortChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{
      data: [],
      label: 'Frecuencia de Plan',
      backgroundColor: 'rgba(94, 114, 228, 0.6)',
      borderColor: '#5e72e4',
      borderWidth: 1
    }]
  };

  public pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'right' } }
  };

  public barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: { y: { beginAtZero: true } }
  };

  constructor(private http: HttpClient, private router: Router) { }

  ngOnInit() {
    this.loadStats();
  }

  loadStats() {
    this.isRefreshing = true;
    this.isLoading = true;

    let params = `?t=${Date.now()}`;
    if (this.filterFechaInicio) params += `&fecha_inicio=${this.filterFechaInicio}`;
    if (this.filterFechaFin) params += `&fecha_fin=${this.filterFechaFin}`;
    if (this.filterCliente) params += `&cliente=${this.filterCliente}`;

    this.http.get(this.apiUrl + params).subscribe({
      next: (data: any) => {
        this.stats = data;
        this.updateCharts();
        this.isRefreshing = false;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error fetching stats', error);
        this.isRefreshing = false;
        this.isLoading = false;
      }
    });
  }

  async exportToPdf() {
    this.isGeneratingPdf = true;
    const element = this.dashboardContent.nativeElement;

    // Preparation: Force height and visibility to capture scrollable content
    const originalHeight = element.style.height;
    const originalOverflow = element.style.overflow;

    element.style.height = 'auto';
    element.style.overflow = 'visible';

    // Wait a bit for layout to settle
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#f8f9fa',
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        y: window.scrollY // Ensure we capture from current or top if needed
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`reporte_dashboard_${this.currentTab}_${new Date().getTime()}.pdf`);
    } catch (error) {
      console.error('Error generating PDF', error);
    } finally {
      // Revert styles
      element.style.height = originalHeight;
      element.style.overflow = originalOverflow;
      this.isGeneratingPdf = false;
    }
  }

  updateCharts() {
    if (!this.stats) return;

    // Cities
    this.cityChartData.labels = this.stats.cartera.ciudades.map((c: any) => c.ciudad || 'Desconocida');
    this.cityChartData.datasets[0].data = this.stats.cartera.ciudades.map((c: any) => parseFloat(c.total));

    // Amortization
    this.amortChartData.labels = this.stats.cartera.amortizacion.map((a: any) => a.plan_amortizacion || 'N/A');
    this.amortChartData.datasets[0].data = this.stats.cartera.amortizacion.map((a: any) => a.count);
  }

  onCityClick(event: any) {
    if (event.active && event.active.length > 0) {
      const index = event.active[0].index;
      const label = this.cityChartData.labels![index] as string;
      this.navigateToSheets('cartera', label);
    }
  }

  navigateToSheets(category: string, filterText: string = '') {
    this.router.navigate(['/sheets'], {
      queryParams: {
        categoria: category,
        q: filterText
      }
    });
  }
}