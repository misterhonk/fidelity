/**
 * The File System Access API, as much of it as the vault uses.
 *
 * TypeScript's DOM library does not ship these yet: the spec is a WICG draft
 * that Chromium implements and WebKit does not, and `lib.dom.d.ts` follows
 * what is standard rather than what is available. Declaring the three members
 * this app touches is more honest than casting to `any` at four call sites —
 * and it documents which parts are being relied on.
 */
interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite'
}

interface FileSystemFileHandle {
  queryPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  requestPermission?(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<PermissionState>
}

interface SaveFilePickerOptions {
  suggestedName?: string
  types?: { description?: string; accept: Record<string, string[]> }[]
}

interface Window {
  /** Absent in WebKit, which is every browser on an iPhone. */
  showSaveFilePicker?(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>
}
