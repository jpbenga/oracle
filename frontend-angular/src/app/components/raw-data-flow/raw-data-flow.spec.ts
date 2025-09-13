import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RawDataFlow } from './raw-data-flow';

describe('RawDataFlow', () => {
  let component: RawDataFlow;
  let fixture: ComponentFixture<RawDataFlow>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RawDataFlow]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RawDataFlow);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
