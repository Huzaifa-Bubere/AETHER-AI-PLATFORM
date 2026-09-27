import { useState } from 'react';
import { PlayCircle, ExternalLink, Eye, ThumbsUp, Clock, Info, Loader2 } from 'lucide-react';
import type { TopicVideo } from '../../services/learningTopics';

/**
 * AETHER Career Learning — recommended video (spec §41–§47).
 *
 * The video metadata comes from the stored LearningVideo record (real YouTube
 * Data API values). This component never searches the API, never fabricates a
 * view count, and never claims a video is "the most viewed" — the label states
 * only what the stored data supports.
 */

const numberFormat = new Intl.NumberFormat('en-US');

function formatViews(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function LessonVideo({ videos, status }: {
  videos: TopicVideo[];
  status: { configured: boolean; available: boolean; credentialRequest: string | null; lastFetchedAt: string | null };
}) {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);

  if (!videos?.length) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 space-y-1.5">
        <h2 className="text-base font-bold text-foreground inline-flex items-center gap-2">
          <PlayCircle className="w-4 h-4 text-primary" /> Recommended video
        </h2>
        <p className="text-[12.5px] text-muted-foreground">
          {status?.credentialRequest
            ? status.credentialRequest
            : 'No video has been selected for this topic yet. Videos are fetched and ranked by the YouTube integration, not hardcoded.'}
        </p>
        {!status?.configured && (
          <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <Info className="w-3 h-3" /> The lesson above is complete without a video.
          </p>
        )}
      </div>
    );
  }

  const video = videos[Math.min(active, videos.length - 1)];
  const watchUrl = `https://www.youtube.com/watch?v=${video.youtubeVideoId}`;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground inline-flex items-center gap-2">
          <PlayCircle className="w-4 h-4 text-primary" /> Recommended video
        </h2>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
          {video.label}
        </span>
      </div>

      <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-border bg-secondary">
        {playing ? (
          <iframe
            title={video.title}
            src={`https://www.youtube.com/embed/${video.youtubeVideoId}?autoplay=1&rel=0`}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0 w-full h-full" aria-label={`Play ${video.title}`}>
            {video.thumbnail
              ? <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" loading="lazy" />
              : <div className="w-full h-full bg-secondary" />}
            <span className="absolute inset-0 flex items-center justify-center bg-slate-900/25 group-hover:bg-slate-900/40 transition-colors">
              <PlayCircle className="w-12 h-12 text-white drop-shadow" />
            </span>
          </button>
        )}
      </div>

      <div>
        <p className="text-[13.5px] font-semibold text-foreground leading-snug">{video.title}</p>
        <p className="text-[12px] text-muted-foreground">{video.channelTitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11.5px] text-muted-foreground">
        {video.viewCount != null && (
          <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" /> {formatViews(video.viewCount)} views
            <span className="sr-only"> ({numberFormat.format(video.viewCount)})</span>
          </span>
        )}
        {video.likeCount != null && (
          <span className="inline-flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> {formatViews(video.likeCount)} likes</span>
        )}
        {video.duration && <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {video.duration}</span>}
      </div>

      {video.rankingReasons?.length > 0 && (
        <p className="text-[10.5px] text-muted-foreground/80 leading-relaxed">
          Why this video: {video.rankingReasons.join(' · ')}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
        <a href={watchUrl} target="_blank" rel="noopener noreferrer"
          className="text-[11.5px] font-semibold text-primary hover:underline inline-flex items-center gap-1">
          Open on YouTube <ExternalLink className="w-3 h-3" />
        </a>
        {video.fetchedAt && (
          <span className="text-[10.5px] text-muted-foreground">
            Metadata refreshed {new Date(video.fetchedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {videos.length > 1 && (
        <div className="space-y-1.5 pt-2 border-t border-border">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">More options</p>
          {videos.map((v, i) => (
            i === active ? null : (
              <button
                key={v.youtubeVideoId}
                type="button"
                onClick={() => { setActive(i); setPlaying(false); }}
                className="w-full text-left flex items-center gap-2 rounded-lg border border-border hover:border-primary/40 px-2 py-1.5 transition-colors"
              >
                {v.thumbnail
                  ? <img src={v.thumbnail} alt="" className="w-14 h-9 object-cover rounded shrink-0" loading="lazy" />
                  : <div className="w-14 h-9 bg-secondary rounded shrink-0" />}
                <span className="min-w-0">
                  <span className="block text-[12px] text-foreground truncate">{v.title}</span>
                  <span className="block text-[10.5px] text-muted-foreground truncate">
                    {v.channelTitle}{v.duration ? ` · ${v.duration}` : ''}
                  </span>
                </span>
              </button>
            )
          ))}
        </div>
      )}

      {!playing && (
        <p className="text-[10.5px] text-muted-foreground inline-flex items-center gap-1">
          <Loader2 className="w-3 h-3" /> Embedded playback may be unavailable for some videos — the YouTube link always works.
        </p>
      )}
    </div>
  );
}
