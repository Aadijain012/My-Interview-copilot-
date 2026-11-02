export function PermissionMatrixTable({
  sections,
  selectedPermissions,
  onTogglePermission,
  isReadOnly,
}) {
  const renderActionCell = (permission, actionName, sectionLabel) => {
    if (!permission) {
      return (
        <td
          className="perm-matrix__cell perm-matrix__cell--na"
          aria-label={`${actionName} not available for ${sectionLabel}`}
        >
          <span className="perm-na" aria-hidden="true">
            —
          </span>
        </td>
      );
    }

    const isChecked = selectedPermissions.has(permission);

    return (
      <td className="perm-matrix__cell">
        <label className="perm-matrix__checkbox-label">
          <input
            type="checkbox"
            className="perm-matrix__checkbox"
            checked={isChecked}
            disabled={isReadOnly}
            onChange={() => onTogglePermission(permission)}
            aria-label={`${actionName} permission (${permission}) for ${sectionLabel}`}
            title={permission}
          />

          <span className="perm-matrix__checkbox-custom" />
        </label>
      </td>
    );
  };

  return (
    <div className="perm-matrix-wrapper">
      <table className="perm-matrix" aria-label="Granular permissions matrix">
        <thead>
          <tr>
            <th className="perm-matrix__th perm-matrix__th--section">
              Section
            </th>
            <th className="perm-matrix__th">View / Access</th>
            <th className="perm-matrix__th">Create / Add</th>
            <th className="perm-matrix__th">Edit / Modify</th>
            <th className="perm-matrix__th">Delete / Remove</th>
            <th className="perm-matrix__th">Export / Download</th>
          </tr>
        </thead>
        <tbody>
          {sections.map((sec) => (
            <tr key={sec.id} className="perm-matrix__row">
              <td className="perm-matrix__cell perm-matrix__cell--section">
                <div className="perm-section-cell">
                  <span className="perm-section-cell__name">{sec.label}</span>
                  <span className="perm-section-cell__desc">
                    {sec.description}
                  </span>
                </div>
              </td>
              {renderActionCell(sec.actions.view, "View / Access", sec.label)}
              {renderActionCell(sec.actions.create, "Create / Add", sec.label)}
              {renderActionCell(sec.actions.edit, "Edit / Modify", sec.label)}
              {renderActionCell(
                sec.actions.delete,
                "Delete / Remove",
                sec.label,
              )}
              {renderActionCell(
                sec.actions.export,
                "Export / Download",
                sec.label,
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
