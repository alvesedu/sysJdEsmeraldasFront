export function currentCompetence() {
  return new Date().toISOString().slice(0, 7);
}

export function formatCompetence(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) return value;
  const [year, month] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('pt-BR', {
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC'
  });
}
