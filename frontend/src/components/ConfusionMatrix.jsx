import React from 'react';

export default function ConfusionMatrix({
  data,
  title = 'Confusion matrix',
  description = 'Rows are actual classes; columns are predicted classes.',
  selectedCell,
  onCellClick,
}) {
  if (!data?.classes?.length || !data?.matrix?.length) return null;

  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <div className="matrix-wrap">
        <table className="matrix">
          <thead>
            <tr>
              <th aria-label="Actual class" />
              {data.classes.map((className) => (
                <th key={className} className={`class-${className}`}>{className}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.classes.map((actualClass, rowIndex) => (
              <tr key={actualClass}>
                <th scope="row" className={`row-label class-${actualClass}`}>{actualClass}</th>
                {data.classes.map((predictedClass, columnIndex) => {
                  const count = data.matrix[rowIndex][columnIndex];
                  const isSelected = selectedCell?.actual === actualClass
                    && selectedCell?.predicted === predictedClass;
                  return (
                    <td key={predictedClass}>
                      <button
                        type="button"
                        className={`matrix-cell ${rowIndex === columnIndex ? 'diagonal' : ''} ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => onCellClick?.(actualClass, predictedClass, count)}
                        aria-label={`${actualClass} predicted as ${predictedClass}: ${count.toLocaleString()}`}
                      >
                        {count.toLocaleString()}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {onCellClick && <p className="muted small">Select a cell to inspect matching examples where available.</p>}
    </section>
  );
}
