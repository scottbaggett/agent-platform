import { createFileRoute } from "@tanstack/react-router";
import { ProtoEditorPage } from "@/components/proto-editor/ProtoEditorPage";

export const Route = createFileRoute("/proto-editor/")({
  component: ProtoEditorPage,
});
