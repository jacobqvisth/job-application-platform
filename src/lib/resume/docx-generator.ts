import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "docx";
import type {
  ResumeContent,
  ResumeSection,
  ExperienceSectionContent,
  EducationSectionContent,
  SkillsSectionContent,
  CertificationsSectionContent,
  LanguagesSectionContent,
  SummarySectionContent,
  CustomSectionContent,
  ReferencesSectionContent,
  PhotoSectionContent,
} from "@/lib/types/database";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Present";
  const [year, month] = dateStr.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[parseInt(month) - 1]} ${year}`;
}

function sectionDivider(): Paragraph {
  return new Paragraph({
    border: {
      bottom: {
        color: "AAAAAA",
        space: 1,
        style: BorderStyle.SINGLE,
        size: 6,
      },
    },
    spacing: { after: 80 },
  });
}

function sectionTitle(title: string): Paragraph[] {
  return [
    new Paragraph({
      text: title.toUpperCase(),
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 160, after: 40 },
      run: {
        size: 18,
        bold: true,
        color: "333333",
      },
    }),
    sectionDivider(),
  ];
}

function swedishSectionTitle(title: string): Paragraph[] {
  return [
    new Paragraph({
      text: title.toUpperCase(),
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 160, after: 40 },
      run: {
        size: 18,
        bold: true,
        color: "4B6A8A",
      },
    }),
    new Paragraph({
      border: {
        bottom: {
          color: "4B6A8A",
          space: 1,
          style: BorderStyle.SINGLE,
          size: 6,
        },
      },
      spacing: { after: 80 },
    }),
  ];
}

function referenceParagraphs(section: ResumeSection): Paragraph[] {
  const c = section.content as ReferencesSectionContent;
  if (c.showOnRequest) {
    return [
      new Paragraph({
        children: [new TextRun({ text: "Lämnas på begäran", italics: true, color: "555555" })],
        spacing: { after: 40 },
      }),
    ];
  }
  const paragraphs: Paragraph[] = [];
  for (const ref of c.items) {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: ref.name, bold: true })],
        spacing: { before: 80, after: 20 },
      })
    );
    if (ref.title || ref.company) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: [ref.title, ref.company].filter(Boolean).join(", "), color: "555555" }),
          ],
          spacing: { after: 20 },
        })
      );
    }
    if (ref.phone || ref.email) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: [ref.phone, ref.email].filter(Boolean).join(" · "), color: "777777", size: 18 }),
          ],
          spacing: { after: 20 },
        })
      );
    }
  }
  return paragraphs;
}

function sectionParagraphs(section: ResumeSection): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  switch (section.type) {
    case "summary": {
      const c = section.content as SummarySectionContent;
      paragraphs.push(
        new Paragraph({
          text: c.text,
          spacing: { after: 80 },
        })
      );
      break;
    }
    case "experience": {
      const c = section.content as ExperienceSectionContent;
      for (const item of c.items) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: item.title, bold: true }),
              new TextRun({ text: `  ·  ${item.company}`, color: "555555" }),
              new TextRun({
                text: `  ${formatDate(item.startDate)} – ${formatDate(item.endDate)}`,
                color: "777777",
                size: 18,
              }),
            ],
            spacing: { before: 120, after: 20 },
          })
        );
        if (item.location) {
          paragraphs.push(
            new Paragraph({
              text: item.location,
              style: "aside",
              spacing: { after: 20 },
              run: { color: "777777", size: 18 },
            })
          );
        }
        for (const bullet of item.bullets.filter(Boolean)) {
          paragraphs.push(
            new Paragraph({
              text: bullet,
              bullet: { level: 0 },
              spacing: { after: 20 },
            })
          );
        }
      }
      break;
    }
    case "education": {
      const c = section.content as EducationSectionContent;
      for (const item of c.items) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: item.institution, bold: true }),
              new TextRun({
                text: `  ${formatDate(item.startDate)} – ${formatDate(item.endDate)}`,
                color: "777777",
                size: 18,
              }),
            ],
            spacing: { before: 100, after: 20 },
          })
        );
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${item.degree}${item.field ? `, ${item.field}` : ""}${item.gpa ? `  ·  GPA: ${item.gpa}` : ""}`,
                color: "555555",
              }),
            ],
            spacing: { after: 60 },
          })
        );
      }
      break;
    }
    case "skills": {
      const c = section.content as SkillsSectionContent;
      for (const cat of c.categories.filter((cat) => cat.skills.length > 0)) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${cat.name}: `, bold: true }),
              new TextRun({ text: cat.skills.join(", ") }),
            ],
            spacing: { after: 40 },
          })
        );
      }
      break;
    }
    case "certifications": {
      const c = section.content as CertificationsSectionContent;
      for (const item of c.items) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: item.name, bold: true }),
              new TextRun({ text: `  ·  ${item.issuer}`, color: "555555" }),
              new TextRun({ text: `  ${formatDate(item.date)}`, color: "777777", size: 18 }),
            ],
            spacing: { after: 40 },
          })
        );
      }
      break;
    }
    case "languages": {
      const c = section.content as LanguagesSectionContent;
      const langText = c.items
        .map((l) => `${l.language} (${l.proficiency})`)
        .join("  ·  ");
      paragraphs.push(
        new Paragraph({ text: langText, spacing: { after: 40 } })
      );
      break;
    }
    case "custom": {
      const c = section.content as CustomSectionContent;
      paragraphs.push(
        new Paragraph({ text: c.text, spacing: { after: 80 } })
      );
      break;
    }
    case "references": {
      paragraphs.push(...referenceParagraphs(section));
      break;
    }
    case "photo":
      // Photo is handled in the header; skip as a body section
      break;
  }

  return paragraphs;
}

export async function generateDocx(
  content: ResumeContent,
  name: string
): Promise<Buffer> {
  const visibleSections = content.sections
    .filter((s) => s.visible)
    .sort((a, b) => a.order - b.order);

  const children: Paragraph[] = [];

  if (content.template === "swedish") {
    // Swedish template: name header with accent underline, single-column body (no photo in DOCX)
    const photoSection = visibleSections.find((s) => s.type === "photo");
    const photoUrl = photoSection
      ? (photoSection.content as PhotoSectionContent).url
      : null;

    // Header paragraph
    const headerChildren: (TextRun | import("docx").ImageRun)[] = [
      new TextRun({ text: name, bold: true, size: 32, color: "1a1a1a" }),
    ];

    if (photoUrl) {
      // Attempt to embed photo; on failure gracefully skip
      try {
        const photoRes = await fetch(photoUrl);
        if (photoRes.ok) {
          const photoBuffer = await photoRes.arrayBuffer();
          const { ImageRun } = await import("docx");
          headerChildren.unshift(
            new ImageRun({
              data: Buffer.from(photoBuffer),
              transformation: { width: 55, height: 70 },
              type: "jpg",
            })
          );
        }
      } catch {
        // Skip photo if fetch fails
      }
    }

    children.push(
      new Paragraph({
        children: headerChildren,
        spacing: { after: 160 },
        border: {
          bottom: {
            color: "4B6A8A",
            space: 1,
            style: BorderStyle.SINGLE,
            size: 8,
          },
        },
      })
    );

    const bodySections = visibleSections.filter((s) => s.type !== "photo");
    for (const section of bodySections) {
      children.push(...swedishSectionTitle(section.title));
      children.push(...sectionParagraphs(section));
    }
  } else {
    // Name header for non-Swedish templates
    children.push(
      new Paragraph({
        children: [new TextRun({ text: name, bold: true, size: 36 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
        border: {
          bottom: {
            color: "333333",
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
      })
    );
  }

  // For modern template, build two-column layout using a table (Swedish already handled above)
  if (content.template === "swedish") {
    // Body already built above — nothing to do here
  } else if (content.template === "modern") {
    const sidebarTypes = ["skills", "languages", "certifications"];
    const sidebarSections = visibleSections.filter((s) =>
      sidebarTypes.includes(s.type)
    );
    const mainSections = visibleSections.filter(
      (s) => !sidebarTypes.includes(s.type)
    );

    const sidebarParagraphs: Paragraph[] = [];
    for (const section of sidebarSections) {
      sidebarParagraphs.push(...sectionTitle(section.title));
      sidebarParagraphs.push(...sectionParagraphs(section));
    }

    const mainParagraphs: Paragraph[] = [];
    for (const section of mainSections) {
      mainParagraphs.push(...sectionTitle(section.title));
      mainParagraphs.push(...sectionParagraphs(section));
    }

    children.push(
      new Paragraph({
        children: [
          new Table({
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: sidebarParagraphs,
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    shading: { fill: "F4F4F5" },
                    margins: { top: 100, bottom: 100, left: 100, right: 100 },
                  }),
                  new TableCell({
                    children: mainParagraphs,
                    width: { size: 70, type: WidthType.PERCENTAGE },
                    margins: { top: 100, bottom: 100, left: 200, right: 100 },
                  }),
                ],
              }),
            ],
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),
        ],
      })
    );
  } else {
    // Single column (clean / compact)
    for (const section of visibleSections) {
      children.push(...sectionTitle(section.title));
      children.push(...sectionParagraphs(section));
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: content.template === "compact" ? 720 : 1080,
              right: content.template === "compact" ? 720 : 1080,
              bottom: content.template === "compact" ? 720 : 1080,
              left: content.template === "compact" ? 720 : 1080,
              // Swedish uses A4 default margins (already A4 default for docx)
            },
          },
        },
        children,
      },
    ],
    styles: {
      paragraphStyles: [
        {
          id: "aside",
          name: "Aside",
          basedOn: "Normal",
          run: { color: "777777", size: 18 },
        },
      ],
    },
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
