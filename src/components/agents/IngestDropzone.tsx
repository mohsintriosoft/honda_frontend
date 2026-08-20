import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export function IngestDropzone({
  accept = "audio/*",
  multiple = true,
  title = "Drop call recordings here or click to browse",
  hint = "MP3, WAV, OGG, M4A • folder drop supported",
  onFiles,
}: {
  accept?: string;
  multiple?: boolean;
  title?: string;
  hint?: string;
  onFiles: (files: File[]) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFiles(Array.from(e.dataTransfer.files));
      }}
      onClick={() => ref.current?.click()}
      className={cn(
        "rounded-xl border border-dashed p-8 text-center cursor-pointer transition-colors",
        over ? "border-primary bg-primary/5" : "hover:bg-accent/40",
      )}
    >
      <Upload className="size-6 mx-auto text-muted-foreground" />
      <div className="mt-2 text-sm font-medium">{title}</div>
      <div className="text-xs text-muted-foreground">{hint}</div>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </div>
  );
}
