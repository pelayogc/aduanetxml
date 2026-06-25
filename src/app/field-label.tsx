interface FieldLabelProps {
  htmlFor?: string;
  children: React.ReactNode;
  help: string;
}

export function FieldLabel({ htmlFor, children, help }: FieldLabelProps) {
  return (
    <div className="field-label">
      <label htmlFor={htmlFor}>{children}</label>
      <details className="field-help">
        <summary aria-label={`Ayuda: ${children}`}>?</summary>
        <span>{help}</span>
      </details>
    </div>
  );
}
