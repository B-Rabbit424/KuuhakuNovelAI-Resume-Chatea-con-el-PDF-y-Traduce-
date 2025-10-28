import { ChangeDetectionStrategy, Component, signal, WritableSignal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PdfParserService } from './services/pdf-parser.service';
import { GeminiService, ChatMessage } from './services/gemini.service';
import { LoadingSpinnerComponent } from './components/loading-spinner.component';
import { ChatbotComponent } from './components/chatbot/chatbot.component';

type View = 'upload' | 'summary' | 'chat' | 'translate';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingSpinnerComponent, ChatbotComponent],
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
  rawSummaryResult = signal('');
  redoSummaryRequest = signal('');

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
    this.rawSummaryResult.set('');
    try {
      const rawResult = await this.geminiService.generateSummary(this.pdfText(), this.summaryQuestion());
      this.rawSummaryResult.set(rawResult);
      this.summaryResult.set(this.geminiService.formatText(rawResult));
    } catch (error: any) {
      console.error('Error generating summary:', error);
      this.summaryResult.set(error.message || 'Lo siento, ha ocurrido un error al generar el resumen.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async redoSummary(): Promise<void> {
    const request = this.redoSummaryRequest().trim();
    if (!this.pdfText() || !this.rawSummaryResult() || !request) return;
    
    this.isLoading.set(true);
    try {
      const newRawSummary = await this.geminiService.refineSummary(
        this.pdfText(),
        this.rawSummaryResult(),
        request
      );
      this.rawSummaryResult.set(newRawSummary);
      this.summaryResult.set(this.geminiService.formatText(newRawSummary));
      this.redoSummaryRequest.set('');
    } catch (error: any) {
      console.error('Error redoing summary:', error);
      this.summaryResult.set(this.geminiService.formatText(this.rawSummaryResult() + `\n\nError: ${error.message || 'No se pudo refinar el resumen.'}`));
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
    
    this.chatHistory.update(history => [...history, { role: 'model', parts: [{ text: ''}] }]);

    try {
        const stream = this.geminiService.chatWithContextStream(this.pdfText(), this.chatHistory());
        
        let fullResponse = '';
        for await (const chunk of stream) {
            const chunkText = chunk.text;
            fullResponse += chunkText;
            this.chatHistory.update(history => {
                const lastMessage = history[history.length - 1];
                if (lastMessage.role === 'model') {
                    lastMessage.parts[0].text = fullResponse;
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
      const rawResult = await this.geminiService.translateText(this.pdfText());
      this.translationResult.set(this.geminiService.formatText(rawResult));
      this.translationState.set('done');
    } catch (error: any) {
      console.error('Error translating document:', error);
      this.translationResult.set(error.message || 'Lo siento, ha ocurrido un error durante la traducción.');
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
    this.rawSummaryResult.set('');
    this.redoSummaryRequest.set('');
    this.chatHistory.set([]);
    this.userChatInput.set('');
    this.translationResult.set('');
    this.translationState.set('idle');
  }
}