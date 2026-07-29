import { useState, useRef, useCallback } from 'react';
import { Upload, X, FileIcon, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/ds/Toast';
import { fileToDataUrl } from '@/lib/image-upload';

interface UploadingFile {
  id: string;
  name: string;
  type: string;
  size: number;
  preview?: string;
  progress: boolean;
}

interface Props {
  referralId?: string;
  onUpload: (file: File, dataUrl: string) => Promise<void>;
  files?: { id: string; fileName: string; fileType: string; fileUrl?: string }[];
  onDelete?: (id: string) => void;
  disabled?: boolean;
}

const ALLOWED = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.dcm,.dicom,.stl,.obj,.zip';
const MAX_SIZE = 10 * 1024 * 1024;

export default function FileUploader({ referralId, onUpload, files, onDelete, disabled }: Props) {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<UploadingFile[]>([]);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList?.length || !onUpload) return;
    for (const file of Array.from(fileList)) {
      if (file.size > MAX_SIZE) { toast.warn(`Файл ${file.name} больше 10 МБ`); continue; }
      const id = Math.random().toString(36).slice(2);
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      setUploading(prev => [...prev, { id, name: file.name, type: file.type, size: file.size, preview, progress: true }]);
      try {
        const dataUrl = await fileToDataUrl(file);
        await onUpload(file, dataUrl);
        setUploading(prev => prev.filter(f => f.id !== id));
      } catch (e: any) {
        toast.error(e.message || 'Ошибка загрузки');
        setUploading(prev => prev.filter(f => f.id !== id));
      }
    }
  }, [onUpload, toast]);

  const getIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.includes('pdf')) return '📄';
    if (type.includes('dicom') || type.includes('dcm')) return '🩻';
    if (type.includes('stl') || type.includes('obj')) return '🧊';
    return '📎';
  };

  return (
    <div className="space-y-2">
      <div
        onClick={() => !disabled && ref.current?.click()}
        className={`border-2 border-dashed border-bdr-subtle rounded-xl p-4 text-center cursor-pointer transition-colors hover:border-dv-gold/40 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <Upload size={20} className="mx-auto text-txt-muted mb-1" />
        <p className="text-xs text-txt-muted">Нажмите для загрузки файлов</p>
        <p className="text-[10px] text-txt-ghost mt-0.5">JPG, PNG, PDF, DICOM, STL до 10 МБ</p>
        <input ref={ref} type="file" multiple accept={ALLOWED} onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}
          className="hidden" disabled={disabled} />
      </div>

      {uploading.length > 0 && (
        <div className="space-y-1">
          {uploading.map(f => (
            <div key={f.id} className="flex items-center gap-2 p-2 bg-surface-1 rounded-lg">
              {f.preview ? <img src={f.preview} className="w-8 h-8 rounded object-cover" alt="" /> : <span>{getIcon(f.type)}</span>}
              <span className="text-xs text-txt-primary flex-1 truncate">{f.name}</span>
              <Loader2 size={14} className="animate-spin text-dv-gold" />
            </div>
          ))}
        </div>
      )}

      {files && files.length > 0 && (
        <div className="space-y-1">
          {files.map(f => (
            <div key={f.id} className="flex items-center gap-2 p-2 bg-surface-1 rounded-lg group">
              <span>{getIcon(f.fileType)}</span>
              <span className="text-xs text-txt-primary flex-1 truncate">{f.fileName}</span>
              {onDelete && (
                <button aria-label="Delete file" onClick={() => onDelete(f.id)} className="opacity-0 group-hover:opacity-100 text-error transition-opacity">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
