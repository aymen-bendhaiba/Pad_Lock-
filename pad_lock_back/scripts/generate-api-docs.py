from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, Preformatted, SimpleDocTemplate, Spacer


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "README.md"
OUTPUT = ROOT / "output" / "pdf" / "lock-management-api-documentation.pdf"

GREEN = colors.HexColor("#178A72")
DARK = colors.HexColor("#17252A")
MUTED = colors.HexColor("#52636A")
CODE_BG = colors.HexColor("#F2F6F5")
LINE = colors.HexColor("#D8E2DF")


def page_decor(canvas, document):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(GREEN)
    canvas.rect(0, height - 12 * mm, width, 12 * mm, stroke=0, fill=1)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 9)
    canvas.drawString(18 * mm, height - 8 * mm, "Lock Management API Documentation")
    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, 14 * mm, width - 18 * mm, 14 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(18 * mm, 9 * mm, "JT701D smart lock backend")
    canvas.drawRightString(width - 18 * mm, 9 * mm, f"Page {document.page}")
    canvas.restoreState()


def styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "Title",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=25,
            leading=30,
            textColor=DARK,
            alignment=TA_CENTER,
            spaceAfter=8 * mm,
        ),
        "h2": ParagraphStyle(
            "H2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=15,
            leading=19,
            textColor=GREEN,
            spaceBefore=6 * mm,
            spaceAfter=2.5 * mm,
            keepWithNext=True,
        ),
        "h3": ParagraphStyle(
            "H3",
            parent=base["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=11.5,
            leading=15,
            textColor=DARK,
            spaceBefore=4 * mm,
            spaceAfter=2 * mm,
            keepWithNext=True,
        ),
        "h4": ParagraphStyle(
            "H4",
            parent=base["Heading4"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=13,
            textColor=GREEN,
            spaceBefore=3 * mm,
            spaceAfter=1.5 * mm,
            keepWithNext=True,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.2,
            leading=13.5,
            textColor=DARK,
            spaceAfter=2.2 * mm,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=13,
            leftIndent=5 * mm,
            firstLineIndent=-3 * mm,
            textColor=DARK,
            spaceAfter=1.2 * mm,
        ),
        "code": ParagraphStyle(
            "Code",
            fontName="Courier",
            fontSize=7.1,
            leading=9.5,
            leftIndent=4 * mm,
            rightIndent=4 * mm,
            borderColor=LINE,
            borderWidth=0.6,
            borderPadding=3 * mm,
            backColor=CODE_BG,
            textColor=colors.HexColor("#20312F"),
            spaceBefore=1.5 * mm,
            spaceAfter=3 * mm,
        ),
    }


def inline_markup(text):
    result = []
    parts = text.split("`")
    for index, part in enumerate(parts):
        value = escape(part)
        if index % 2:
            result.append(f'<font name="Courier" color="#176B5A">{value}</font>')
        else:
            result.append(value)
    return "".join(result)


def build_story(markdown):
    style = styles()
    story = []
    lines = markdown.splitlines()
    paragraph = []
    code = []
    in_code = False

    def flush_paragraph():
        if paragraph:
            story.append(
                Paragraph(inline_markup(" ".join(paragraph).strip()), style["body"])
            )
            paragraph.clear()

    for line in lines:
        if line.startswith("```"):
            flush_paragraph()
            if in_code:
                story.append(Preformatted("\n".join(code), style["code"]))
                code.clear()
            in_code = not in_code
            continue

        if in_code:
            code.append(line)
            continue

        if not line.strip():
            flush_paragraph()
            continue

        if line.startswith("# "):
            flush_paragraph()
            story.append(Spacer(1, 12 * mm))
            story.append(Paragraph(escape(line[2:].strip()), style["title"]))
            story.append(
                Paragraph(
                    "Setup, authenticated endpoints, realtime alerts, geofences, "
                    "RFID enforcement, lock configuration, retention, and TCP behavior.",
                    ParagraphStyle(
                        "Subtitle",
                        parent=style["body"],
                        alignment=TA_CENTER,
                        textColor=MUTED,
                        fontSize=10.5,
                        leading=15,
                        spaceAfter=7 * mm,
                    ),
                )
            )
            continue

        if line.startswith("## "):
            flush_paragraph()
            story.append(Paragraph(escape(line[3:].strip()), style["h2"]))
            continue

        if line.startswith("#### "):
            flush_paragraph()
            story.append(Paragraph(escape(line[5:].strip()), style["h4"]))
            continue

        if line.startswith("### "):
            flush_paragraph()
            story.append(Paragraph(escape(line[4:].strip()), style["h3"]))
            continue

        if line.startswith("- "):
            flush_paragraph()
            story.append(
                Paragraph(f"- {inline_markup(line[2:].strip())}", style["bullet"])
            )
            continue

        paragraph.append(line.strip())

    flush_paragraph()
    if code:
        story.append(Preformatted("\n".join(code), style["code"]))

    return story


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    document = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title="Lock Management API Documentation",
        author="Lock Management Platform",
    )
    document.build(
        build_story(SOURCE.read_text(encoding="utf-8")),
        onFirstPage=page_decor,
        onLaterPages=page_decor,
    )
    print(OUTPUT)


if __name__ == "__main__":
    main()
