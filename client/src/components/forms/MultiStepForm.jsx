/**
 * Wraps a form that is filled in over several steps (used by lecturer
 * registration). Shows a progress indicator; the parent decides which step's
 * fields to render and when to move between steps.
 */
export function MultiStepForm({ steps, currentStep, onSubmit, children }) {
  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <ol className="steps" aria-label="Progress">
        {steps.map((title, index) => (
          <li
            key={title}
            className={index === currentStep ? 'active' : index < currentStep ? 'done' : undefined}
            aria-current={index === currentStep ? 'step' : undefined}
          >
            Step {index + 1}: {title}
          </li>
        ))}
      </ol>
      {children}
    </form>
  );
}
