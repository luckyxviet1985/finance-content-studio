import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type {DocumentaryPreviewProps, PreviewScene} from "./types";

const colors = {
  ink: "#11110f",
  deepInk: "#080807",
  paper: "#e8dcc4",
  cream: "#f7efdf",
  rust: "#9d3f2c",
  gold: "#c59a55",
  faded: "#918674",
};

const FilmTexture: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        backgroundImage:
          "radial-gradient(circle at 15% 25%, rgba(255,255,255,.45) 0 1px, transparent 1.5px), radial-gradient(circle at 72% 66%, rgba(255,255,255,.28) 0 1px, transparent 1.5px), repeating-linear-gradient(90deg, transparent 0 8px, rgba(255,255,255,.018) 9px)",
        backgroundSize: "13px 17px, 19px 23px, 10px 100%",
        mixBlendMode: "screen",
        opacity: 0.18,
        pointerEvents: "none",
        transform: `translate(${frame % 9}px, ${frame % 7}px)`,
      }}
    />
  );
};

const Person: React.FC<{left: number; bottom: number; scale: number; delay: number}> = ({
  left,
  bottom,
  scale,
  delay,
}) => {
  const frame = useCurrentFrame();
  const sway = Math.sin((frame + delay) / 20) * 2;
  return (
    <div
      style={{
        bottom,
        left,
        position: "absolute",
        transform: `translateX(${sway}px) scale(${scale})`,
        transformOrigin: "bottom center",
      }}
    >
      <div
        style={{
          background: colors.ink,
          borderRadius: "50%",
          height: 48,
          margin: "0 auto -3px",
          width: 42,
        }}
      />
      <div
        style={{
          background: colors.ink,
          borderRadius: "40% 40% 8% 8%",
          height: 112,
          width: 76,
        }}
      />
    </div>
  );
};

const BankQueue: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 360], [30, -40], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        bottom: 0,
        height: 650,
        position: "absolute",
        right: 20,
        transform: `translateX(${drift}px)`,
        width: 800,
      }}
    >
      <div
        style={{
          borderBottom: `24px solid ${colors.ink}`,
          borderLeft: "90px solid transparent",
          borderRight: "90px solid transparent",
          height: 0,
          left: 110,
          position: "absolute",
          top: 38,
          width: 480,
        }}
      />
      <div
        style={{
          border: `8px solid ${colors.ink}`,
          height: 345,
          left: 110,
          position: "absolute",
          top: 62,
          width: 660,
        }}
      >
        {[0, 1, 2, 3].map((column) => (
          <div
            key={column}
            style={{
              background: colors.ink,
              height: 260,
              left: 58 + column * 148,
              position: "absolute",
              top: 34,
              width: 30,
            }}
          />
        ))}
        <div
          style={{
            border: `7px solid ${colors.ink}`,
            bottom: 0,
            height: 120,
            left: 275,
            position: "absolute",
            width: 110,
          }}
        />
      </div>
      {[
        [30, 20, 1.05, 0],
        [138, 12, 0.92, 11],
        [238, 28, 1.1, 24],
        [358, 8, 0.88, 35],
        [455, 22, 1, 47],
        [560, 6, 0.9, 58],
        [652, 24, 1.08, 69],
      ].map(([left, bottom, scale, delay]) => (
        <Person
          key={left}
          left={left}
          bottom={bottom}
          scale={scale}
          delay={delay}
        />
      ))}
    </div>
  );
};

