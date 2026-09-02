type MessageProps = { children: string };

export function LoadingState({ children = 'Carregando...' }: Partial<MessageProps>) {
  return <p className="loading-text">{children}</p>;
}

export function EmptyState({ children }: MessageProps) {
  return <p className="empty-state">{children}</p>;
}

export function ErrorState({ children }: MessageProps) {
  return <div className="alert error">{children}</div>;
}

export function SuccessState({ children }: MessageProps) {
  return <div className="alert success">{children}</div>;
}
