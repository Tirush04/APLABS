import React from 'react';
import { Check } from 'lucide-react';

interface StepProgressBarProps {
  currentStep: number;
  onSelectStep: (step: number) => void;
}

export const StepProgressBar: React.FC<StepProgressBarProps> = ({
  currentStep,
  onSelectStep,
}) => {
  const steps = [
    { number: 1, label: 'Your property', sub: 'Characteristics & comps' },
    { number: 2, label: 'Your price', sub: 'Tiers & distribution' },
    { number: 3, label: 'Your plan', sub: 'Revenue, outlook & brief' },
  ];

  return (
    <div className="w-full bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
      <div className="grid grid-cols-3 gap-2 relative">
        {steps.map((step) => {
          const isActive = currentStep === step.number;
          const isCompleted = currentStep > step.number;

          return (
            <button
              key={step.number}
              type="button"
              onClick={() => onSelectStep(step.number)}
              className={`text-left p-2.5 rounded-xl transition-all flex items-center gap-3 group ${
                isActive
                  ? 'bg-teal-50 border border-teal-200 ring-1 ring-teal-700'
                  : 'hover:bg-slate-50'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                  isCompleted
                    ? 'bg-teal-800 text-white'
                    : isActive
                    ? 'bg-teal-700 text-white'
                    : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                }`}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : step.number}
              </div>

              <div className="truncate">
                <p
                  className={`text-xs font-bold truncate ${
                    isActive ? 'text-teal-950' : 'text-slate-800'
                  }`}
                >
                  Step {step.number}: {step.label}
                </p>
                <p className="text-[11px] text-slate-500 truncate hidden sm:block">
                  {step.sub}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
