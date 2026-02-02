import { useState, useCallback } from "react";
import {
  Maximize2,
  Download,
  Link2,
  Copy,
  X,
  Loader2,
  Sparkles,
  ImageIcon,
  Palette,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type GeneratedImage = {
  id: string;
  url: string;
  prompt: string;
  model: "flux" | "pony" | "auto";
  provider?: string;
  generationTime?: number;
  createdAt: Date;
  size?: string;
};

interface ImageCardProps {
  image: GeneratedImage;
  onFullscreen: (image: GeneratedImage) => void;
}

function ImageCard({ image, onFullscreen }: ImageCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleDownload = async () => {
    try {
      const response = await fetch(image.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${image.model}-${image.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Image downloaded");
    } catch {
      toast.error("Failed to download image");
    }
  };

  const handleCopyLink = async () => {
    const shareUrl = `${window.location.origin}/images/${image.id}`;
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied to clipboard");
  };

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(image.url);
    toast.success("Image URL copied");
  };

  const modelConfig = {
    flux: { label: "Flux", color: "bg-blue-500/20 text-blue-400", icon: Wand2 },
    pony: { label: "Pony", color: "bg-pink-500/20 text-pink-400", icon: Palette },
    auto: { label: "Auto", color: "bg-cyan-500/20 text-cyan-400", icon: Sparkles },
  };

  const config = modelConfig[image.model] || modelConfig.auto;
  const ModelIcon = config.icon;

  return (
    <div
      className="group relative rounded-xl overflow-hidden bg-[#0d1117] border border-white/10 transition-all duration-300 hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/10"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="aspect-square relative">
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a12]">
            <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
          </div>
        )}
        <img
          src={image.url}
          alt={image.prompt}
          className={cn(
            "w-full h-full object-cover transition-all duration-500",
            imageLoaded ? "opacity-100" : "opacity-0",
            isHovered ? "scale-105" : "scale-100"
          )}
          onLoad={() => setImageLoaded(true)}
        />
        
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent transition-opacity duration-300",
            isHovered ? "opacity-100" : "opacity-0"
          )}
        />

        <div className="absolute top-3 left-3">
          <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium", config.color)}>
            <ModelIcon className="h-3 w-3" />
            {config.label}
          </div>
        </div>

        {image.generationTime && (
          <div className="absolute top-3 right-3">
            <div className="px-2 py-1 rounded-full bg-black/50 text-white/70 text-xs font-mono">
              {(image.generationTime / 1000).toFixed(1)}s
            </div>
          </div>
        )}

        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 p-4 transition-all duration-300",
            isHovered ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          )}
        >
          <p className="text-white/90 text-sm line-clamp-2 mb-3">{image.prompt}</p>
          
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 bg-white/10 hover:bg-white/20 text-white rounded-lg"
              onClick={() => onFullscreen(image)}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 bg-white/10 hover:bg-white/20 text-white rounded-lg"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 bg-white/10 hover:bg-white/20 text-white rounded-lg"
              onClick={handleCopyLink}
            >
              <Link2 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 bg-white/10 hover:bg-white/20 text-white rounded-lg"
              onClick={handleCopyUrl}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FullscreenModalProps {
  image: GeneratedImage | null;
  onClose: () => void;
}

function FullscreenModal({ image, onClose }: FullscreenModalProps) {
  if (!image) return null;

  const handleDownload = async () => {
    try {
      const response = await fetch(image.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${image.model}-${image.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Image downloaded");
    } catch {
      toast.error("Failed to download image");
    }
  };

  const handleCopyLink = async () => {
    const shareUrl = `${window.location.origin}/images/${image.id}`;
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied to clipboard");
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </button>

      <div className="max-w-[90vw] max-h-[90vh] relative" onClick={(e) => e.stopPropagation()}>
        <img
          src={image.url}
          alt={image.prompt}
          className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
        />
        
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent rounded-b-lg">
          <p className="text-white/90 text-sm mb-4 max-w-2xl">{image.prompt}</p>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-white/70 text-xs">
              <span className="font-medium">{image.model.toUpperCase()}</span>
              {image.generationTime && (
                <>
                  <span className="text-white/30">|</span>
                  <span className="font-mono">{(image.generationTime / 1000).toFixed(1)}s</span>
                </>
              )}
            </div>
            
            <div className="flex-1" />
            
            <Button
              size="sm"
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 gap-2"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 gap-2"
              onClick={handleCopyLink}
            >
              <Link2 className="h-4 w-4" />
              Share Link
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ImageFeedProps {
  images: GeneratedImage[];
  isLoading?: boolean;
  emptyMessage?: string;
}

export function ImageFeed({ images, isLoading, emptyMessage }: ImageFeedProps) {
  const [fullscreenImage, setFullscreenImage] = useState<GeneratedImage | null>(null);

  const handleFullscreen = useCallback((image: GeneratedImage) => {
    setFullscreenImage(image);
  }, []);

  if (isLoading && images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="relative">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center animate-pulse">
            <ImageIcon className="h-8 w-8 text-cyan-400" />
          </div>
          <Loader2 className="absolute -bottom-2 -right-2 h-6 w-6 text-cyan-400 animate-spin" />
        </div>
        <p className="mt-4 text-white/50 text-sm">Generating images...</p>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-600/10 flex items-center justify-center">
          <ImageIcon className="h-8 w-8 text-white/30" />
        </div>
        <p className="mt-4 text-white/50 text-sm">{emptyMessage || "No images yet"}</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((image) => (
          <ImageCard
            key={image.id}
            image={image}
            onFullscreen={handleFullscreen}
          />
        ))}
        
        {isLoading && (
          <div className="aspect-square rounded-xl bg-[#0d1117] border border-white/10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
          </div>
        )}
      </div>

      <FullscreenModal
        image={fullscreenImage}
        onClose={() => setFullscreenImage(null)}
      />
    </>
  );
}

export default ImageFeed;
