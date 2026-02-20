import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.scss']
})
export class UploadComponent {
  selectedFile: File | null = null;
  categoria: string = 'cartera'; // Valor por defecto
  cargando: boolean = false;
  mensaje: string = '';
  status: 'success' | 'error' | '' = '';

  constructor(private http: HttpClient) { }

  // Se ejecuta cuando seleccionas un archivo en el input
  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      this.selectedFile = file;
    }
  }

  // Se ejecuta al hacer clic en el botón
  procesar(): void {
    if (!this.selectedFile) {
      this.mensaje = 'Por favor, selecciona un archivo primero.';
      this.status = 'error';
      return;
    }

    this.cargando = true;
    this.mensaje = 'Enviando y procesando información...';
    this.status = '';

    // Creamos el FormData para enviar el binario y la categoría
    const formData = new FormData();
    formData.append('data', this.selectedFile);
    formData.append('categoria', this.categoria);

    // Utilizamos la URL global de los environments
    const webhookUrl = environment.n8nWebhookUrl;

    this.http.post(webhookUrl, formData).subscribe({
      next: (response: any) => {
        console.log('Respuesta de n8n:', response);

        // n8n often returns an array. Let's check if any item is an error item
        const responseArray = Array.isArray(response) ? response : [response];
        const errorItem = responseArray.find(item => item && (item.errorMessage || item.error));

        if (errorItem) {
          this.mensaje = 'Error desde n8n: ' + (errorItem.errorMessage || errorItem.error);
          this.status = 'error';
          this.cargando = false;
          return;
        }

        if (response && response.message) {
          this.mensaje = response.message;
        } else if (responseArray.length > 0) {
          this.mensaje = 'Procesado con éxito y guardado en la Base de Datos';
        } else {
          this.mensaje = 'El proceso terminó sin devolver datos (podría ser un archivo vacío or filtrado)';
        }
        this.status = 'success';
        this.cargando = false;
        // Keep the file selected so the user knows what they uploaded, 
        // but the 'cargando' state is off.
      },
      error: (err) => {
        console.error('Error completo:', err);

        // n8n envía los errores HTTP 500 con un body que Angular envuelve en HttpErrorResponse
        let errMsg = 'Hubo un error en el servidor. Revisa n8n.';

        if (err.error) {
          if (err.error.errorMessage) {
            errMsg = 'Falló n8n: ' + err.error.errorMessage;
            if (err.error.errorDescription) {
              errMsg += ' | ' + err.error.errorDescription;
            }
          } else if (err.error.message) {
            errMsg = err.error.message;
          }
        }

        this.mensaje = errMsg;
        this.status = 'error';
        this.cargando = false;
      }
    });
  }

  // Permite limpiar todo y volver a empezar
  reset(): void {
    this.selectedFile = null;
    this.mensaje = '';
    this.status = '';
    this.cargando = false;
    // Forzar el reset del input file en el DOM si es necesario
    const fileInput = document.querySelector('.file-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }
}
