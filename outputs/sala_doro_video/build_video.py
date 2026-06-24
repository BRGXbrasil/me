# -*- coding: utf-8 -*-
from pathlib import Path
import math
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont
import pypdfium2 as pdfium
from moviepy import AudioArrayClip, AudioFileClip, CompositeAudioClip, VideoClip


BASE = Path(__file__).resolve().parent
SOURCES = BASE / "sources"
FRAMES = BASE / "frames"
FINAL = BASE / "final"

WIDTH = 1920
HEIGHT = 1080
FPS = 24

NARRATION = FINAL / "naracao_sala_doro.wav"
MUSIC = FINAL / "trilha_instrumental_discreta.wav"
VIDEO = FINAL / "sala_doro_video_institucional.mp4"

SERIF_FONT = Path(r"C:\Windows\Fonts\georgia.ttf")
SANS_FONT = Path(r"C:\Windows\Fonts\segoeui.ttf")

SCENES = [
    {
        "slug": "01_abertura",
        "pdf": "apresentacao_sala_doro.pdf",
        "page": 1,
        "title": "SALA D'ORO",
        "subtitle": "Beleza, sofisticação e cuidado",
        "show_text": False,
        "crop": (0.0, 0.0, 1.0, 1.0),
        "pan": (-0.05, 0.02),
    },
    {
        "slug": "02_alphaville",
        "pdf": "apresentacao_sala_doro.pdf",
        "page": 3,
        "title": "Alphaville",
        "subtitle": "Beleza, bem-estar e conveniência",
        "show_text": False,
        "crop": (0.0, 0.0, 0.72, 1.0),
        "pan": (-0.03, -0.02),
    },
    {
        "slug": "03_cuidado",
        "pdf": "apresentacao_sala_doro.pdf",
        "page": 4,
        "title": "Cuidado",
        "subtitle": "Atendimento premium",
        "show_text": False,
        "crop": (0.0, 0.0, 0.72, 1.0),
        "pan": (0.03, 0.03),
    },
    {
        "slug": "04_experiencia",
        "pdf": "apresentacao_sala_doro.pdf",
        "page": 5,
        "title": "Experiência",
        "subtitle": "Conforto, sabor e presença",
        "show_text": False,
        "crop": (0.0, 0.0, 0.70, 1.0),
        "pan": (-0.04, 0.02),
    },
    {
        "slug": "05_estilo",
        "pdf": "apresentacao_sala_doro.pdf",
        "page": 6,
        "title": "Estilo",
        "subtitle": "Espaços feminino e masculino",
        "show_text": False,
        "crop": (0.0, 0.0, 0.72, 1.0),
        "pan": (0.04, -0.02),
    },
    {
        "slug": "06_ambiente",
        "pdf": "apresentacao_sala_doro.pdf",
        "page": 7,
        "title": "Ambiente",
        "subtitle": "Privacidade e acolhimento",
        "show_text": False,
        "crop": (0.0, 0.0, 0.72, 1.0),
        "pan": (-0.03, 0.03),
    },
    {
        "slug": "07_sao_paulo",
        "pdf": "apresentacao_sala_doro.pdf",
        "page": 8,
        "title": "São Paulo",
        "subtitle": "Luxo, elegância e hospitalidade",
        "show_text": False,
        "crop": (0.42, 0.0, 0.78, 1.0),
        "pan": (0.03, 0.01),
    },
    {
        "slug": "08_sao_paulo_ambientes",
        "pdf": "apresentacao_vila_nova.pdf",
        "page": 9,
        "title": "Ambientes",
        "subtitle": "Detalhes de experiência",
        "show_text": False,
        "crop": (0.0, 0.0, 0.78, 1.0),
        "pan": (-0.04, -0.01),
    },
    {
        "slug": "09_encerramento",
        "pdf": "apresentacao_vila_nova.pdf",
        "page": 1,
        "title": "Excelência é identidade",
        "subtitle": "Todos os dias",
        "show_text": True,
        "crop": (0.0, 0.0, 1.0, 1.0),
        "pan": (0.0, 0.0),
    },
]


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(str(path), size=size)
    except OSError:
        return ImageFont.load_default()