const Newspaper: React.FC = () => {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [0, 36], [0.7, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        background: colors.cream,
        border: `3px solid ${colors.ink}`,
        boxShadow: "24px 28px 0 rgba(17,17,15,.18)",
        height: 610,
        padding: 46,
        position: "absolute",
        right: 110,
        top: 160,
        transform: `rotate(2.5deg) scale(${reveal})`,
        width: 650,
      }}
    >
      <div style={{borderBottom: `5px double ${colors.ink}`, fontFamily: "Georgia, serif", fontSize: 36, fontWeight: 700, paddingBottom: 14, textAlign: "center"}}>
        THE FINANCIAL RECORD
      </div>
      <div style={{fontFamily: "Georgia, serif", fontSize: 76, fontWeight: 900, lineHeight: 0.9, padding: "34px 0 28px", textAlign: "center"}}>
        BANKS CLOSED
      </div>
      <div style={{display: "grid", gap: 18, gridTemplateColumns: "1fr 1fr 1fr"}}>
        {[0, 1, 2].map((column) => (
          <div key={column}>
            {Array.from({length: 13}, (_, line) => (
              <div
                key={line}
                style={{
                  background: colors.faded,
                  height: 5,
                  marginBottom: 10,
                  opacity: 0.65,
                  width: `${72 + ((line * 17 + column * 11) % 28)}%`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

const ConfidenceMeter: React.FC = () => {
  const frame = useCurrentFrame();
  const needle = interpolate(frame, [0, 210], [-72, 40], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div style={{height: 540, position: "absolute", right: 95, top: 230, width: 730}}>
      <div
        style={{
          border: `20px solid ${colors.ink}`,
          borderBottom: 0,
          borderRadius: "460px 460px 0 0",
          height: 340,
          position: "absolute",
          top: 0,
          width: 700,
        }}
      />
      {[-70, -42, -14, 14, 42, 70].map((angle) => (
        <div
          key={angle}
          style={{
            background: colors.ink,
            height: 44,
            left: 344,
            position: "absolute",
            top: 42,
            transform: `rotate(${angle}deg) translateY(-2px)`,
            transformOrigin: "8px 300px",
            width: 8,
          }}
        />
      ))}
      <div
        style={{
          background: colors.rust,
          borderRadius: 8,
          height: 285,
          left: 346,
          position: "absolute",
          top: 54,
          transform: `rotate(${needle}deg)`,
          transformOrigin: "8px 276px",
          width: 16,
        }}
      />
      <div style={{background: colors.ink, borderRadius: "50%", height: 52, left: 328, position: "absolute", top: 314, width: 52}} />
      <div style={{bottom: 76, color: colors.ink, fontFamily: "Arial, sans-serif", fontSize: 32, fontWeight: 800, left: 48, letterSpacing: 4, position: "absolute"}}>PANIC</div>
      <div style={{bottom: 76, color: colors.ink, fontFamily: "Arial, sans-serif", fontSize: 32, fontWeight: 800, letterSpacing: 4, position: "absolute", right: 22}}>CONFIDENCE</div>
    </div>
  );
};

const Radio: React.FC<{waves?: boolean}> = ({waves = false}) => {
  const frame = useCurrentFrame();
  const pulse = 1 + Math.sin(frame / 8) * 0.025;
  return (
    <div style={{height: 620, position: "absolute", right: 40, top: 220, width: 820}}>
      {waves
        ? [1, 2, 3].map((ring) => (
            <div
              key={ring}
              style={{
                border: `7px solid ${colors.rust}`,
                borderRadius: "50%",
                height: 180 + ring * 135,
                left: 360 - ring * 68,
                opacity: 0.56 - ring * 0.1,
                position: "absolute",
                top: 280 - ring * 68,
                transform: `scale(${pulse})`,
                width: 180 + ring * 135,
              }}
            />
          ))
        : null}
      <div
        style={{
          background: colors.ink,
          border: `12px solid ${colors.gold}`,
          borderRadius: "46% 46% 12% 12%",
          bottom: 0,
          height: 455,
          left: 150,
          position: "absolute",
          width: 535,
        }}
      >
        <div
          style={{
            border: `7px solid ${colors.paper}`,
            borderRadius: "50% 50% 12% 12%",
            height: 250,
            left: 82,
            position: "absolute",
            top: 48,
            width: 350,
          }}
        >
          {Array.from({length: 7}, (_, index) => (
            <div key={index} style={{background: colors.paper, height: 5, left: 34, opacity: 0.72, position: "absolute", top: 34 + index * 27, width: 280}} />
          ))}
        </div>
        <div style={{background: colors.gold, borderRadius: "50%", bottom: 45, height: 62, left: 112, position: "absolute", width: 62}} />
        <div style={{background: colors.gold, borderRadius: "50%", bottom: 45, height: 62, position: "absolute", right: 112, width: 62}} />
      </div>
    </div>
  );
};

const ReopeningBank: React.FC = () => {
  const frame = useCurrentFrame();
  const light = interpolate(frame, [0, 180], [0.1, 0.95], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div style={{bottom: 70, height: 620, position: "absolute", right: 45, width: 800}}>
      <div style={{borderBottom: `34px solid ${colors.ink}`, borderLeft: "100px solid transparent", borderRight: "100px solid transparent", height: 0, left: 55, position: "absolute", top: 35, width: 520}} />
      <div style={{border: `10px solid ${colors.ink}`, height: 450, left: 55, position: "absolute", top: 68, width: 720}}>
        {[0, 1, 2, 3].map((column) => (
          <div key={column} style={{background: colors.ink, height: 340, left: 55 + column * 165, position: "absolute", top: 35, width: 34}} />
        ))}
        <div style={{background: `rgba(197,154,85,${light})`, border: `9px solid ${colors.ink}`, bottom: 0, boxShadow: `0 0 ${80 * light}px rgba(197,154,85,.75)`, height: 188, left: 278, position: "absolute", width: 145}} />
      </div>
      <div style={{background: colors.rust, bottom: 0, height: 22, left: 0, position: "absolute", width: 800}} />
    </div>
  );
};

const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const width = interpolate(frame, [0, 36], [0, 560], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <div style={{background: colors.rust, height: 10, position: "absolute", right: 150, top: 540, width}} />;
};

const Motif: React.FC<{scene: PreviewScene}> = ({scene}) => {
  switch (scene.visual.motif) {
    case "bank-queue":
      return <BankQueue />;
    case "newspaper":
      return <Newspaper />;
    case "confidence-meter":
      return <ConfidenceMeter />;
    case "radio":
      return <Radio />;
    case "radio-wave":
      return <Radio waves />;
    case "reopening-bank":
      return <ReopeningBank />;
    case "end-card":
      return <EndCard />;
  }
};

const PreviewSceneLayer: React.FC<{scene: PreviewScene; index: number; total: number}> = ({
  scene,
  index,
  total,
}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const enter = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const progress = Math.min(1, frame / Math.max(1, durationInFrames));

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(120deg, ${colors.paper} 0 57%, ${colors.gold} 57% 58%, ${colors.cream} 58% 100%)`,
        color: colors.ink,
        opacity: enter * exit,
        overflow: "hidden",
      }}
    >
      <div style={{height: "100%", left: 0, padding: "150px 90px 220px 110px", position: "absolute", top: 0, width: "61%"}}>
        <div style={{color: colors.rust, fontFamily: "Arial, sans-serif", fontSize: 24, fontWeight: 900, letterSpacing: 5, marginBottom: 26, textTransform: "uppercase"}}>
          {scene.visual.eyebrow}
        </div>
        <div style={{fontFamily: "Georgia, 'Times New Roman', serif", fontSize: scene.visual.motif === "end-card" ? 104 : 84, fontWeight: 800, letterSpacing: -3.5, lineHeight: 0.94, maxWidth: 980, textTransform: "uppercase"}}>
          {scene.visual.headline}
        </div>
        {scene.caption ? (
          <div style={{borderLeft: `7px solid ${colors.gold}`, fontFamily: "Arial, sans-serif", fontSize: 30, fontWeight: 800, letterSpacing: 2.5, marginTop: 38, padding: "8px 0 8px 20px", textTransform: "uppercase"}}>
            {scene.caption}
          </div>
        ) : null}
      </div>

      <Motif scene={scene} />

      {scene.draftText ? (
        <div style={{background: "rgba(8,8,7,.94)", bottom: 55, color: colors.cream, left: 72, padding: "25px 36px 28px", position: "absolute", width: 1580}}>
          <div style={{color: colors.gold, fontFamily: "Arial, sans-serif", fontSize: 18, fontWeight: 900, letterSpacing: 4, marginBottom: 10}}>DRAFT NARRATION — AUDIO NOT YET GENERATED</div>
          <div style={{fontFamily: "Georgia, serif", fontSize: 31, lineHeight: 1.25}}>{scene.draftText}</div>
        </div>
      ) : null}

      <div style={{bottom: 72, color: colors.faded, fontFamily: "Arial, sans-serif", fontSize: 20, fontWeight: 800, letterSpacing: 3, position: "absolute", right: 65}}>
        {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </div>
      <div style={{background: "rgba(17,17,15,.16)", bottom: 0, height: 8, left: 0, position: "absolute", width: "100%"}}>
        <div style={{background: colors.rust, height: "100%", width: `${progress * 100}%`}} />
      </div>
      <FilmTexture />
    </AbsoluteFill>
  );
};

const Watermark: React.FC<{text: string; audioReason: string}> = ({text, audioReason}) => (
  <>
    <div style={{background: colors.rust, boxSizing: "border-box", color: "white", fontFamily: "Arial, sans-serif", fontSize: 22, fontWeight: 900, left: 0, letterSpacing: 4, padding: "15px 28px", position: "absolute", textTransform: "uppercase", top: 0, width: "100%"}}>
      {text}
    </div>
    <div style={{alignItems: "center", background: colors.deepInk, bottom: 0, boxSizing: "border-box", color: "rgba(255,255,255,.72)", display: "flex", fontFamily: "Arial, sans-serif", fontSize: 15, height: 44, left: 0, letterSpacing: 2, paddingLeft: 74, position: "absolute", textTransform: "uppercase", width: "100%"}}>
      SILENT ANIMATIC · {audioReason}
    </div>
  </>
);

export const DocumentaryPreviewComposition: React.FC<DocumentaryPreviewProps> = ({
  timeline,
  watermark,
  audio,
}) => (
  <AbsoluteFill style={{backgroundColor: colors.deepInk}}>
    {timeline.scenes.map((scene, index) => (
      <Sequence
        key={scene.id}
        from={scene.startFrame}
        durationInFrames={scene.endFrame - scene.startFrame}
        name={`preview-${scene.id}`}
      >
        <PreviewSceneLayer scene={scene} index={index} total={timeline.scenes.length} />
      </Sequence>
    ))}
    <Watermark text={watermark.text} audioReason={audio.reason} />
  </AbsoluteFill>
);
