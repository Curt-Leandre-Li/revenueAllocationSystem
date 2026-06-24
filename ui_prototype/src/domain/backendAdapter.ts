import type { WorkbenchSnapshot } from "./types";

export async function loadWorkbenchSnapshotFromBackend(): Promise<WorkbenchSnapshot> {
  throw new Error(
    "Legacy backendAdapter is disabled. Use domain/services/backendWorkspace.ts so backend failures cannot fall back to dev-only fixtures.",
  );
}
