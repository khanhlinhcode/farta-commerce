"use client";

import { Pause, Play } from "lucide-react";
import Image from "next/image";
import { useRef, useState, useSyncExternalStore } from "react";

import {
  canDeliverCloudinaryVideo,
  canOptimizeCloudinary,
  type Media,
  type VideoMedia,
} from "@/lib/catalog";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onStoreChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const media = window.matchMedia(reducedMotionQuery);
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function prefersReducedMotion() {
  return typeof window.matchMedia === "function"
    ? window.matchMedia(reducedMotionQuery).matches
    : false;
}

function videoType(format: VideoMedia["format"]) {
  return format === "webm" ? "video/webm" : "video/mp4";
}

export function CampaignHeroMedia({
  name,
  desktopPoster,
  mobilePoster,
  desktopVideo,
  mobileVideo,
  developmentFallback,
}: {
  name: string;
  desktopPoster: Media | null;
  mobilePoster: Media | null;
  desktopVideo: VideoMedia | null;
  mobileVideo: VideoMedia | null;
  developmentFallback: string | null;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const reducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    prefersReducedMotion,
    () => true,
  );
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [playing, setPlaying] = useState(true);
  const safeDesktopVideo =
    desktopVideo && canDeliverCloudinaryVideo(desktopVideo.secureUrl)
      ? desktopVideo
      : null;
  const safeMobileVideo =
    mobileVideo && canDeliverCloudinaryVideo(mobileVideo.secureUrl)
      ? mobileVideo
      : null;
  const hasVideo = Boolean(safeDesktopVideo || safeMobileVideo);
  const desktopPosterSource =
    desktopPoster && canOptimizeCloudinary(desktopPoster.secureUrl)
      ? desktopPoster.secureUrl
      : developmentFallback;
  const mobilePosterSource =
    mobilePoster && canOptimizeCloudinary(mobilePoster.secureUrl)
      ? mobilePoster.secureUrl
      : desktopPosterSource;

  async function togglePlayback() {
    const element = video.current;
    if (!element) return;
    try {
      if (element.paused) {
        await element.play();
      } else {
        element.pause();
      }
    } catch {
      setVideoFailed(true);
    }
  }

  return (
    <div className="campaign-hero__media">
      {desktopPosterSource ? (
        <>
          {mobilePosterSource !== desktopPosterSource && (
            <Image
              alt={mobilePoster?.altText ?? name}
              className="campaign-hero__poster campaign-hero__poster--mobile"
              fill
              preload
              sizes="100vw"
              src={mobilePosterSource ?? desktopPosterSource}
            />
          )}
          <Image
            alt={desktopPoster?.altText ?? name}
            className="campaign-hero__poster campaign-hero__poster--desktop"
            fill
            preload
            sizes="100vw"
            src={desktopPosterSource}
          />
        </>
      ) : (
        <div className="campaign-hero__fallback" aria-hidden="true">
          <span>FARTA</span>
        </div>
      )}

      {hasVideo && !reducedMotion && !videoFailed && (
        <video
          ref={video}
          aria-hidden="true"
          autoPlay
          className={videoReady ? "is-ready" : ""}
          loop
          muted
          onCanPlay={() => setVideoReady(true)}
          onError={() => setVideoFailed(true)}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
          playsInline
          poster={desktopPosterSource ?? undefined}
          preload="metadata"
          tabIndex={-1}
        >
          {safeMobileVideo && (
            <source
              media="(max-width: 767px)"
              src={safeMobileVideo.secureUrl}
              type={videoType(safeMobileVideo.format)}
            />
          )}
          {safeDesktopVideo && (
            <source
              src={safeDesktopVideo.secureUrl}
              type={videoType(safeDesktopVideo.format)}
            />
          )}
          {!safeDesktopVideo && safeMobileVideo && (
            <source
              src={safeMobileVideo.secureUrl}
              type={videoType(safeMobileVideo.format)}
            />
          )}
        </video>
      )}

      {hasVideo && !reducedMotion && !videoFailed && (
        <button
          aria-label={
            playing ? "Tạm dừng phim chiến dịch" : "Phát phim chiến dịch"
          }
          className="campaign-hero__media-control"
          onClick={() => void togglePlayback()}
          type="button"
        >
          {playing ? (
            <Pause aria-hidden="true" size={17} strokeWidth={1.6} />
          ) : (
            <Play aria-hidden="true" size={17} strokeWidth={1.6} />
          )}
          <span>{playing ? "Tạm dừng" : "Phát"}</span>
        </button>
      )}
    </div>
  );
}
