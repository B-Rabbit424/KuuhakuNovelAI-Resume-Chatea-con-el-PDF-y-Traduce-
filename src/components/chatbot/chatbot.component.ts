import { ChangeDetectionStrategy, Component, input, output, WritableSignal, ElementRef, viewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatMessage } from '../../services/gemini.service';
import { LoadingSpinnerComponent } from '../loading-spinner.component';

@Component({
  selector: 'chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingSpinnerComponent],
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatbotComponent {
  chatHistory = input.required<ChatMessage[]>();
  userChatInput: WritableSignal<string> = input.required<WritableSignal<string>>();
  isStreaming = input.required<boolean>();
  sendMessage = output<void>();

  chatContainer = viewChild<ElementRef<HTMLDivElement>>('chatContainer');

  constructor() {
    effect(() => {
      // This effect runs whenever chatHistory changes.
      this.chatHistory(); 
      this.scrollToBottom();
    });
  }
  
  onSendMessage() {
    this.sendMessage.emit();
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const element = this.chatContainer()?.nativeElement;
      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    }, 0);
  }
}
