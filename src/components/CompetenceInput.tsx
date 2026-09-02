type CompetenceInputProps = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
};

export function CompetenceInput({ value, onChange, required, disabled }: CompetenceInputProps) {
  return (
    <input
      type="month"
      required={required}
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
