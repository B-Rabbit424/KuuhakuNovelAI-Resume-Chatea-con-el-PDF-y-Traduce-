import { ChangeDetectionStrategy, Component, signal, WritableSignal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PdfParserService } from './services/pdf-parser.service';
import { GeminiService, ChatMessage } from './services/gemini.service';
import { LoadingSpinnerComponent } from './components/loading-spinner.component';

type View = 'upload' | 'summary' | 'chat' | 'translate';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingSpinnerComponent],
  providers: [PdfParserService, GeminiService],
})
export class AppComponent {
  private pdfParserService = inject(PdfParserService);
  private geminiService = inject(GeminiService);

  // State Signals
  currentView: WritableSignal<View> = signal('upload');
  pdfFile = signal<File | null>(null);
  pdfFileName = signal<string>('');
  pdfText = signal<string>('');
  isParsing = signal(false);
  isLoading = signal(false);
  isStreaming = signal(false);
  dragOver = signal(false);

  // Feature specific signals
  summaryQuestion = signal('');
  summaryResult = signal('');

  chatHistory: WritableSignal<ChatMessage[]> = signal([]);
  userChatInput = signal('');
  
  translationResult = signal('');
  translationState: WritableSignal<'idle' | 'translating' | 'done'> = signal('idle');

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.handleFile(event.dataTransfer.files[0]);
    }
  }

  private async handleFile(file: File): Promise<void> {
    if (file.type !== 'application/pdf') {
      alert('Por favor, sube un archivo PDF.');
      return;
    }
    this.pdfFile.set(file);
    this.pdfFileName.set(file.name);
    this.isParsing.set(true);
    this.currentView.set('summary'); // Set initial view after upload

    try {
      const text = await this.pdfParserService.getText(file);
      this.pdfText.set(text);
    } catch (error) {
      console.error('Error parsing PDF:', error);
      alert('Hubo un error al procesar el PDF. Inténtalo de nuevo.');
      this.reset();
    } finally {
      this.isParsing.set(false);
    }
  }

  setView(view: View): void {
    this.currentView.set(view);
  }

  async generateSummary(): Promise<void> {
    if (!this.pdfText()) return;
    this.isLoading.set(true);
    this.summaryResult.set('');
    try {
      const result = await this.geminiService.generateSummary(this.pdfText(), this.summaryQuestion());
      this.summaryResult.set(result);
    } catch (error) {
      console.error('Error generating summary:', error);
      this.summaryResult.set('Lo siento, ha ocurrido un error al generar el resumen.');
    } finally {
      this.isLoading.set(false);
    }
  }
  
  async sendChatMessage(): Promise<void> {
    const userMessage = this.userChatInput().trim();
    if (!userMessage || this.isStreaming()) return;
    
    this.chatHistory.update(history => [...history, { role: 'user', parts: [{ text: userMessage }] }]);
    this.userChatInput.set('');
    this.isStreaming.set(true);
    
    // Add an empty model message to render the container
    this.chatHistory.update(history => [...history, { role: 'model', parts: [{ text: ''}] }]);

    try {
        const stream = this.geminiService.chatWithContextStream(this.pdfText(), this.chatHistory());
        
        for await (const chunk of stream) {
            const chunkText = chunk.text;
            this.chatHistory.update(history => {
                const lastMessage = history[history.length - 1];
                if (lastMessage.role === 'model') {
                    lastMessage.parts[0].text += chunkText;
                }
                return [...history];
            });
        }
    } catch (error) {
        console.error('Error in chat stream:', error);
        this.chatHistory.update(history => {
            const lastMessage = history[history.length - 1];
            if(lastMessage.role === 'model') {
                lastMessage.parts[0].text = 'Lo siento, ha ocurrido un error. Por favor, intenta de nuevo.';
            }
            return [...history];
        });
    } finally {
        this.isStreaming.set(false);
    }
  }

  async translateDocument(): Promise<void> {
    if (!this.pdfText()) return;
    this.translationState.set('translating');
    this.isLoading.set(true);
    this.translationResult.set('');
    try {
      const result = await this.geminiService.translateText(this.pdfText());
      this.translationResult.set(result);
      this.translationState.set('done');
    } catch (error) {
      console.error('Error translating document:', error);
      this.translationResult.set('Lo siento, ha ocurrido un error durante la traducción.');
    } finally {
      this.isLoading.set(false);
    }
  }


  reset(): void {
    this.currentView.set('upload');
    this.pdfFile.set(null);
    this.pdfFileName.set('');
    this.pdfText.set('');
    this.summaryQuestion.set('');
    this.summaryResult.set('');
    this.chatHistory.set([]);
    this.userChatInput.set('');
    this.translationResult.set('');
    this.translationState.set('idle');
  }
}
