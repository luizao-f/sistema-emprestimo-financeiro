import React, { forwardRef } from 'react';
import { Input } from '@/components/ui/input';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value?: number | string;
  onChange?: (value: number) => void;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, ...props }, ref) => {
    const formatCurrency = (val: number | string) => {
      if (val === '' || val === undefined || val === null) return '';
      const numericValue = typeof val === 'string' ? parseFloat(val) || 0 : val;
      return numericValue.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    const parseCurrency = (val: string) => {
      const cleaned = val.replace(/[^\d,]/g, '').replace(',', '.');
      return parseFloat(cleaned) || 0;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      const numericValue = parseCurrency(inputValue);
      onChange?.(numericValue);
    };

    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          R$
        </span>
        <Input
          {...props}
          ref={ref}
          value={formatCurrency(value || 0)}
          onChange={handleChange}
          className="pl-10"
          placeholder="0,00"
        />
      </div>
    );
  }
);

CurrencyInput.displayName = 'CurrencyInput';