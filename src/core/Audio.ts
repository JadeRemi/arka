/**
 * Sound is deliberately out of scope for now. Everything that would make noise calls through
 * this interface, so adding audio later is a single new implementation and one wiring line —
 * no hunting through gameplay code for the right moments.
 */
export type SoundId =
  | "brick.hit"
  | "brick.break"
  | "brick.steel"
  | "brick.glass"
  | "explosion"
  | "paddle"
  | "wall"
  | "launch"
  | "life.lost"
  | "level.clear"
  | "game.over"
  | "ui.hover"
  | "ui.press";

export interface Audio {
  play(id: SoundId, gain?: number, pan?: number): void;
  setMuted(muted: boolean): void;
}

export const silentAudio: Audio = {
  play() {
    /* no audio yet */
  },
  setMuted() {
    /* no audio yet */
  },
};
