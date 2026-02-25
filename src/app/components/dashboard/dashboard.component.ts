import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType, Chart, registerables } from 'chart.js';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import { environment } from '../../../environments/environment';

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
            <button (click)="currentTab = 'pagos'" [class.active]="currentTab === 'pagos'">Pagos</button>
            <button (click)="currentTab = 'factoring'" [class.active]="currentTab === 'factoring'">Factoring</button>
            <button (click)="currentTab = 'confirming'" [class.active]="currentTab === 'confirming'">Confirming</button>
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
              <label>Número de Clientes</label>
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
            <div class="kpi-card red clickable" (click)="navigateToSheets('cartera', 'mora')">
              <label>Saldo Mora Hoy</label>
              <div class="value">{{ stats.cartera.total_mora | currency:'USD':'symbol':'1.0-0' }}</div>
              <div class="sub">Total actualmente en mora</div>
            </div>
          </div>

          <div class="chart-row mt-4">
            <div class="chart-container full-width">
              <h4>Saldo de Mora por Cliente (Top 10)</h4>
              <div class="chart-wrapper small-height">
                <canvas baseChart
                  [data]="moraChartData"
                  [options]="barChartOptions"
                  (chartClick)="onMoraChartClick($event)"
                  [type]="'bar'">
                </canvas>
              </div>
            </div>
          </div>

          <div class="report-section mt-4">
            <h4>Saldos Actuales Operación (Clic para ver cliente)</h4>
            <div class="table-card">
              <!-- Search & Page Size -->
              <div class="table-header-actions">
                <div class="table-search">
                  <input type="text" [(ngModel)]="tableSettings.carteraRanking.search" placeholder="Filtro rápido...">
                </div>
                <div class="rows-per-page">
                  <label>Mostrar:</label>
                  <select [(ngModel)]="tableSettings.carteraRanking.pageSize">
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="all">Todos</option>
                  </select>
                </div>
              </div>

              <table class="simple-table interactive">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Identificación</th>
                    <th class="text-center">Operaciones</th>
                    <th class="text-right">Saldo Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let c of getProcessedData(stats.cartera.client_ranking, 'carteraRanking').items" (click)="navigateToSheets('cartera', c.cliente)" class="row-clickable">
                    <td>{{ c.cliente }}</td>
                    <td>{{ c.identificacion }}</td>
                    <td class="text-center">{{ c.total_ops }}</td>
                    <td class="text-right bold">{{ c.saldo_total | currency:'USD':'symbol':'1.0-0' }}</td>
                  </tr>
                </tbody>
              </table>

              <!-- Paginator -->
              <div class="table-footer-pagination" *ngIf="tableSettings.carteraRanking.pageSize !== 'all'">
                <span>Total: {{ getProcessedData(stats.cartera.client_ranking, 'carteraRanking').total }}</span>
                <div class="pagination-controls">
                  <button (click)="changePage('carteraRanking', -1)" [disabled]="tableSettings.carteraRanking.page <= 1">Ant.</button>
                  <span>Pág. {{ tableSettings.carteraRanking.page }} de {{ getProcessedData(stats.cartera.client_ranking, 'carteraRanking').pages }}</span>
                  <button (click)="changePage('carteraRanking', 1)" [disabled]="tableSettings.carteraRanking.page >= getProcessedData(stats.cartera.client_ranking, 'carteraRanking').pages">Sig.</button>
                </div>
              </div>
            </div>
          </div>

          <div class="chart-row mt-4">
            <div class="chart-container">
              <h4>Actividad Económica por Saldo Capital</h4>
              <div class="chart-wrapper">
                <canvas baseChart
                  [data]="activityChartData"
                  [options]="pieChartOptions"
                  (chartClick)="onActivityClick($event)"
                  [type]="'doughnut'">
                </canvas>
              </div>
            </div>
            <div class="chart-container">
              <h4>Distribución por Ciudades</h4>
              <div class="chart-wrapper">
                <canvas baseChart
                  [data]="cityChartData"
                  [options]="pieChartOptions"
                  (chartClick)="onCityClick($event)"
                  [type]="'doughnut'">
                </canvas>
              </div>
            </div>
          </div>

          <div class="chart-row mt-4">
            <div class="chart-container full-width">
              <h4>Plan de Amortización (Distribución %)</h4>
              <div class="chart-wrapper small-height">
                <canvas baseChart
                  [data]="amortChartData"
                  [options]="barChartOptions"
                  (chartClick)="onAmortClick($event)"
                  [type]="'bar'">
                </canvas>
              </div>
            </div>
          </div>

          <div class="report-section mt-4">
            <h4>Reporte de Desembolsos Diarios</h4>
            <div class="table-card">
              <div class="table-header-actions">
                <div class="table-search">
                  <input type="text" [(ngModel)]="tableSettings.carteraDaily.search" placeholder="Filtro rápido...">
                </div>
                <div class="rows-per-page">
                  <label>Mostrar:</label>
                  <select [(ngModel)]="tableSettings.carteraDaily.pageSize">
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="all">Todos</option>
                  </select>
                </div>
              </div>

              <table class="simple-table interactive">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Identificación</th>
                    <th class="text-right">Total Desembolsado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let d of getProcessedData(stats.cartera.daily_disbursements, 'carteraDaily').items" (click)="navigateToSheets('cartera', d.cliente)" class="row-clickable">
                    <td>{{ d.fecha | date:'dd/MM/yyyy' }}</td>
                    <td>{{ d.cliente }}</td>
                    <td>{{ d.identificacion }}</td>
                    <td class="text-right bold">{{ d.total | currency:'USD':'symbol':'1.0-0' }}</td>
                  </tr>
                </tbody>
              </table>

              <div class="table-footer-pagination" *ngIf="tableSettings.carteraDaily.pageSize !== 'all'">
                <span>Total: {{ getProcessedData(stats.cartera.daily_disbursements, 'carteraDaily').total }}</span>
                <div class="pagination-controls">
                  <button (click)="changePage('carteraDaily', -1)" [disabled]="tableSettings.carteraDaily.page <= 1">Ant.</button>
                  <span>Pág. {{ tableSettings.carteraDaily.page }} de {{ getProcessedData(stats.cartera.daily_disbursements, 'carteraDaily').pages }}</span>
                  <button (click)="changePage('carteraDaily', 1)" [disabled]="tableSettings.carteraDaily.page >= getProcessedData(stats.cartera.daily_disbursements, 'carteraDaily').pages">Sig.</button>
                </div>
              </div>
            </div>
          </div>

          <div class="report-section mt-4">
            <h4>Clientes con mayor deuda (Gestión de Mora)</h4>
            <div class="table-card">
              <div class="table-header-actions">
                <div class="table-search">
                  <input type="text" [(ngModel)]="tableSettings.carteraDebtors.search" placeholder="Buscar por cliente o ID...">
                </div>
                <div class="rows-per-page">
                  <label>Mostrar:</label>
                  <select [(ngModel)]="tableSettings.carteraDebtors.pageSize">
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="all">Todos</option>
                  </select>
                </div>
              </div>

              <table class="simple-table interactive">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Identificación</th>
                    <th>Días Vencido</th>
                    <th>Valor en Mora</th>
                    <th>Detalles</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let d of getProcessedData(stats.cartera.debtors, 'carteraDebtors').items" (click)="navigateToSheets('cartera', d.cliente)" class="row-clickable">
                    <td>{{ d.cliente }}</td>
                    <td>{{ d.identificacion }}</td>
                    <td><span class="badge warning">{{ d.dias_vencido }} días</span></td>
                    <td class="danger bold">{{ d.valor_mora | currency:'USD':'symbol':'1.0-0' }}</td>
                    <td class="x-small-text">
                      <div *ngFor="let det of d.detalles" class="detail-item">
                        Op {{ det.operacion }}: <span class="bold">{{ det.valor_mora | currency:'USD':'symbol':'1.0-0' }}</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div class="table-footer-pagination" *ngIf="tableSettings.carteraDebtors.pageSize !== 'all'">
                <span>Total: {{ getProcessedData(stats.cartera.debtors, 'carteraDebtors').total }}</span>
                <div class="pagination-controls">
                  <button (click)="changePage('carteraDebtors', -1)" [disabled]="tableSettings.carteraDebtors.page <= 1">Ant.</button>
                  <span>Pág. {{ tableSettings.carteraDebtors.page }} de {{ getProcessedData(stats.cartera.debtors, 'carteraDebtors').pages }}</span>
                  <button (click)="changePage('carteraDebtors', 1)" [disabled]="tableSettings.carteraDebtors.page >= getProcessedData(stats.cartera.debtors, 'carteraDebtors').pages">Sig.</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB: PAGOS -->
        <div class="tab-content" *ngIf="currentTab === 'pagos'">
          <div class="kpi-grid">
            <div class="kpi-card blue">
              <label>Total Recaudado</label>
              <div class="value">{{ stats.factoring.total_collected | currency:'USD':'symbol':'1.0-0' }}</div>
            </div>
            <div class="kpi-card green">
              <label>Eficiencia de Cobro (días)</label>
              <div class="value">{{ stats.factoring.efficiency_score }}</div>
            </div>
            <div class="kpi-card orange">
              <label>Costo de Pronto Pago</label>
              <div class="value">{{ stats.factoring.early_payment_cost | currency:'USD':'symbol':'1.0-0' }}</div>
            </div>
            <div class="kpi-card purple">
              <label>Saldos Pendientes</label>
              <div class="value">{{ stats.factoring.outstanding_balance | currency:'USD':'symbol':'1.0-0' }}</div>
            </div>
          </div>

          <div class="chart-row mt-4">
            <div class="chart-container">
              <h4>Monto Pagado a lo largo del tiempo</h4>
              <div class="chart-wrapper">
                <canvas baseChart
                  [data]="paymentTimelineChartData"
                  [options]="barChartOptions"
                  [type]="'line'">
                </canvas>
              </div>
            </div>
            <div class="chart-container">
              <h4>Distribución de Pagos por Cliente</h4>
              <div class="chart-wrapper">
                <canvas baseChart
                  [data]="paymentDistributionChartData"
                  [options]="pieChartOptions"
                  [type]="'doughnut'">
                </canvas>
              </div>
            </div>
          </div>

          <div class="report-section mt-4">
            <h4>Registro de pagos</h4>
            <div class="table-card no-shadow">
              <div class="table-header-actions">
                <div class="table-search">
                  <input type="text" [(ngModel)]="tableSettings.pagosEntries.search" placeholder="Filtro rápido...">
                </div>
                <div class="rows-per-page">
                  <label>Mostrar:</label>
                  <select [(ngModel)]="tableSettings.pagosEntries.pageSize">
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="all">Todos</option>
                  </select>
                </div>
              </div>

              <table class="simple-table interactive x-small">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>ID</th>
                    <th>Factura Nro</th>
                    <th>Dias Cartera</th>
                    <th class="text-right">Monto Pagado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let p of getProcessedData(stats.factoring.payment_entries, 'pagosEntries').items" class="row-clickable">
                    <td>{{ p.cliente }}</td>
                    <td>{{ p.identificacion || p.nit_cliente }}</td>
                    <td>{{ p.factura_nro }}</td>
                    <td>{{ p.dias_cartera }}</td>
                    <td class="text-right bold">{{ p.monto_pagado | currency:'USD':'symbol':'1.0-0' }}</td>
                  </tr>
                </tbody>
              </table>

              <div class="table-footer-pagination" *ngIf="tableSettings.pagosEntries.pageSize !== 'all'">
                <span>Total: {{ getProcessedData(stats.factoring.payment_entries, 'pagosEntries').total }}</span>
                <div class="pagination-controls">
                  <button (click)="changePage('pagosEntries', -1)" [disabled]="tableSettings.pagosEntries.page <= 1">Ant.</button>
                  <span>Pág. {{ tableSettings.pagosEntries.page }} de {{ getProcessedData(stats.factoring.payment_entries, 'pagosEntries').pages }}</span>
                  <button (click)="changePage('pagosEntries', 1)" [disabled]="tableSettings.pagosEntries.page >= getProcessedData(stats.factoring.payment_entries, 'pagosEntries').pages">Sig.</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB: FACTORING -->
        <div class="tab-content" *ngIf="currentTab === 'factoring'">
          <div class="kpi-grid">
            <div class="kpi-card blue">
              <label>Volumen Total Financiado</label>
              <div class="value">{{ stats.factoring.volumen_total | currency:'USD':'symbol':'1.0-0' }}</div>
            </div>
            <div class="kpi-card green">
              <label>Valor Desembolsado</label>
              <div class="value">{{ stats.factoring.valor_desembolsado | currency:'USD':'symbol':'1.0-0' }}</div>
            </div>
            <div class="kpi-card orange">
              <label>Valor Reserva</label>
              <div class="value">{{ stats.factoring.valor_reserva | currency:'USD':'symbol':'1.0-0' }}</div>
            </div>
            <div class="kpi-card purple">
              <label>Margen de Descuento</label>
              <div class="value">{{ stats.factoring.avg_tasa }}%</div>
            </div>
          </div>

          <div class="chart-row mt-4">
            <div class="chart-container">
              <h4>Valor Reserva Objetivo ($120M)</h4>
              <div class="bullet-chart-container">
                <div class="bullet-bg">
                  <div class="bullet-range range-1"></div>
                  <div class="bullet-range range-2"></div>
                  <div class="bullet-range range-3"></div>
                  <div class="bullet-marker" [style.left.%]="(stats.factoring.valor_reserva / 120000000) * 100"></div>
                  <div class="bullet-target" style="left: 80%"></div>
                </div>
                <div class="bullet-labels">
                  <span>0</span>
                  <span>40M</span>
                  <span>80M</span>
                  <span>120M</span>
                  <span>140M</span>
                </div>
              </div>
            </div>
            <div class="chart-container">
              <h4>Exposición por Pagador</h4>
              <div class="chart-wrapper">
                <canvas baseChart
                  [data]="exposureChartData"
                  [options]="horizontalBarChartOptions"
                  [type]="'bar'">
                </canvas>
              </div>
            </div>
          </div>

          <div class="report-section mt-4">
            <h4>Vencimientos Factoring</h4>
            <div class="table-card">
              <div class="table-header-actions">
                <div class="table-search">
                  <input type="text" [(ngModel)]="tableSettings.factoringVencimientos.search" placeholder="Buscar pagador...">
                </div>
                <div class="rows-per-page">
                  <label>Mostrar:</label>
                  <select [(ngModel)]="tableSettings.factoringVencimientos.pageSize">
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="all">Todos</option>
                  </select>
                </div>
              </div>

              <table class="simple-table interactive">
                <thead>
                  <tr>
                    <th>Pagador</th>
                    <th>Fecha Vencimiento</th>
                    <th class="text-right">Monto</th>
                    <th>Estado</th>
                    <th>Días</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let v of getProcessedData(stats.factoring.vencimientos, 'factoringVencimientos').items" class="row-clickable">
                    <td>{{ v.pagador }}</td>
                    <td>{{ v.fecha | date:'dd/MM/yyyy' }}</td>
                    <td class="text-right bold">{{ v.monto | currency:'USD':'symbol':'1.0-0' }}</td>
                    <td>
                      <span class="badge" [ngClass]="{
                        'danger': v.estado === 'Vencido',
                        'warning': v.estado === 'Por Vencer',
                        'success': v.estado === 'Vigente'
                      }">{{ v.estado }}</span>
                    </td>
                    <td [class.danger-text]="v.dias < 0">{{ v.dias }}</td>
                  </tr>
                </tbody>
              </table>

              <div class="table-footer-pagination" *ngIf="tableSettings.factoringVencimientos.pageSize !== 'all'">
                <span>Total: {{ getProcessedData(stats.factoring.vencimientos, 'factoringVencimientos').total }}</span>
                <div class="pagination-controls">
                  <button (click)="changePage('factoringVencimientos', -1)" [disabled]="tableSettings.factoringVencimientos.page <= 1">Ant.</button>
                  <span>Pág. {{ tableSettings.factoringVencimientos.page }} de {{ getProcessedData(stats.factoring.vencimientos, 'factoringVencimientos').pages }}</span>
                  <button (click)="changePage('factoringVencimientos', 1)" [disabled]="tableSettings.factoringVencimientos.page >= getProcessedData(stats.factoring.vencimientos, 'factoringVencimientos').pages">Sig.</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB: CONFIRMING -->
        <div class="tab-content" *ngIf="currentTab === 'confirming'">
          <div class="kpi-grid">
            <div class="kpi-card blue">
              <label>Valor Nominal Total</label>
              <div class="value">{{ stats.confirming.total_val | currency:'USD':'symbol':'1.0-0' }}</div>
            </div>
            <div class="kpi-card green">
              <label>Rendimientos Proyectados</label>
              <div class="value">{{ stats.confirming.rendimientos_proyectados | currency:'USD':'symbol':'1.0-0' }}</div>
            </div>
            <div class="kpi-card orange">
              <label>Total a Pagar por Deudores</label>
              <div class="value">{{ stats.confirming.total_pagar_deudores | currency:'USD':'symbol':'1.0-0' }}</div>
            </div>
          </div>

          <div class="chart-row mt-4">
            <div class="chart-container">
              <h4>Análisis de Emisores</h4>
              <div class="chart-wrapper">
                <canvas baseChart
                  [data]="emitterAnalysisChartData"
                  [options]="pieChartOptions"
                  [type]="'pie'">
                </canvas>
              </div>
            </div>
            <div class="chart-container">
              <h4>Tabla de Vencimientos y Días</h4>
              <div class="table-card no-shadow">
                <div class="table-header-actions">
                  <div class="table-search">
                    <input type="text" [(ngModel)]="tableSettings.confirmingVencimientos.search" placeholder="Filtro rápido...">
                  </div>
                  <div class="rows-per-page">
                    <select [(ngModel)]="tableSettings.confirmingVencimientos.pageSize">
                      <option value="5">5</option>
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="all">Todo</option>
                    </select>
                  </div>
                </div>

                <table class="simple-table interactive x-small">
                  <thead>
                    <tr>
                      <th>ID Título</th>
                      <th>Emisor</th>
                      <th>Fecha Final</th>
                      <th class="text-right">Días</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let v of getProcessedData(stats.confirming.vencimientos, 'confirmingVencimientos').items" class="row-clickable">
                      <td>{{ v.id_titulo }}</td>
                      <td>{{ v.emisor }}</td>
                      <td>{{ v.fecha_final | date:'dd MMM yyyy' }}</td>
                      <td class="text-right bold" [class.danger-text]="v.dias < 0">{{ v.dias }}</td>
                    </tr>
                  </tbody>
                </table>

                <div class="table-footer-pagination" *ngIf="tableSettings.confirmingVencimientos.pageSize !== 'all'">
                  <div class="pagination-controls">
                    <button (click)="changePage('confirmingVencimientos', -1)" [disabled]="tableSettings.confirmingVencimientos.page <= 1"> < </button>
                    <span>{{ tableSettings.confirmingVencimientos.page }} / {{ getProcessedData(stats.confirming.vencimientos, 'confirmingVencimientos').pages }}</span>
                    <button (click)="changePage('confirmingVencimientos', 1)" [disabled]="tableSettings.confirmingVencimientos.page >= getProcessedData(stats.confirming.vencimientos, 'confirmingVencimientos').pages"> > </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="chart-row mt-4">
            <div class="chart-container">
              <h4>Gráfico de Barras de Tasa Media</h4>
              <div class="chart-wrapper">
                <canvas baseChart
                  [data]="emitterTasaChartData"
                  [options]="barChartOptions"
                  [type]="'bar'">
                </canvas>
              </div>
            </div>
            <div class="chart-container">
              <h4>Rendimientos por Emisor</h4>
              <div class="table-card no-shadow">
                <div class="table-header-actions">
                  <div class="table-search">
                    <input type="text" [(ngModel)]="tableSettings.confirmingRendimientos.search" placeholder="Filtro rápido...">
                  </div>
                  <div class="rows-per-page">
                    <select [(ngModel)]="tableSettings.confirmingRendimientos.pageSize">
                      <option value="5">5</option>
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="all">Todo</option>
                    </select>
                  </div>
                </div>

                <table class="simple-table interactive x-small">
                  <thead>
                    <tr>
                      <th>Emisor</th>
                      <th class="text-right">Valor Nominal</th>
                      <th class="text-right">Rendimientos Proyectados</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let r of getProcessedData(stats.confirming.rendimientos_emisor, 'confirmingRendimientos').items" class="row-clickable">
                      <td>{{ r.emisor }}</td>
                      <td class="text-right">{{ r.valor_nominal | currency:'USD':'symbol':'1.0-0' }}</td>
                      <td class="text-right bold blue-text">{{ r.rendimientos | currency:'USD':'symbol':'1.0-0' }}</td>
                    </tr>
                  </tbody>
                </table>

                <div class="table-footer-pagination" *ngIf="tableSettings.confirmingRendimientos.pageSize !== 'all'">
                  <div class="pagination-controls">
                    <button (click)="changePage('confirmingRendimientos', -1)" [disabled]="tableSettings.confirmingRendimientos.page <= 1"> < </button>
                    <span>{{ tableSettings.confirmingRendimientos.page }} / {{ getProcessedData(stats.confirming.rendimientos_emisor, 'confirmingRendimientos').pages }}</span>
                    <button (click)="changePage('confirmingRendimientos', 1)" [disabled]="tableSettings.confirmingRendimientos.page >= getProcessedData(stats.confirming.rendimientos_emisor, 'confirmingRendimientos').pages"> > </button>
                  </div>
                </div>
              </div>
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
      &.red::before { background: #f5365c; }
      &.purple::before { background: #8965e0; }

      label { font-size: 0.65rem; font-weight: 700; color: #adb5bd; text-transform: uppercase; letter-spacing: 0.5px; }
      .value { 
        font-size: 1.4rem; 
        font-weight: 800; 
        color: #32325d; 
        margin: 0.4rem 0;
        display: block;
      }
      .sub { font-size: 0.7rem; color: #8898aa; }
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
      .blue-text { color: #5e72e4; }
      
      .simple-table.x-small {
        font-size: 0.75rem;
        th, td { padding: 8px; }
      }
      
      .table-card.no-shadow { box-shadow: none; padding: 0; }

      &.interactive {
        tr.row-clickable {
          cursor: pointer;
          transition: background 0.2s;
          &:hover { background: #f1f5f9; }
        }
      }
    }

    .chart-container.full-width {
      grid-column: 1 / -1;
    }
    
    .small-height {
      height: 200px !important;
    }

    .badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 700;
      &.warning { background: #fff3e0; color: #ff9800; }
    }

    .text-center { text-align: center; }
    .text-right { text-align: right; }

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

    .danger-text { color: #f5365c; font-weight: 700; }
    .success { background: #e8f9f1; color: #2dce89; }
    
    /* Bullet Chart Styles */
    .bullet-chart-container {
      padding: 20px 0;
      .bullet-bg {
        height: 40px;
        background: #e9ecef;
        position: relative;
        border-radius: 4px;
        overflow: hidden;
      }
      .bullet-range { position: absolute; height: 100%; top: 0; }
      .range-1 { background: #ced4da; width: 40%; }
      .range-2 { background: #dee2e6; width: 70%; }
      .range-3 { background: #e9ecef; width: 100%; }
      .bullet-marker {
        position: absolute;
        top: 25%;
        height: 50%;
        width: 8px;
        background: #5e72e4;
        z-index: 2;
        box-shadow: 0 0 5px rgba(0,0,0,0.2);
      }
      .bullet-target {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 2px;
        background: #344767;
        z-index: 3;
      }
      .bullet-labels {
        display: flex;
        justify-content: space-between;
        margin-top: 5px;
        font-size: 0.7rem;
        color: #8898aa;
      }
    }

    .mt-4 { margin-top: 2rem; }
    
    .x-small-text {
      font-size: 0.65rem;
      line-height: 1.2;
      color: #67748e;
    }
    
    .detail-item {
      padding: 2px 0;
      border-bottom: 1px dashed #eee;
      &:last-child { border-bottom: none; }
    }

    /* Paginator & Search Styles */
    .table-header-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      gap: 1rem;
      
      .table-search {
        flex-grow: 1;
        max-width: 300px;
        position: relative;
        input {
          width: 100%;
          padding: 6px 12px;
          border-radius: 8px;
          border: 1px solid #e9ecef;
          font-size: 0.8rem;
          outline: none;
          &:focus { border-color: #5e72e4; }
        }
      }
    }

    .table-footer-pagination {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 15px;
      padding-top: 10px;
      border-top: 1px solid #f8f9fa;
      font-size: 0.75rem;
      color: #67748e;

      .pagination-controls {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        
        button {
          background: white;
          border: 1px solid #e9ecef;
          padding: 4px 10px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          color: #344767;
          &:disabled { opacity: 0.5; cursor: not-allowed; }
          &:not(:disabled):hover { background: #f8f9fa; border-color: #5e72e4; }
        }
        
        span { font-weight: 600; color: #344767; }
      }

      .rows-per-page {
        display: flex;
        align-items: center;
        gap: 8px;
        select {
          padding: 4px 8px;
          border-radius: 6px;
          border: 1px solid #e9ecef;
          outline: none;
          font-size: 0.75rem;
          cursor: pointer;
          &:focus { border-color: #5e72e4; }
        }
      }
    }
  `]
})
export class DashboardComponent implements OnInit {
  @ViewChild('dashboardContent') dashboardContent!: ElementRef;

  currentTab: string = 'cartera';
  isRefreshing = false;
  isLoading = true;
  isGeneratingPdf = false;
  stats: any = null;
  private apiUrl = `${environment.apiUrl}/dashboard/stats`;
  // Pagination & Search States
  tableSettings: any = {
    carteraRanking: { page: 1, pageSize: 5, search: '' },
    carteraDaily: { page: 1, pageSize: 5, search: '' },
    carteraDebtors: { page: 1, pageSize: 5, search: '' },
    pagosEntries: { page: 1, pageSize: 5, search: '' },
    factoringVencimientos: { page: 1, pageSize: 5, search: '' },
    confirmingVencimientos: { page: 1, pageSize: 5, search: '' },
    confirmingRendimientos: { page: 1, pageSize: 5, search: '' }
  };

  // Filters
  filterFechaInicio: string = '';
  filterFechaFin: string = '';
  filterCliente: string = '';

  // Chart: Actividad
  public activityChartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [{ data: [], backgroundColor: ['#5e72e4', '#2dce89', '#fb6340', '#11cdef', '#f5365c', '#8965e0', '#ffd600'] }]
  };

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

  // Chart: Mora
  public moraChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{
      data: [],
      label: 'Saldo en Mora',
      backgroundColor: 'rgba(245, 54, 92, 0.6)',
      borderColor: '#f5365c',
      borderWidth: 1
    }]
  };

  // Chart: Exposición por Pagador
  public exposureChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{
      data: [],
      label: 'Monto Expuesto',
      backgroundColor: '#5e72e4',
      borderRadius: 5
    }]
  };

  // Chart: Análisis de Emisores (Confirming)
  public emitterAnalysisChartData: ChartData<'pie'> = {
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: ['#5e72e4', '#2dce89', '#fb6340', '#11cdef', '#f5365c', '#8965e0', '#ffd600']
    }]
  };

  // Chart: Tasa Media Emisor (Confirming)
  public emitterTasaChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{
      data: [],
      label: 'Tasa Factor',
      backgroundColor: '#5e72e4',
      borderRadius: 5
    }]
  };

  // Chart: Monto Pagado Timeline (Pagos)
  public paymentTimelineChartData: ChartData<'line'> = {
    labels: [],
    datasets: [{
      data: [],
      label: 'Monto Pagado',
      borderColor: '#5e72e4',
      backgroundColor: 'rgba(94, 114, 228, 0.1)',
      fill: true,
      tension: 0.4
    }]
  };

  // Chart: Distribución por Cliente (Pagos)
  public paymentDistributionChartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: ['#5e72e4', '#2dce89', '#fb6340', '#11cdef', '#f5365c', '#8965e0', '#ffd600']
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

  public horizontalBarChartOptions: ChartConfiguration['options'] = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { x: { beginAtZero: true } }
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

    // Preparation: Hide toolbar and adjust content for capture
    const toolbar = element.querySelector('.toolbar') as HTMLElement;
    const scrollContent = element.querySelector('.content-scroll') as HTMLElement;

    const originalToolbarDisplay = toolbar ? toolbar.style.display : '';
    const originalScrollPadding = scrollContent ? scrollContent.style.padding : '';

    if (toolbar) toolbar.style.display = 'none';
    if (scrollContent) scrollContent.style.padding = '0';

    const originalHeight = element.style.height;
    const originalOverflow = element.style.overflow;

    element.style.height = 'auto';
    element.style.overflow = 'visible';

    // Wait for layout and charts to settle
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const margin = 15;
      const headerHeight = 25;
      const footerHeight = 15;
      const printableWidth = pdfWidth - (margin * 2);
      const printableHeight = pdfHeight - headerHeight - footerHeight - margin; // Space for content per page

      const imgProps = pdf.getImageProperties(imgData);
      const imgScaledHeight = (imgProps.height * printableWidth) / imgProps.width;

      let heightLeft = imgScaledHeight;
      let currentPosition = 0; // Position in the source image
      let pageNumber = 1;

      while (heightLeft > 0) {
        if (pageNumber > 1) pdf.addPage();

        // --- DRAW HEADER ---
        pdf.setFillColor(248, 249, 250);
        pdf.rect(0, 0, pdfWidth, headerHeight, 'F');
        pdf.setTextColor(52, 71, 103);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`REPORTE DE DASHBOARD - ${this.currentTab.toUpperCase()}`, margin, 12);

        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(103, 116, 142);
        const dateStr = new Date().toLocaleString();
        pdf.text(`Generado el: ${dateStr}`, margin, 18);
        pdf.setDrawColor(233, 236, 239);
        pdf.line(margin, 20, pdfWidth - margin, 20);

        // --- DRAW CONTENT SLICE ---
        const sliceY = headerHeight + 5; // Start content below header

        pdf.addImage(
          imgData,
          'PNG',
          margin,
          sliceY - currentPosition,
          printableWidth,
          imgScaledHeight,
          undefined,
          'FAST'
        );

        // --- DRAW COVER BLOCKS (to clean up overflows) ---
        pdf.setFillColor(248, 249, 250);
        pdf.rect(0, 0, pdfWidth, headerHeight, 'F');
        pdf.setTextColor(52, 71, 103);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`REPORTE DE DASHBOARD - ${this.currentTab.toUpperCase()}`, margin, 12);
        pdf.setFontSize(8);
        pdf.text(`Generado el: ${dateStr}`, margin, 18);

        // --- DRAW FOOTER ---
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, pdfHeight - footerHeight, pdfWidth, footerHeight, 'F');
        pdf.setDrawColor(233, 236, 239);
        pdf.line(margin, pdfHeight - footerHeight, pdfWidth - margin, pdfHeight - footerHeight);
        pdf.setTextColor(103, 116, 142);
        pdf.setFontSize(8);
        pdf.text(`Página ${pageNumber}`, pdfWidth / 2, pdfHeight - 7, { align: 'center' });
        pdf.text('Factoring Softclass - Confidencial', margin, pdfHeight - 7);

        currentPosition += printableHeight;
        heightLeft -= printableHeight;
        pageNumber++;
      }

      pdf.save(`reporte_dashboard_${this.currentTab}_${new Date().getTime()}.pdf`);
    } catch (error) {
      console.error('Error generating PDF', error);
    } finally {
      // Revert styles
      if (toolbar) toolbar.style.display = originalToolbarDisplay;
      if (scrollContent) scrollContent.style.padding = originalScrollPadding;
      element.style.height = originalHeight;
      element.style.overflow = originalOverflow;
      this.isGeneratingPdf = false;
    }
  }

  updateCharts() {
    if (!this.stats) return;

    // Activity Distribution
    if (this.stats.cartera.actividad) {
      this.activityChartData.labels = this.stats.cartera.actividad.map((a: any) => a.sector_economico || 'Otros');
      this.activityChartData.datasets[0].data = this.stats.cartera.actividad.map((a: any) => parseFloat(a.total));
    }

    // Cities
    this.cityChartData.labels = this.stats.cartera.ciudades.map((c: any) => c.ciudad || 'Desconocida');
    this.cityChartData.datasets[0].data = this.stats.cartera.ciudades.map((c: any) => parseFloat(c.total));

    // Amortization
    const amort = this.stats.cartera.amortizacion;
    if (amort) {
      const total = amort.reduce((sum: number, a: any) => sum + (a.count || 0), 0);
      this.amortChartData.labels = amort.map((a: any) => a.plan_amortizacion || 'N/A');
      this.amortChartData.datasets[0].data = amort.map((a: any) => total > 0 ? (a.count / total * 100).toFixed(1) : 0);
    }

    // Mora Chart
    if (this.stats.cartera.debtors) {
      this.moraChartData.labels = this.stats.cartera.debtors.map((d: any) => d.cliente || 'Otros');
      this.moraChartData.datasets[0].data = this.stats.cartera.debtors.map((d: any) => parseFloat(d.valor_mora));
    }

    // Factoring: Exposure by Payer
    if (this.stats.factoring.exposure_by_payer) {
      this.exposureChartData.labels = this.stats.factoring.exposure_by_payer.map((e: any) => e.pagador);
      this.exposureChartData.datasets[0].data = this.stats.factoring.exposure_by_payer.map((e: any) => parseFloat(e.total));
    }

    // Confirming: Analysis of Emitters
    if (this.stats.confirming.analisis_emisores) {
      this.emitterAnalysisChartData.labels = this.stats.confirming.analisis_emisores.map((e: any) => e.emisor);
      this.emitterAnalysisChartData.datasets[0].data = this.stats.confirming.analisis_emisores.map((e: any) => parseFloat(e.total));
    }

    // Confirming: Avg Tasa by Emisor
    if (this.stats.confirming.tasa_media_emisor) {
      this.emitterTasaChartData.labels = this.stats.confirming.tasa_media_emisor.map((e: any) => e.emisor);
      this.emitterTasaChartData.datasets[0].data = this.stats.confirming.tasa_media_emisor.map((e: any) => parseFloat(e.avg_tasa));
    }

    // Pagos: Timeline
    if (this.stats.factoring.payment_timeline) {
      this.paymentTimelineChartData.labels = this.stats.factoring.payment_timeline.map((t: any) => {
        const d = new Date(t.fecha);
        return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
      });
      this.paymentTimelineChartData.datasets[0].data = this.stats.factoring.payment_timeline.map((t: any) => parseFloat(t.total));
    }

    // Pagos: Distribution
    if (this.stats.factoring.payment_distribution) {
      this.paymentDistributionChartData.labels = this.stats.factoring.payment_distribution.map((d: any) => d.cliente);
      this.paymentDistributionChartData.datasets[0].data = this.stats.factoring.payment_distribution.map((d: any) => parseFloat(d.total));
    }
  }

  onCityClick(event: any) {
    if (event.active && event.active.length > 0) {
      const index = event.active[0].index;
      const label = this.cityChartData.labels![index] as string;
      this.navigateToSheets('cartera', label);
    }
  }

  onActivityClick(event: any) {
    if (event.active && event.active.length > 0) {
      const index = event.active[0].index;
      const label = this.activityChartData.labels![index] as string;
      this.navigateToSheets('cartera', label);
    }
  }

  onAmortClick(event: any) {
    if (event.active && event.active.length > 0) {
      const index = event.active[0].index;
      const label = this.amortChartData.labels![index] as string;
      this.navigateToSheets('cartera', label);
    }
  }

  onMoraChartClick(event: any) {
    if (event.active && event.active.length > 0) {
      const index = event.active[0].index;
      const label = this.moraChartData.labels![index] as string;
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

  // Data Processing Helpers
  getProcessedData(data: any[], settingsKey: string) {
    if (!data) return { items: [], total: 0, pages: 1 };

    const settings = this.tableSettings[settingsKey];

    // 1. Search
    let filtered = data;
    if (settings.search) {
      const term = settings.search.toLowerCase();
      filtered = data.filter(item => {
        return Object.values(item).some(val =>
          val !== null && val !== undefined && String(val).toLowerCase().includes(term)
        );
      });
    }

    // 2. Pagination
    const total = filtered.length;
    const pageSize = settings.pageSize === 'all' ? total : parseInt(settings.pageSize);
    const pages = Math.ceil(total / pageSize) || 1;

    // Adjust current page if out of bounds
    if (settings.page > pages) settings.page = pages;
    if (settings.page < 1) settings.page = 1;

    const start = (settings.page - 1) * pageSize;
    const items = settings.pageSize === 'all' ? filtered : filtered.slice(start, start + pageSize);

    return { items, total, pages };
  }

  changePage(settingsKey: string, delta: number) {
    const settings = this.tableSettings[settingsKey];
    settings.page += delta;
  }
}