#!/usr/bin/env python3
"""Assemble AI-generated cooking clips into a 9:16 ASMR YouTube Short.

Key design notes (v0.2.0):
- Subtitles are converted from SRT to ASS with an explicit 1080x1920 PlayRes,
  so FontSize / MarginV are true pixels. (libass otherwise defaults to
  PlayResY=288, which silently rescales every style value by 6.67x.)
- Clip order is natural-sorted (1, 2, 10 — not 1, 10, 2).
- Existing output is never overwritten unless --force is passed.
- Every audio track is padded + trimmed to the exact video duration so a clip
  with a short/absent audio stream cannot cause A/V drift downstream.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

VIDEO_EXTS = {".mp4", ".mov", ".webm", ".mkv"}

TARGET_W = 1080
TARGET_H = 1920
FPS = 30
SAMPLE_RATE = 48000

SRT_TIME_RE = re.compile(r"(\d+):(\d{2}):(\d{2})[,.](\d{1,3})")
HTML_TAG_RE = re.compile(r"</?[a-zA-Z][^>]*>")


# --------------------------------------------------------------------------- #
# Probing
# --------------------------------------------------------------------------- #


@dataclass
class ClipInfo:
    path: Path
    duration: float
    has_audio: bool
    width: int = 0
    height: int = 0


def check_dependencies(need_subs: bool) -> None:
    """Verify ffmpeg/ffprobe exist, and libass filters when subtitles are used."""
    for tool in ("ffmpeg", "ffprobe"):
        if shutil.which(tool) is None:
            raise RuntimeError(
                f"找不到 {tool}，請先安裝 FFmpeg 並加入 PATH（https://ffmpeg.org/download.html）。"
            )
    if not need_subs:
        return
    res = subprocess.run(
        ["ffmpeg", "-hide_banner", "-filters"], capture_output=True, text=True
    )
    listing = res.stdout
    if " ass " not in listing and " subtitles " not in listing:
        raise RuntimeError(
            "此 FFmpeg 未編譯 libass，無法燒錄字幕。請改用含 libass 的版本，或加 --no-subs。"
        )


def probe_clip(clip_path: Path) -> ClipInfo:
    """Return duration / audio presence / dimensions for a video file."""
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration:stream=codec_type,width,height",
        "-of",
        "json",
        str(clip_path),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(
            f"無法讀取片段資訊：{clip_path.name}\n{res.stderr.strip()[:400]}"
        )
    data = json.loads(res.stdout or "{}")
    duration = float(data.get("format", {}).get("duration") or 0.0)
    streams = data.get("streams", [])
    has_audio = any(s.get("codec_type") == "audio" for s in streams)
    width = height = 0
    for s in streams:
        if s.get("codec_type") == "video":
            width = int(s.get("width") or 0)
            height = int(s.get("height") or 0)
            break
    return ClipInfo(clip_path, duration, has_audio, width, height)


def natural_key(path: Path) -> list:
    """Sort key so 2.mp4 comes before 10.mp4."""
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", path.name)]


# --------------------------------------------------------------------------- #
# Subtitles: SRT -> ASS with explicit PlayRes
# --------------------------------------------------------------------------- #


def _srt_ts_to_seconds(match: re.Match[str]) -> float:
    h, m, s, ms = match.groups()
    frac = int(ms) / (10 ** len(ms))
    return int(h) * 3600 + int(m) * 60 + int(s) + frac


def parse_srt(text: str) -> list[tuple[float, float, str]]:
    """Parse SRT into (start, end, text) tuples. Tolerant of BOM/CRLF/no index."""
    cues: list[tuple[float, float, str]] = []
    normalized = text.replace("\ufeff", "").replace("\r\n", "\n").strip()
    for block in re.split(r"\n\s*\n", normalized):
        lines = [ln for ln in block.split("\n") if ln.strip()]
        if not lines:
            continue
        tc_index = next((i for i, ln in enumerate(lines) if "-->" in ln), None)
        if tc_index is None:
            continue
        stamps = list(SRT_TIME_RE.finditer(lines[tc_index]))
        if len(stamps) < 2:
            continue
        start = _srt_ts_to_seconds(stamps[0])
        end = _srt_ts_to_seconds(stamps[1])
        body = "\n".join(lines[tc_index + 1:]).strip()
        body = HTML_TAG_RE.sub("", body)
        if not body or end <= start:
            continue
        cues.append((start, end, body))
    return sorted(cues, key=lambda c: c[0])


def _ass_time(seconds: float) -> str:
    seconds = max(0.0, seconds)
    total_cs = int(round(seconds * 100))
    h, rem = divmod(total_cs, 360000)
    m, rem = divmod(rem, 6000)
    s, cs = divmod(rem, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _escape_ass_text(text: str) -> str:
    text = text.replace("\\", "\\\\")
    text = text.replace("{", "(").replace("}", ")")
    return text.replace("\n", r"\N")


def build_ass(
    cues: list[tuple[float, float, str]],
    font_name: str,
    font_size: int,
    margin_v: int,
    outline: float = 3,
) -> str:
    """Render cues as an ASS file pinned to PlayResX/Y = 1080x1920 (real pixels)."""
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {TARGET_W}
PlayResY: {TARGET_H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Shorts,{font_name},{font_size},&H00FFFFFF,&H00FFFFFF,&HC8000000,&H00000000,-1,0,0,0,100,100,1,0,1,{outline},1,2,60,60,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = [
        f"Dialogue: 0,{_ass_time(start)},{_ass_time(end)},Shorts,,0,0,0,,"
        f"{_escape_ass_text(text)}"
        for start, end, text in cues
    ]
    return header + "\n".join(events) + "\n"


# --------------------------------------------------------------------------- #
# FFmpeg graph
# --------------------------------------------------------------------------- #


def escape_ffmpeg_filter_path(path: Path) -> str:
    """Escape a path for use inside an FFmpeg filter argument."""
    posix = path.resolve().as_posix()
    return posix.replace(":", r"\:").replace("'", r"\'")


def build_atempo_chain(speed: float) -> str:
    """Build a valid atempo chain (each stage must stay within 0.5..2.0)."""
    if speed <= 0:
        raise ValueError("speed 必須大於 0")
    stages: list[str] = []
    remaining = speed
    while remaining > 2.0:
        stages.append("atempo=2.0")
        remaining /= 2.0
    while remaining < 0.5:
        stages.append("atempo=0.5")
        remaining /= 0.5
    stages.append(f"atempo={remaining:.4f}")
    return ",".join(stages)


@dataclass
class PlannedShot:
    index: int
    clip: ClipInfo
    raw_needed: float
    raw_duration: float
    out_duration: float


def plan_shots(
    clips: list[ClipInfo], clip_duration: float, intro_duration: float, speed: float
) -> list[PlannedShot]:
    """Map each clip to its output duration.

    ``intro_duration <= 0`` means "no special intro": the first shot simply uses
    ``clip_duration`` like every other shot. Clips are never silently dropped.
    """
    if clip_duration <= 0:
        raise ValueError("--clip-duration 必須大於 0")
    if speed <= 0:
        raise ValueError("--speed 必須大於 0")

    shots: list[PlannedShot] = []
    for idx, clip in enumerate(clips):
        is_intro = idx == 0 and intro_duration > 0
        target = intro_duration if is_intro else clip_duration
        raw_needed = target * speed
        raw_usable = min(clip.duration, raw_needed) if clip.duration > 0 else raw_needed
        shots.append(
            PlannedShot(
                index=idx,
                clip=clip,
                raw_needed=raw_needed,
                raw_duration=raw_usable,
                out_duration=raw_usable / speed,
            )
        )
    return shots


def build_filter_complex(
    shots: list[PlannedShot],
    speed: float,
    fade_sec: float,
    ass_path: Path | None,
    lufs: float,
) -> tuple[list[str], str]:
    inputs: list[str] = []
    parts: list[str] = []
    concat_labels: list[str] = []
    atempo = build_atempo_chain(speed)

    for i, shot in enumerate(shots):
        clip = shot.clip
        raw = shot.raw_duration
        out = shot.out_duration
        inputs.extend(["-i", str(clip.path)])

        parts.append(
            f"[{i}:v]trim=duration={raw:.4f},setpts=(PTS-STARTPTS)/{speed:.4f},"
            f"scale={TARGET_W}:{TARGET_H}:force_original_aspect_ratio=increase,"
            f"crop={TARGET_W}:{TARGET_H},setsar=1,fps={FPS},format=yuv420p[v{i}]"
        )

        if clip.has_audio:
            fade_out_start = max(0.0, out - fade_sec)
            parts.append(
                f"[{i}:a]atrim=duration={raw:.4f},asetpts=PTS-STARTPTS,"
                f"{atempo},"
                f"aresample={SAMPLE_RATE},"
                f"aformat=sample_fmts=fltp:channel_layouts=stereo:sample_rates={SAMPLE_RATE},"
                f"apad,atrim=duration={out:.4f},"
                f"afade=t=in:st=0:d={fade_sec:.3f},"
                f"afade=t=out:st={fade_out_start:.4f}:d={fade_sec:.3f}[a{i}]"
            )
        else:
            parts.append(
                f"anullsrc=channel_layout=stereo:sample_rate={SAMPLE_RATE},"
                f"aformat=sample_fmts=fltp:channel_layouts=stereo:sample_rates={SAMPLE_RATE},"
                f"atrim=duration={out:.4f}[a{i}]"
            )
        concat_labels.append(f"[v{i}][a{i}]")

    n = len(shots)
    parts.append(f"{''.join(concat_labels)}concat=n={n}:v=1:a=1[vcat][acat]")

    if ass_path is not None:
        parts.append(f"[vcat]ass='{escape_ffmpeg_filter_path(ass_path)}'[vout]")
    else:
        parts.append("[vcat]null[vout]")

    parts.append(f"[acat]loudnorm=I={lufs}:TP=-1.5:LRA=11[aout]")
    return inputs, ";".join(parts)


# --------------------------------------------------------------------------- #
# Main pipeline
# --------------------------------------------------------------------------- #


@dataclass
class AssemblyResult:
    output_path: Path
    duration: float
    has_audio: bool
    shots: list[PlannedShot] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    subtitle_cues: int = 0
    subtitle_end: float = 0.0


def collect_clips(clips_dir: Path) -> list[ClipInfo]:
    if not clips_dir.is_dir():
        raise FileNotFoundError(f"找不到片段資料夾：{clips_dir}")
    files = sorted(
        (p for p in clips_dir.iterdir() if p.is_file() and p.suffix.lower() in VIDEO_EXTS),
        key=natural_key,
    )
    if not files:
        raise FileNotFoundError(
            f"資料夾內沒有影片片段（支援 {', '.join(sorted(VIDEO_EXTS))}）：{clips_dir}"
        )
    return [probe_clip(p) for p in files]


def assemble_project(
    project_dir: Path,
    clip_duration: float,
    intro_duration: float,
    speed: float,
    fade_sec: float,
    use_subs: bool,
    lufs: float,
    font_name: str,
    font_size: int,
    margin_v: int,
    force: bool,
    out_path: Path | None,
    dry_run: bool,
    verbose: bool,
) -> AssemblyResult:
    project_dir = project_dir.resolve()
    check_dependencies(need_subs=use_subs)

    output_dir = project_dir / "output"
    output_dir.mkdir(parents=True, exist_ok=True)
    final_path = out_path.resolve() if out_path else output_dir / "final_short.mp4"

    if final_path.exists() and not force and not dry_run:
        raise FileExistsError(
            f"輸出檔已存在，未覆寫：{final_path}\n"
            f"若要覆寫請加 --force；或改用 --out <新檔名>。"
        )

    clips = collect_clips(project_dir / "clips")
    shots = plan_shots(clips, clip_duration, intro_duration, speed)
    if not shots:
        raise RuntimeError("沒有任何可用鏡頭（檢查 --clip-duration / --intro-duration）。")

    warnings: list[str] = []
    for shot in shots:
        if shot.clip.duration + 1e-3 < shot.raw_needed:
            warnings.append(
                f"{shot.clip.path.name}：原始長度僅 {shot.clip.duration:.2f}s，"
                f"不足 {shot.raw_needed:.2f}s，該鏡會偏短"
                f"（實際 {shot.out_duration:.2f}s）。"
            )
        if shot.clip.width and shot.clip.height:
            ratio = shot.clip.width / shot.clip.height
            if abs(ratio - TARGET_W / TARGET_H) > 0.06:
                warnings.append(
                    f"{shot.clip.path.name}：比例 {shot.clip.width}x{shot.clip.height} "
                    f"非 9:16，會被裁切補滿（可能切到主體）。"
                )

    total_out = sum(s.out_duration for s in shots)

    # ---- subtitles ----
    ass_path: Path | None = None
    cue_count = 0
    cue_end = 0.0
    if use_subs:
        srt_path = project_dir / "subtitles.srt"
        if not srt_path.exists():
            warnings.append("找不到 subtitles.srt，本次不燒錄字幕。")
        else:
            cues = parse_srt(srt_path.read_text(encoding="utf-8", errors="replace"))
            if not cues:
                warnings.append("subtitles.srt 解析不到任何字幕，本次不燒錄字幕。")
            else:
                cue_count = len(cues)
                cue_end = max(c[1] for c in cues)
                if abs(cue_end - total_out) > 0.5:
                    warnings.append(
                        f"字幕時軸與成片長度不符：字幕結束於 {cue_end:.2f}s，"
                        f"成片約 {total_out:.2f}s（差 {cue_end - total_out:+.2f}s）。"
                        f"請以「加速後」的累計時間撰寫 SRT。"
                    )
                ass_path = output_dir / "subtitles.ass"
                ass_path.write_text(
                    build_ass(cues, font_name, font_size, margin_v), encoding="utf-8"
                )

    inputs, filter_complex = build_filter_complex(
        shots=shots, speed=speed, fade_sec=fade_sec, ass_path=ass_path, lufs=lufs
    )

    cmd = [
        "ffmpeg",
        "-y" if (force or not final_path.exists()) else "-n",
        *inputs,
        "-filter_complex", filter_complex,
        "-map", "[vout]",
        "-map", "[aout]",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-ar", str(SAMPLE_RATE),
        "-movflags", "+faststart",
        str(final_path),
    ]

    if dry_run:
        return AssemblyResult(
            output_path=final_path,
            duration=total_out,
            has_audio=True,
            shots=shots,
            warnings=warnings,
            subtitle_cues=cue_count,
            subtitle_end=cue_end,
        )

    res = subprocess.run(cmd, capture_output=True, text=True)
    if verbose:
        sys.stderr.write(res.stderr)
    if res.returncode != 0:
        tail = "\n".join(res.stderr.strip().splitlines()[-25:])
        raise RuntimeError(f"FFmpeg 執行失敗（exit {res.returncode}）：\n{tail}")

    info = probe_clip(final_path)
    report = {
        "version": "0.2.0",
        "project": str(project_dir),
        "output": str(final_path),
        "output_duration_sec": round(info.duration, 3),
        "planned_duration_sec": round(total_out, 3),
        "speed": speed,
        "clip_duration": clip_duration,
        "intro_duration": intro_duration,
        "loudness_target_lufs": lufs,
        "subtitles": {
            "enabled": ass_path is not None,
            "cues": cue_count,
            "last_cue_end_sec": round(cue_end, 3),
            "ass_file": str(ass_path) if ass_path else None,
        },
        "shots": [
            {
                "order": i + 1,
                "file": s.clip.path.name,
                "source_duration_sec": round(s.clip.duration, 3),
                "required_source_sec": round(s.raw_needed, 3),
                "used_source_sec": round(s.raw_duration, 3),
                "output_duration_sec": round(s.out_duration, 3),
                "has_audio": s.clip.has_audio,
                "source_size": f"{s.clip.width}x{s.clip.height}",
            }
            for i, s in enumerate(shots)
        ],
        "warnings": warnings,
    }
    (output_dir / "assemble_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    return AssemblyResult(
        output_path=final_path,
        duration=info.duration,
        has_audio=info.has_audio,
        shots=shots,
        warnings=warnings,
        subtitle_cues=cue_count,
        subtitle_end=cue_end,
    )


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="將 Google Flow 美食片段自動剪輯為 9:16 ASMR YouTube Shorts。"
    )
    parser.add_argument("--project", required=True, type=Path,
                        help="專案資料夾路徑（需包含 clips/ 子資料夾）")
    parser.add_argument("--clip-duration", type=float, default=2.5,
                        help="一般鏡頭加速後目標秒數（預設 2.5）")
    parser.add_argument("--intro-duration", type=float, default=1.8,
                        help="首鏡加速後目標秒數；設 0 表示首鏡比照一般鏡頭（預設 1.8）")
    parser.add_argument("--speed", type=float, default=1.25,
                        help="播放加速倍率（預設 1.25）")
    parser.add_argument("--fade", type=float, default=0.04,
                        help="每段音訊頭尾淡入淡出秒數（預設 0.04）")
    parser.add_argument("--lufs", type=float, default=-14.0,
                        help="整體響度目標（預設 -14，對齊 YouTube 正規化）")
    parser.add_argument("--no-subs", action="store_true", help="停用字幕燒錄")
    parser.add_argument("--font", default="Arial", help="字幕字體（預設 Arial）")
    parser.add_argument("--font-size", type=int, default=96,
                        help="字幕字級，單位為 1080x1920 畫面上的真實像素（預設 96）")
    parser.add_argument("--margin-v", type=int, default=240,
                        help="字幕距畫面底部像素（預設 240，避開 Shorts 介面）")
    parser.add_argument("--force", action="store_true", help="允許覆寫既有輸出檔")
    parser.add_argument("--out", type=Path, default=None, help="指定輸出檔路徑")
    parser.add_argument("--dry-run", action="store_true",
                        help="只輸出剪輯計畫與警告，不實際編碼")
    parser.add_argument("--verbose", action="store_true", help="顯示完整 FFmpeg 日誌")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        result = assemble_project(
            project_dir=args.project,
            clip_duration=args.clip_duration,
            intro_duration=args.intro_duration,
            speed=args.speed,
            fade_sec=args.fade,
            use_subs=not args.no_subs,
            lufs=args.lufs,
            font_name=args.font,
            font_size=args.font_size,
            margin_v=args.margin_v,
            force=args.force,
            out_path=args.out,
            dry_run=args.dry_run,
            verbose=args.verbose,
        )
    except Exception as exc:  # noqa: BLE001 - surfaced to the user verbatim
        print(f"剪輯失敗：{exc}", file=sys.stderr)
        return 1

    if args.dry_run:
        print("【DRY RUN】未進行編碼，以下為剪輯計畫：")
        for i, shot in enumerate(result.shots, start=1):
            audio_note = "" if shot.clip.has_audio else "  [無音軌→補靜音]"
            print(
                f"  {i:02d}. {shot.clip.path.name:<12} "
                f"原始 {shot.clip.duration:5.2f}s → 取用 {shot.raw_duration:5.2f}s "
                f"→ 輸出 {shot.out_duration:4.2f}s{audio_note}"
            )
        print(f"  合計輸出長度：{result.duration:.2f}s")
        if result.subtitle_cues:
            print(f"  字幕：{result.subtitle_cues} 條，結束於 {result.subtitle_end:.2f}s")
        for w in result.warnings:
            print(f"  ⚠ {w}")
        return 0

    print(f"成片輸出成功：{result.output_path}")
    print(f"總片長：{result.duration:.2f} 秒 | 含音軌：{result.has_audio}")
    if result.subtitle_cues:
        print(f"字幕：已燒錄 {result.subtitle_cues} 條")
    else:
        print("字幕：未燒錄")
    print(f"報告：{result.output_path.parent / 'assemble_report.json'}")
    for w in result.warnings:
        print(f"⚠ {w}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
