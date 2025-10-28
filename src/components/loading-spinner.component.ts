import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'loading-spinner',
  standalone: true,
  template: `
    <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
  `,
  styles: [':host { display: inline-flex; justify-content: center; align-items: center; }'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadingSpinnerComponent {}