def render_pdf_page(pdf_name: str, page_number: int, out_path: Path) -> Path:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    pdf_path = SOURCES / pdf_name
    document = pdfium.PdfDocument(str(pdf_path))
    page = document[page_number - 1]
    image = page.render(scale=1.5).to_pil().convert("RGB")
    image.save(out_path, quality=96)
    return out_path


def prepare_scene_images() -> list[Image.Image]:
    images = []
    for scene in SCENES:
        out = FRAMES / f"{scene['slug']}.png"
        render_pdf_page(scene["pdf"], scene["page"], out)
        image = Image.open(out).convert("RGB")
        if "crop" in scene:
            left, top, right, bottom = scene["crop"]
            image = image.crop((
                int(image.width * left),
                int(image.height * top),
                int(image.width * right),
                int(image.height * bottom),
            ))
            image.save(FRAMES / f"{scene['slug']}_crop.png", quality=96)
        images.append(image)
    return images


def audio_duration(path: Path) -> float:
    with wave.open(str(path), "rb") as audio:
        return audio.getnframes() / audio.getframerate()


def make_music(duration: float, sample_rate: int = 44100) -> np.ndarray:
    t = np.linspace(0, duration, int(duration * sample_rate), endpoint=False)
    envelope = np.minimum(1.0, t / 3.5) * np.minimum(1.0, (duration - t) / 4.0)
    envelope = np.clip(envelope, 0.0, 1.0)
    lfo = 0.72 + 0.28 * np.sin(2 * math.pi * 0.035 * t)

    chords = [
        (98.0, 146.83, 196.0, 293.66),
        (110.0, 164.81, 220.0, 329.63),
        (87.31, 130.81, 196.0, 261.63),
    ]
    signal = np.zeros_like(t)
    segment = max(duration / len(chords), 1)
    for index, freqs in enumerate(chords):
        start = index * segment
        end = duration if index == len(chords) - 1 else (index + 1) * segment
        mask = (t >= start) & (t < end)
        local = t[mask] - start
        chord = np.zeros_like(local)
        for freq in freqs:
            chord += np.sin(2 * math.pi * freq * local)
            chord += 0.35 * np.sin(2 * math.pi * freq * 2 * local)
        signal[mask] = chord / (len(freqs) * 1.35)

    signal = signal * envelope * lfo * 0.09
    left = signal
    right = np.roll(signal, sample_rate // 7) * 0.9
    return np.column_stack([left, right]).astype(np.float32)


def save_music_wav(samples: np.ndarray, sample_rate: int = 44100) -> None:
    MUSIC.parent.mkdir(parents=True, exist_ok=True)
    clipped = np.clip(samples, -1, 1)
    pcm = (clipped * 32767).astype(np.int16)
    with wave.open(str(MUSIC), "wb") as audio:
        audio.setnchannels(2)
        audio.setsampwidth(2)
        audio.setframerate(sample_rate)
        audio.writeframes(pcm.tobytes())


def cover_crop(image: Image.Image, zoom: float, x_focus: float, y_focus: float) -> Image.Image:
    scale = max(WIDTH / image.width, HEIGHT / image.height) * zoom
    resized = image.resize((math.ceil(image.width * scale), math.ceil(image.height * scale)), Image.Resampling.LANCZOS)
    max_x = max(resized.width - WIDTH, 0)
    max_y = max(resized.height - HEIGHT, 0)
    left = int(max_x * min(max(x_focus, 0.0), 1.0))
    top = int(max_y * min(max(y_focus, 0.0), 1.0))
    return resized.crop((left, top, left + WIDTH, top + HEIGHT))


def draw_caption(frame: Image.Image, title: str, subtitle: str, opacity: float) -> None:
    draw = ImageDraw.Draw(frame, "RGBA")
    title_font = font(SERIF_FONT, 64)
    subtitle_font = font(SANS_FONT, 28)
    small_font = font(SANS_FONT, 19)
    gold = (214, 179, 83, int(235 * opacity))
    white = (255, 255, 255, int(235 * opacity))
    soft = (230, 224, 212, int(205 * opacity))
    shadow = (0, 0, 0, int(140 * opacity))

    x = 112
    y = 805
    draw.text((x + 2, y + 2), title, font=title_font, fill=shadow)
    draw.text((x, y), title, font=title_font, fill=white)
    if subtitle:
        draw.text((x + 2, y + 82), subtitle, font=subtitle_font, fill=shadow)
        draw.text((x, y + 80), subtitle, font=subtitle_font, fill=soft)
    draw.line((x, y - 28, x + 118, y - 28), fill=gold, width=3)
    draw.text((x, y - 66), "SALA D'ORO", font=small_font, fill=(255, 255, 255, int(150 * opacity)))


def make_frame_builder(images: list[Image.Image], duration: float):
    scene_duration = duration / len(SCENES)

    def make_frame(t: float) -> np.ndarray:
        scene_index = min(int(t / scene_duration), len(SCENES) - 1)
        scene = SCENES[scene_index]
        local = (t - scene_index * scene_duration) / scene_duration
        local = min(max(local, 0.0), 1.0)
        fade = min(1.0, local / 0.12, (1.0 - local) / 0.12)
        zoom = 1.035 + 0.055 * local
        pan_x, pan_y = scene["pan"]
        x_focus = 0.5 + pan_x * (local - 0.5)
        y_focus = 0.5 + pan_y * (local - 0.5)

        frame = cover_crop(images[scene_index], zoom, x_focus, y_focus)
        overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 54))
        frame = Image.alpha_composite(frame.convert("RGBA"), overlay)

        vignette = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
        vd = ImageDraw.Draw(vignette, "RGBA")
        for i in range(80):
            alpha = int((i / 80) ** 1.8 * 95)
            vd.rectangle((i, i, WIDTH - i, HEIGHT - i), outline=(0, 0, 0, alpha), width=2)
        frame = Image.alpha_composite(frame, vignette)

        if scene.get("show_text", True):
            draw_caption(frame, scene["title"], scene["subtitle"], fade)

        if fade < 1:
            black = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, int((1 - fade) * 255)))
            frame = Image.alpha_composite(frame, black)
        return np.array(frame.convert("RGB"))

    return make_frame


