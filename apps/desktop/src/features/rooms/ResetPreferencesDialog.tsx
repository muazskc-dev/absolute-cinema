import { RotateCcw } from "lucide-react";

import { useAppStore } from "../../stores/app-store";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Notice } from "../../components/ui/Notice";

export function ResetPreferencesDialog() {
  const { closeDialog, resetPreferences } = useAppStore();

  return (
    <Dialog
      title="Reset local preferences"
      description="Playback defaults, appearance and room preferences return to their initial values."
      onClose={closeDialog}
      footer={
        <>
          <Button variant="ghost" data-autofocus onClick={closeDialog}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={<RotateCcw size={14} />}
            onClick={resetPreferences}
          >
            Reset preferences
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[12px] leading-5 text-ink-secondary">
          This clears the local preference key and re-applies the defaults.
          Demo rooms, chat messages and room passwords are held separately in
          memory and are not affected.
        </p>
        <Notice>
          You can change these values again at any time in Settings.
        </Notice>
      </div>
    </Dialog>
  );
}
