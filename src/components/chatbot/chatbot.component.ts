import { ChangeDetectionStrategy, Component, input, output, signal, WritableSignal } from '@angular/core';
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
  pdfText = input.required<string>();
  chatHistory = input.required<WritableSignal<ChatMessage[]>>();
  userChatInput = input.required<WritableSignal<string>>();
  isStreaming = input.required<boolean>();
  sendMessage = output<void>();

  onSendMessage() {
    this.sendMessage.emit();
  }
}
