import { useState } from "react";
import { FileText, Plus, Trash2, ExternalLink } from "lucide-react";
import type { Project } from "@/shared/types";
import { useResearchStore } from "@/modules/research/store";
import { useProjectStore } from "@/modules/projects/store";
import { bus } from "@/kernel/event-bus";
import { cn } from "@/shared/utils";

export function ProjectFiles({ project }: { project: Project }) {
  const { sources } = useResearchStore();
  const { updateProject } = useProjectStore();

  const projectFiles = sources.filter((s) => project.attachments.includes(s.id));

  const handleLinkFile = () => {
    // For now, we can just trigger a general 'import source' flow or show a picker.
    // In a full implementation, we would show a picker of existing sources + an upload button.
    bus.emit("command-palette:open" as any, undefined);
  };

  const handleUnlink = (sourceId: string) => {
    void updateProject(project.id, {
      attachments: project.attachments.filter((id) => id !== sourceId),
    });
  };

  const handleOpen = (sourceId: string) => {
    bus.emit("navigate:to", { path: "/research" });
    setTimeout(() => {
      bus.emit("research:open-source" as any, { sourceId });
    }, 50);
  };

  if (projectFiles.length === 0) {
    return (
      <div className="p-10 text-center text-muted-foreground flex flex-col items-center">
        <FileText size={40} className="mb-4 opacity-20" />
        <p className="text-sm mb-4">No files attached to this project.</p>
        <button
          onClick={handleLinkFile}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium text-sm rounded-lg hover:bg-primary/90 transition-fast"
        >
          <Plus size={16} />
          Attach File
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium text-foreground">Attached Files</h3>
        <button
          onClick={handleLinkFile}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          <Plus size={12} />
          Attach more
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {projectFiles.map((file) => (
          <div
            key={file.id}
            className="group flex flex-col p-3 rounded-xl border border-border bg-surface-2 hover:border-primary/40 transition-fast"
          >
            <div className="flex items-start justify-between gap-3">
              <div 
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => handleOpen(file.id)}
              >
                <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-fast">
                  {file.title}
                </p>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-1">
                  {file.type} {file.sizeBytes ? `• ${(file.sizeBytes / 1024).toFixed(0)} KB` : ""}
                </p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-fast">
                <button
                  onClick={() => handleOpen(file.id)}
                  className="p-1.5 text-muted-foreground hover:text-primary rounded-md"
                  title="Open file"
                >
                  <ExternalLink size={14} />
                </button>
                <button
                  onClick={() => handleUnlink(file.id)}
                  className="p-1.5 text-muted-foreground hover:text-red-500 rounded-md"
                  title="Remove from project"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
