import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '#/components/ui/dialog';

export interface ActiveImagePreviewState {
  altText: string;
  imageUrl: string;
  materialName: string;
  rendererName: string;
}

interface ImagePreviewDialogProps {
  image: ActiveImagePreviewState;
  onClose: () => void;
}

export function ImagePreviewDialog({ image, onClose }: ImagePreviewDialogProps) {
  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto p-0 sm:max-w-6xl">
        <DialogHeader className="border-b border-border bg-background/95 px-5 py-4">
          <DialogTitle>Rendered image</DialogTitle>
          <DialogDescription>
            {image.materialName} - {image.rendererName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center bg-muted/10 px-5 py-4">
          <img
            alt={image.altText}
            className="max-h-[70vh] w-auto max-w-full border border-border object-contain"
            src={image.imageUrl}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
