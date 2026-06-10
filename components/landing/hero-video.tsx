"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { trackViewContent } from "@/lib/meta-pixel";
import poster from "@/public/video/vsl-v1-poster.jpg";

// See docs/adr/0001-hero-vsl-plays-on-demand.md — the Hero VSL must not autoplay.
export function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasTrackedPlay = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);

  // Captions render in our own overlay rather than the UA's ::cue box —
  // ::cue can't reach next/font families (hashed names, shadow tree) and
  // Safari ignores cue fonts entirely. "hidden" keeps cuechange firing
  // without native rendering; picking "Off" in the native CC menu still
  // disables the track, which hides our overlay too.
  useEffect(() => {
    const video = videoRef.current;
    const track = video?.textTracks[0];
    if (!video || !track) return;
    track.mode = "hidden";
    const onCueChange = () => {
      const cues = track.activeCues;
      if (!cues || cues.length === 0) {
        setCaption(null);
        return;
      }
      setCaption(Array.from(cues, (cue) => (cue as VTTCue).text).join("\n"));
    };
    const keepNativeRenderingOff = () => {
      if (track.mode === "showing") track.mode = "hidden";
    };
    track.addEventListener("cuechange", onCueChange);
    video.textTracks.addEventListener("change", keepNativeRenderingOff);
    return () => {
      track.removeEventListener("cuechange", onCueChange);
      video.textTracks.removeEventListener("change", keepNativeRenderingOff);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playing || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) video.pause();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(video);
    return () => io.disconnect();
  }, [playing]);

  const handlePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    setPlaying(true);
    void video.play();
    video.focus();
    if (!hasTrackedPlay.current) {
      hasTrackedPlay.current = true;
      trackViewContent({ content_name: "Hero VSL" });
    }
  };

  const handleEnded = () => {
    const video = videoRef.current;
    if (video) video.currentTime = 0;
    setPlaying(false);
  };

  return (
    <div className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/40">
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        preload="none"
        playsInline
        controls={playing}
        onEnded={handleEnded}
        aria-label="A message from Marc, founder of Peak Studios CO"
      >
        <source src="/video/vsl-v1.mp4" type="video/mp4" />
        <track src="/video/vsl-v1.en.vtt" kind="subtitles" srcLang="en" label="English" />
        Your browser does not support the video tag.
      </video>

      {playing && caption && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-3 bottom-16 flex justify-center"
        >
          <span className="whitespace-pre-line rounded-md bg-forest-deep/85 px-3 py-1.5 text-center font-heading text-[0.95rem] leading-snug text-off-white lg:text-[1.05rem]">
            {caption}
          </span>
        </div>
      )}

      {!playing && (
        <button
          type="button"
          onClick={handlePlay}
          aria-label="Play video: a message from Marc (23 seconds)"
          className="group absolute inset-0 flex items-center justify-center"
        >
          <Image
            src={poster}
            alt="Marc Black, founder of Peak Studios CO, seated in a living room"
            fill
            sizes="(min-width: 1024px) 430px, 70vw"
            className="object-cover"
            loading="eager"
            fetchPriority="high"
            placeholder="blur"
          />
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 to-transparent"
          />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gold text-forest-deep shadow-lg transition-transform duration-300 group-hover:scale-110">
            <svg viewBox="0 0 24 24" fill="currentColor" className="ml-1 h-7 w-7" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <span className="absolute inset-x-0 bottom-5 text-center font-heading text-[0.72rem] tracking-[0.16em] uppercase text-white/90">
            A message from Marc &middot; 0:23
          </span>
        </button>
      )}
    </div>
  );
}
