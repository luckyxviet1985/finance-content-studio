import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type {DocumentaryProps, Scene} from "./types";

const palette = {
  ink: "#11110f",
  paper: "#e7dbc4",
  cream: "#f5eddf",
  rust: "#9d3f2c",
  gold: "#bd9350",
};

const resolveImage = (scene: Scene, sources: Record<string, string>) => {
  if (scene.visual.kind !== "archival-image") return null;
  const source = sources[scene.visual.sourceId];
  if (!source) {
    throw new Error(`Missing ingested media path for ${scene.visual.sourceId}`);
  }
  return source;
};

const ArchivalVisual: React.FC<{
  scene: Scene;
  sources: Record<string, string>;
}> = ({scene, sources}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const imagePath = resolveImage(scene, sources);
  if (!imagePath) return null;

  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = scene.visual.motion === "slow-pull-out" ? 1.1 - progress * 0.07 : 1.03 + progress * 0.08;
  const translateX = scene.visual.motion === "pan-left" ? 70 - progress * 140 : 0;

  return (
    <AbsoluteFill style={{overflow: "hidden", backgroundColor: palette.ink}}>
      <Img
        src={staticFile(imagePath)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "grayscale(1) contrast(1.08) sepia(0.16)",
          transform: `translateX(${translateX}px) scale(${scale})`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(10,10,8,.08) 25%, rgba(10,10,8,.78) 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.14,
          backgroundImage:
            "radial-gradient(circle at 20% 30%, #fff 0 1px, transparent 1px), radial-gradient(circle at 70% 60%, #fff 0 1px, transparent 1px)",
          backgroundSize: "11px 13px, 17px 19px",
          transform: `translate(${frame % 7}px, ${frame % 5}px)`,
        }}
      />
    </AbsoluteFill>
  );
};

const TypeCard: React.FC<{scene: Scene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const headline =
    scene.visual.kind === "typographic-card" ? scene.visual.headline : "";

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        backgroundColor: palette.paper,
        color: palette.ink,
        display: "flex",
        justifyContent: "center",
        opacity,
        padding: 140,
      }}
    >
      <div
        style={{
          borderBottom: `8px solid ${palette.rust}`,
          borderTop: `1px solid ${palette.ink}`,
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: 102,
          fontWeight: 700,
          letterSpacing: -3,
          lineHeight: 0.94,
          padding: "36px 24px 44px",
          textAlign: "center",
          textTransform: "uppercase",
        }}
      >
        {headline}
      </div>
    </AbsoluteFill>
  );
};

const Caption: React.FC<{text: string}> = ({text}) => (
  <div
    style={{
      alignSelf: "center",
      backgroundColor: "rgba(17,17,15,.88)",
      borderLeft: `7px solid ${palette.gold}`,
      bottom: 82,
      color: palette.cream,
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: 42,
      fontWeight: 700,
      left: 100,
      letterSpacing: 1.5,
      maxWidth: 1500,
      padding: "18px 28px",
      position: "absolute",
      textTransform: "uppercase",
    }}
  >
    {text}
  </div>
);

const SceneLayer: React.FC<{
  scene: Scene;
  sources: Record<string, string>;
}> = ({scene, sources}) => (
  <AbsoluteFill>
    {scene.visual.kind === "archival-image" ? (
      <ArchivalVisual scene={scene} sources={sources} />
    ) : (
      <TypeCard scene={scene} />
    )}
    {scene.caption ? <Caption text={scene.caption} /> : null}
  </AbsoluteFill>
);

export const DocumentaryComposition: React.FC<DocumentaryProps> = ({
  timeline,
  sources,
  audioSlots,
}) => {
  const narration = audioSlots["narration-main"];
  const archivalAudio = audioSlots["fdr-archival-excerpt"];

  return (
    <AbsoluteFill style={{backgroundColor: palette.ink}}>
      {timeline.scenes.map((scene) => (
        <Sequence
          key={scene.id}
          from={scene.startFrame}
          durationInFrames={scene.endFrame - scene.startFrame}
          name={scene.id}
        >
          <SceneLayer scene={scene} sources={sources} />
        </Sequence>
      ))}

      {narration?.output.path ? (
        <Audio src={staticFile(narration.output.path)} />
      ) : null}

      {archivalAudio?.output.path
        ? timeline.scenes
            .filter((scene) => scene.audio.slotId === "fdr-archival-excerpt")
            .map((scene) => (
              <Sequence
                key={`${scene.id}-audio`}
                from={scene.startFrame}
                durationInFrames={scene.endFrame - scene.startFrame}
              >
                <Audio
                  src={staticFile(archivalAudio.output.path as string)}
                  startFrom={Math.round(
                    ((scene.audio.sourceInMs ?? archivalAudio.clip?.inMs ?? 0) / 1000) *
                      timeline.fps,
                  )}
                  endAt={Math.round(
                    ((scene.audio.sourceOutMs ?? archivalAudio.clip?.outMs ?? 0) / 1000) *
                      timeline.fps,
                  )}
                />
              </Sequence>
            ))
        : null}
    </AbsoluteFill>
  );
};
