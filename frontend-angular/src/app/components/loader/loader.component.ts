import { Component, AfterViewInit, ElementRef, ViewChild, Input, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loader.component.html',
  styleUrls: ['./loader.component.scss']
})
export class LoaderComponent implements AfterViewInit {
  @ViewChild('typewriter') typewriterElRef!: ElementRef<HTMLElement>;
  @Input() fullscreen = true;

  @HostBinding('class.fullscreen') get isFullscreen() {
    return this.fullscreen;
  }

  private readonly text = "CHARGEMENT DU PROGRAMME";
  private i = 0;
  private isDeleting = false;

  ngAfterViewInit() {
    // Démarrer l'animation après un court délai pour s'assurer que la vue est initialisée
    this.typeWriter();
  }

  private typeWriter(): void {
    const typewriterEl = this.typewriterElRef.nativeElement;
    if (!this.isDeleting && this.i < this.text.length) {
      // Ajout de caractère
      typewriterEl.textContent += this.text.charAt(this.i);
      this.i++;
      setTimeout(() => this.typeWriter(), 100 + Math.random() * 100); // Vitesse variable
    } else if (this.isDeleting && typewriterEl.textContent && typewriterEl.textContent.length > 0) {
      // Suppression de caractère
      typewriterEl.textContent = typewriterEl.textContent.slice(0, -1);
      setTimeout(() => this.typeWriter(), 50);
    } else if (this.i >= this.text.length && !this.isDeleting) {
      // Pause avant de commencer à supprimer
      this.isDeleting = true;
      setTimeout(() => this.typeWriter(), 2000);
    } else if (typewriterEl.textContent?.length === 0 && this.isDeleting) {
      // Pause avant de recommencer à taper
      this.isDeleting = false;
      this.i = 0;
      setTimeout(() => this.typeWriter(), 500);
    }
  }
}
