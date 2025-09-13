import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PredictionCard } from './prediction-card';

describe('PredictionCard', () => {
  let component: PredictionCard;
  let fixture: ComponentFixture<PredictionCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PredictionCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PredictionCard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
