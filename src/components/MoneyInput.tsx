type MoneyInputProps = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
};

export function MoneyInput({ value, onChange, required, disabled, placeholder = '250,00' }: MoneyInputProps) {
  return (
    <input
      required={required}
      disabled={disabled}
      inputMode="decimal"
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
