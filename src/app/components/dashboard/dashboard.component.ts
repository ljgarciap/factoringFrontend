import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule, HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  template: `
    <div class="dashboard-wrapper">
      <div class="toolbar">
        <div class="info">
          <h3>📊 Análisis de Operaciones</h3>
          <p>Los datos se sincronizan con el backend de Laravel.</p>
        </div>
        <button (click)="loadStats()" class="btn-refresh" [class.spinning]="isRefreshing">
          <span class="icon">{{ isRefreshing ? '⌛' : '🔄' }}</span> 
          {{ isRefreshing ? 'Cargando...' : 'Actualizar Informe' }}
        </button>
      </div>
      
      <div class="stats-container" *ngIf="!isLoading && stats">
        <div class="stat-card">
          <h4>Cartera</h4>
          <div class="value">{{ stats.total_cartera }}</div>
          <p>Operaciones registradas</p>
        </div>
        <div class="stat-card">
          <h4>Factoring Op</h4>
          <div class="value">{{ stats.total_factoring_op }}</div>
          <p>Operaciones registradas</p>
        </div>
        <div class="stat-card">
          <h4>Factoring Pagos</h4>
          <div class="value">{{ stats.total_factoring_pagos }}</div>
          <p>Pagos registrados</p>
        </div>
        <div class="stat-card">
          <h4>Confirming</h4>
          <div class="value">{{ stats.total_confirming }}</div>
          <p>Operaciones registradas</p>
        </div>
      </div>

      <div class="loading-state" *ngIf="isLoading">
        Cargando estadísticas...
      </div>
    </div>
  `,
  styles: [`
    .dashboard-wrapper {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 80px); /* Ajusta esto según el alto de tu navbar */
      background: #f4f7f6;
    }

    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: white;
      padding: 15px 30px;
      border-bottom: 1px solid #e0e0e0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      z-index: 10;

      h3 { margin: 0; font-size: 1.2rem; color: #1e1e2d; }
      p { margin: 5px 0 0; color: #7f8c8d; font-size: 0.85rem; }
    }

    .btn-refresh {
      background: #3498db;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: all 0.2s;

      &:hover { background: #2980b9; transform: translateY(-1px); }
      &:active { transform: translateY(0); }
    }

    .stats-container {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      padding: 30px;
    }

    .stat-card {
      background: white;
      border-radius: 12px;
      padding: 25px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.05);
      border-left: 5px solid #3498db;
      transition: transform 0.2s;

      &:hover {
        transform: translateY(-5px);
      }

      h4 {
        margin: 0;
        color: #7f8c8d;
        font-size: 1rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .value {
        font-size: 2.5rem;
        font-weight: bold;
        color: #2c3e50;
        margin: 15px 0;
      }

      p {
        margin: 0;
        color: #95a5a6;
        font-size: 0.85rem;
      }
    }

    .stat-card:nth-child(2) { border-left-color: #2ecc71; }
    .stat-card:nth-child(3) { border-left-color: #9b59b6; }
    .stat-card:nth-child(4) { border-left-color: #f1c40f; }

    .loading-state {
      padding: 50px;
      text-align: center;
      color: #7f8c8d;
      font-size: 1.2rem;
    }

    .spinning .icon {
      display: inline-block;
      animation: rotate 1s linear infinite;
    }

    @keyframes rotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `]
})
export class DashboardComponent implements OnInit {
  isRefreshing = false;
  isLoading = true;
  stats: any = null;
  // TODO: Use environment variable instead of hardcoded URL in production
  private apiUrl = 'http://localhost:8000/api/dashboard/stats';

  constructor(private http: HttpClient) { }

  ngOnInit() {
    this.loadStats();
  }

  loadStats() {
    this.isRefreshing = true;
    this.isLoading = true;

    this.http.get(this.apiUrl).subscribe({
      next: (data) => {
        this.stats = data;
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
}