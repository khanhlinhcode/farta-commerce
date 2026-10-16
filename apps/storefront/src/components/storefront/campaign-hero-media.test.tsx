import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Media, VideoMedia } from "@/lib/catalog";
import { CampaignHeroMedia } from "./campaign-hero-media";

vi.mock("next/image", () => ({
  default: (
    props: React.ImgHTMLAttributes<HTMLImageElement> & {
      fill?: boolean;
      preload?: boolean;
    },
  ) => {
    const imageProps = { ...props };
    delete imageProps.fill;
    delete imageProps.preload;
    return <img {...imageProps} />;
  },
  getImageProps: ({
    src,
    alt,
    width,
    height,
    sizes,
    loading,
  }: React.ImgHTMLAttributes<HTMLImageElement> & {
    src: string;
    width: number;
    height: number;
  }) => ({
    props: {
      src,
      srcSet: `${src}?w=${width} ${width}w`,
      alt,
      width,
      height,
      sizes,
      loading,
    },
  }),
}));

const poster: Media = {
  id: "poster",
  secureUrl: "https://res.cloudinary.com/farta-test/image/upload/poster.jpg",
  width: 1600,
  height: 2000,
  altText: "FARTA campaign poster",
};

const video: VideoMedia = {
  ...poster,
  id: "video",
  secureUrl: "https://res.cloudinary.com/farta-test/video/upload/film.mp4",
  resourceType: "video",
  format: "mp4",
  bytes: 1_000_000,
  durationSeconds: 9,
};

let reduceMotion = false;

describe("CampaignHeroMedia", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = "farta-test";
    reduceMotion = false;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: reduceMotion,
        media: "(prefers-reduced-motion: reduce)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    delete process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  });

  it("keeps the poster as an honest image-only fallback", () => {
    render(
      <CampaignHeroMedia
        name="Quiet Form"
        desktopPoster={poster}
        mobilePoster={null}
        desktopVideo={null}
        mobileVideo={null}
        developmentFallback={null}
      />,
    );

    expect(screen.getByAltText("FARTA campaign poster")).toBeInTheDocument();
    expect(document.querySelector("video")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /phim chiến dịch/i }),
    ).not.toBeInTheDocument();
  });

  it("uses one art-directed picture instead of mounting two preloaded images", () => {
    const mobilePoster = {
      ...poster,
      id: "mobile-poster",
      secureUrl:
        "https://res.cloudinary.com/farta-test/image/upload/mobile-poster.jpg",
      width: 900,
      height: 1200,
    };
    render(
      <CampaignHeroMedia
        name="Quiet Form"
        desktopPoster={poster}
        mobilePoster={mobilePoster}
        desktopVideo={null}
        mobileVideo={null}
        developmentFallback={null}
      />,
    );

    const picture = document.querySelector("picture");
    expect(picture).toBeInTheDocument();
    expect(picture?.querySelectorAll("img")).toHaveLength(1);
    expect(picture?.querySelectorAll("source")).toHaveLength(2);
    expect(picture?.querySelector("img")).toHaveAttribute("loading", "eager");
  });

  it("does not mount autoplay video when reduced motion is requested", () => {
    reduceMotion = true;
    render(
      <CampaignHeroMedia
        name="Quiet Form"
        desktopPoster={poster}
        mobilePoster={null}
        desktopVideo={video}
        mobileVideo={null}
        developmentFallback={null}
      />,
    );

    expect(document.querySelector("video")).not.toBeInTheDocument();
    expect(screen.getByAltText("FARTA campaign poster")).toBeInTheDocument();
  });

  it("exposes playback control and falls back safely after video failure", () => {
    render(
      <CampaignHeroMedia
        name="Quiet Form"
        desktopPoster={poster}
        mobilePoster={null}
        desktopVideo={video}
        mobileVideo={null}
        developmentFallback={null}
      />,
    );

    const element = document.querySelector("video");
    expect(element).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Tạm dừng phim chiến dịch" }),
    ).toBeInTheDocument();

    fireEvent.error(element as HTMLVideoElement);

    expect(document.querySelector("video")).not.toBeInTheDocument();
    expect(screen.getByAltText("FARTA campaign poster")).toBeInTheDocument();
  });

  it("uses a focusable native button to pause and resume campaign video", () => {
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => undefined);
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "paused", "get")
      .mockReturnValueOnce(false)
      .mockReturnValue(true);

    render(
      <CampaignHeroMedia
        name="Quiet Form"
        desktopPoster={poster}
        mobilePoster={null}
        desktopVideo={video}
        mobileVideo={null}
        developmentFallback={null}
      />,
    );

    const element = document.querySelector("video") as HTMLVideoElement;
    const control = screen.getByRole("button", {
      name: "Tạm dừng phim chiến dịch",
    });
    control.focus();
    expect(control).toHaveFocus();

    fireEvent.click(control);
    expect(pause).toHaveBeenCalledOnce();
    fireEvent.pause(element);

    const resume = screen.getByRole("button", {
      name: "Phát phim chiến dịch",
    });
    fireEvent.click(resume);
    expect(play).toHaveBeenCalledOnce();
  });
});
