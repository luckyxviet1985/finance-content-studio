import React from 'react';

type Scene = {
  id: string;
  start: number;
  duration: number;
  type: string;
  narration?: string;
  overlay?: string;
  source_id?: string;
  source_ids?: string[];
  visual_source_id?: string;
  audio_start_seconds?: number;
  audio_end_seconds?: number;
  motion?: string;
  graphic?: string;
};

type DocumentaryShortProps = {
  scenes: Scene[];
  fps: number;
  width: number;
  height: number;
};

/**
 * Provider-neutral documentary composition contract.
 *
 * This file intentionally contains no network fetching and no publishing logic.
 * Source IDs must already resolve to immutable ingested media artifacts before render.
 * A later application scaffold should map these scene objects onto Remotion primitives
 * (Sequence, Audio, Img/OffthreadVideo, spring/interpolate) behind the render worker.
 */
export const DocumentaryShort: React.FC<DocumentaryShortProps> = ({
  scenes,
  fps,
  width,
  height,
}) => {
  return (
    <div
      data-composition="DocumentaryShort"
      data-fps={fps}
      data-width={width}
      data-height={height}
      data-scenes={scenes.length}
      style={{ width: '100%', height: '100%', background: '#111', color: '#fff' }}
    >
      {scenes.map((scene) => (
        <section
          key={scene.id}
          data-scene-id={scene.id}
          data-scene-type={scene.type}
          data-start={scene.start}
          data-duration={scene.duration}
        >
          {scene.overlay ? <div>{scene.overlay}</div> : null}
        </section>
      ))}
    </div>
  );
};
