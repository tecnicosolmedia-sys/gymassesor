import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileDown, X } from 'lucide-react';
import { buildWorkoutPDF, getWorkoutPDFFilename, ExportData } from '@/utils/exportWorkoutPDF';

interface PDFPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ExportData | null;
}

export const PDFPreviewDialog = ({ open, onOpenChange, data }: PDFPreviewDialogProps) => {
  const [url, setUrl] = useState<string | null>(null);

  const doc = useMemo(() => (data && open ? buildWorkoutPDF(data) : null), [data, open]);

  useEffect(() => {
    if (!doc) {
      setUrl(null);
      return;
    }
    const blob = doc.output('blob');
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [doc]);

  const handleDownload = () => {
    if (!data || !doc) return;
    doc.save(getWorkoutPDFFilename(data));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border flex-shrink-0">
          <DialogTitle className="flex items-center justify-between gap-2">
            <span className="truncate">Vista previa del PDF</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 bg-muted/30">
          {url ? (
            <iframe
              src={`${url}#toolbar=0&navpanes=0`}
              title="Vista previa del PDF"
              className="w-full h-full border-0"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
              Generando vista previa…
            </div>
          )}
        </div>

        <DialogFooter className="px-4 py-3 border-t border-border flex-shrink-0 flex-row justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4" />
            Cancelar
          </Button>
          <Button onClick={handleDownload} disabled={!doc}>
            <FileDown className="w-4 h-4" />
            Descargar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
