import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Icon } from "@/components/Icon";

type ProductGalleryProps = {
  productName: string;
  productSlug: string;
  badge?: string;
  images: string[];
  selectedImage: string;
  onSelectImage: (image: string) => void;
};

export const ProductGallery = ({
  productName,
  productSlug,
  badge,
  images,
  selectedImage,
  onSelectImage
}: ProductGalleryProps) => {
  const [mainLoaded, setMainLoaded] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, true>>({});

  const galleryImages = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of images) {
      const value = raw.trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      out.push(value);
    }
    return out;
  }, [images]);

  useEffect(() => {
    if (galleryImages.length === 0) {
      if (selectedImage) {
        onSelectImage("");
      }
      return;
    }

    if (!galleryImages.includes(selectedImage)) {
      onSelectImage(galleryImages[0]!);
    }
  }, [galleryImages, onSelectImage, selectedImage]);

  useEffect(() => {
    setMainLoaded(false);
  }, [selectedImage]);

  useEffect(() => {
    if (!fullscreenOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFullscreenOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreenOpen]);

  const displaySrc = failedImages[selectedImage] ? "" : selectedImage;

  return (
    <div className="col-span-12 lg:col-span-7 min-w-0">
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 min-w-0">
        {galleryImages.length > 0 ? (
          <div className="order-2 lg:order-none flex flex-row lg:flex-col gap-3 lg:gap-4 lg:w-20 shrink-0 overflow-x-auto lg:overflow-y-auto lg:overflow-x-hidden no-scrollbar pb-1 lg:pb-0 -mx-1 px-1 lg:mx-0 lg:px-0 w-full lg:w-auto lg:max-h-[min(88dvh,640px)]">
            {galleryImages.map((img) => {
              const active = selectedImage === img;
              const thumbSrc = failedImages[img] ? "" : img;
              return (
                <button
                  key={img}
                  type="button"
                  onClick={() => onSelectImage(img)}
                  className={`flex-shrink-0 w-16 sm:w-20 aspect-[3/4] bg-surface-container-low overflow-hidden rounded-sm group border-2 transition-colors ${
                    active ? "border-secondary" : "border-transparent hover:border-outline-variant"
                  }`}
                  aria-label={`View image of ${productName}`}
                  aria-pressed={active}
                >
                  {thumbSrc ? (
                    <img
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      src={thumbSrc}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      onError={() => setFailedImages((prev) => ({ ...prev, [img]: true }))}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-outline">
                      <Icon name="image" className="text-xl" />
                    </div>
                  )}
                </button>
              );
            })}
            <Link
              to={`/products/${productSlug}/media`}
              className="flex-shrink-0 w-16 sm:w-20 aspect-[3/4] bg-surface-container-low flex flex-col items-center justify-center text-outline hover:bg-surface-container-high transition-colors"
            >
              <Icon name="360" className="text-xl sm:text-2xl" />
              <span className="text-[10px] font-label font-bold uppercase mt-1">Gallery</span>
            </Link>
          </div>
        ) : null}
        <div className="order-1 lg:order-none w-full min-w-0 flex-1 relative aspect-[3/4] sm:aspect-[4/5] lg:aspect-[4/5] max-h-[min(78dvh,560px)] sm:max-h-[min(88dvh,640px)] lg:max-h-none bg-surface-container-low overflow-hidden rounded-sm group">
          {!mainLoaded && displaySrc ? <div className="absolute inset-0 animate-pulse bg-surface-container-high" /> : null}
          {displaySrc ? (
            <img
              className="absolute inset-0 w-full h-full object-cover object-center cursor-zoom-in transition-transform duration-700 md:group-hover:scale-110"
              src={displaySrc}
              alt={productName}
              loading="lazy"
              decoding="async"
              onLoad={() => setMainLoaded(true)}
              onError={() => {
                setFailedImages((prev) => ({ ...prev, [selectedImage]: true }));
                setMainLoaded(true);
              }}
              onClick={() => setFullscreenOpen(true)}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-container-high text-outline">
              <Icon name="image" className="text-5xl" />
              <span className="text-[10px] font-label font-bold uppercase tracking-widest">No product media</span>
            </div>
          )}
          {badge ? (
            <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
              <span className="bg-tertiary-fixed text-on-tertiary-fixed-variant px-3 py-1 text-[10px] font-label font-bold uppercase tracking-widest shadow-sm">
                {badge}
              </span>
            </div>
          ) : null}
          {displaySrc ? (
            <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6">
              <button
                type="button"
                onClick={() => setFullscreenOpen(true)}
                className="w-10 h-10 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-on-surface shadow-lg hover:bg-white transition-all active:scale-95"
                aria-label="Open image fullscreen"
              >
                <Icon name="fullscreen" />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {fullscreenOpen && displaySrc ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[90] bg-black/85 p-4 sm:p-6 flex items-center justify-center"
          onClick={() => setFullscreenOpen(false)}
        >
          <button
            type="button"
            onClick={() => setFullscreenOpen(false)}
            className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/70"
            aria-label="Close fullscreen image"
          >
            <Icon name="close" />
          </button>
          <img
            src={displaySrc}
            alt={productName}
            className="max-h-[92vh] max-w-[95vw] object-contain"
            loading="lazy"
            decoding="async"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
};
