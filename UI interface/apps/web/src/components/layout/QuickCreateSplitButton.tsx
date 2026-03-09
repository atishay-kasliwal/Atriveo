import { useMemo } from "react";
import DropdownButton from "../ui/DropdownButton";

type QuickCreateSplitButtonProps = {
  onNewApplication: () => void;
  onCreateTask: () => void;
  onLogNote: () => void;
  className?: string;
};

type SplitActionId = "application" | "task" | "note";

type SplitAction = {
  id: SplitActionId;
  label: string;
  run: () => void;
};

export default function QuickCreateSplitButton({
  onNewApplication,
  onCreateTask,
  onLogNote,
  className = "",
}: QuickCreateSplitButtonProps) {
  const actions = useMemo<SplitAction[]>(
    () => [
      { id: "application", label: "New Application", run: onNewApplication },
      { id: "task", label: "Create Task", run: onCreateTask },
      { id: "note", label: "Log Note", run: onLogNote },
    ],
    [onNewApplication, onCreateTask, onLogNote],
  );

  return (
    <DropdownButton
      label="Application"
      onPrimaryAction={onNewApplication}
      className={className}
      items={actions.map((action) => ({
        id: action.id,
        label: action.label,
        onSelect: action.run,
      }))}
    />
  );
}
