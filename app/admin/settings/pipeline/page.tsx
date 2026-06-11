import { listStageRows } from "@/lib/stages";
import { getSettings } from "@/lib/stages/settings";
import { PipelineSettingsForm } from "./pipeline-settings-form";

export const dynamic = "force-dynamic";

export default async function PipelineSettingsPage() {
  const [stages, settings] = await Promise.all([
    listStageRows(),
    getSettings(),
  ]);

  return (
    <div className="flex-1 overflow-auto px-6 py-6 space-y-6">
      <header>
        <h1 className="text-(--adm-text) text-2xl mb-1">Pipeline settings</h1>
        <p className="text-(--adm-text-muted) text-xs">
          Where new inquiries land, where booked calls promote to, and when
          a quiet lead reads as cold. Every stage stays renameable —
          behavior follows these pointers, not names.
        </p>
      </header>

      <PipelineSettingsForm
        stages={stages}
        entryStageId={settings.entryStageId}
        bookingStageId={settings.bookingStageId}
        coldThresholdDays={settings.coldThresholdDays}
      />
    </div>
  );
}