def write_scene_notes(duration: float) -> None:
    scene_duration = duration / len(SCENES)
    lines = [
        "# Vídeo institucional Sala D'Oro",
        "",
        f"Duração final prevista: {duration:.2f} segundos.",
        "",
        "Fontes visuais e textuais utilizadas: apresentações institucionais oficiais do Sala D'Oro e documento de Missão, Visão e Valores presentes na pasta de origem.",
        "",
        "## Sequência de cenas",
    ]
    for index, scene in enumerate(SCENES, start=1):
        start = (index - 1) * scene_duration
        end = min(index * scene_duration, duration)
        lines.append(f"{index}. {start:05.2f}s-{end:05.2f}s | {scene['title']} | {scene['pdf']} página {scene['page']}")
    (FINAL / "roteiro_e_cenas.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    FRAMES.mkdir(parents=True, exist_ok=True)
    FINAL.mkdir(parents=True, exist_ok=True)

    narration_duration = audio_duration(NARRATION)
    duration = min(narration_duration + 0.45, 119.2)
    images = prepare_scene_images()

    music_samples = make_music(duration)
    save_music_wav(music_samples)

    voice = AudioFileClip(str(NARRATION)).with_volume_scaled(1.0)
    music = AudioArrayClip(music_samples, fps=44100).with_duration(duration).with_volume_scaled(0.16)
    audio = CompositeAudioClip([music, voice]).with_duration(duration)
    video = VideoClip(make_frame_builder(images, duration), duration=duration).with_audio(audio)

    video.write_videofile(
        str(VIDEO),
        fps=FPS,
        codec="libx264",
        bitrate="5200k",
        audio_codec="aac",
        audio_bitrate="192k",
        preset="medium",
        threads=4,
        ffmpeg_params=["-movflags", "+faststart"],
        pixel_format="yuv420p",
        logger=None,
    )
    write_scene_notes(duration)

    audio.close()
    voice.close()
    video.close()


if __name__ == "__main__":
    main()
