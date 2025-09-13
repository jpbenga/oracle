import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ArchitectsSimulator } from './architects-simulator';

describe('ArchitectsSimulator', () => {
  let component: ArchitectsSimulator;
  let fixture: ComponentFixture<ArchitectsSimulator>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArchitectsSimulator]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ArchitectsSimulator);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
