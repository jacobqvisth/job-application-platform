"use client";

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

interface ResumePreviewProps {
  content: ResumeContent;
  name?: string;
  scale?: number;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Present";
  const [year, month] = dateStr.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[parseInt(month) - 1]} ${year}`;
}

function SectionContent({ section }: { section: ResumeSection }) {
  switch (section.type) {
    case "summary": {
      const content = section.content as SummarySectionContent;
      return <p className="text-xs leading-relaxed">{content.text}</p>;
    }
    case "experience": {
      const content = section.content as ExperienceSectionContent;
      return (
        <div className="space-y-3">
          {content.items.map((item) => (
            <div key={item.id}>
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold">{item.title}</span>
                <span className="text-[10px] text-gray-500">
                  {formatDate(item.startDate)} – {formatDate(item.endDate)}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-gray-600">{item.company}</span>
                <span className="text-[10px] text-gray-400">{item.location}</span>
              </div>
              {item.bullets.filter(Boolean).length > 0 && (
                <ul className="mt-1 space-y-0.5 pl-3">
                  {item.bullets.filter(Boolean).map((bullet, i) => (
                    <li key={i} className="text-[10px] leading-tight relative">
                      <span className="absolute -left-3">•</span>
                      {bullet}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      );
    }
    case "education": {
      const content = section.content as EducationSectionContent;
      return (
        <div className="space-y-2">
          {content.items.map((item) => (
            <div key={item.id}>
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold">{item.institution}</span>
                <span className="text-[10px] text-gray-500">
                  {formatDate(item.startDate)} – {formatDate(item.endDate)}
                </span>
              </div>
              <span className="text-xs text-gray-600">
                {item.degree}{item.field ? `, ${item.field}` : ""}
              </span>
              {item.gpa && (
                <span className="text-[10px] text-gray-400"> · GPA: {item.gpa}</span>
              )}
            </div>
          ))}
        </div>
      );
    }
    case "skills": {
      const content = section.content as SkillsSectionContent;
      return (
        <div className="space-y-1">
          {content.categories.filter((c) => c.skills.length > 0).map((cat) => (
            <div key={cat.id} className="flex gap-1 flex-wrap">
              <span className="text-[10px] font-semibold min-w-fit">{cat.name}:</span>
              <span className="text-[10px] text-gray-600">{cat.skills.join(", ")}</span>
            </div>
          ))}
        </div>
      );
    }
    case "certifications": {
      const content = section.content as CertificationsSectionContent;
      return (
        <div className="space-y-1">
          {content.items.map((item) => (
            <div key={item.id} className="flex items-baseline justify-between">
              <span className="text-xs">{item.name} · {item.issuer}</span>
              <span className="text-[10px] text-gray-500">{formatDate(item.date)}</span>
            </div>
          ))}
        </div>
      );
    }
    case "languages": {
      const content = section.content as LanguagesSectionContent;
      return (
        <div className="flex flex-wrap gap-2">
          {content.items.map((item) => (
            <span key={item.id} className="text-xs">
              {item.language} <span className="text-gray-400">({item.proficiency})</span>
            </span>
          ))}
        </div>
      );
    }
    case "custom": {
      const content = section.content as CustomSectionContent;
      return <p className="text-xs leading-relaxed whitespace-pre-wrap">{content.text}</p>;
    }
    case "references": {
      const content = section.content as ReferencesSectionContent;
      if (content.showOnRequest) {
        return <p className="text-xs text-gray-600 italic">Lämnas på begäran</p>;
      }
      return (
        <div className="space-y-2">
          {content.items.map((ref) => (
            <div key={ref.id}>
              <span className="text-xs font-semibold">{ref.name}</span>
              {ref.title && ref.company && (
                <span className="text-xs text-gray-600"> · {ref.title}, {ref.company}</span>
              )}
              <div className="flex gap-3">
                {ref.phone && <span className="text-[10px] text-gray-500">{ref.phone}</span>}
                {ref.email && <span className="text-[10px] text-gray-500">{ref.email}</span>}
              </div>
            </div>
          ))}
        </div>
      );
    }
    case "photo":
      return null; // Rendered in header area by Swedish template
    default:
      return null;
  }
}

function CleanTemplate({
  content,
  name,
}: {
  content: ResumeContent;
  name?: string;
}) {
  const visibleSections = content.sections
    .filter((s) => s.visible)
    .sort((a, b) => a.order - b.order);

  return (
    <div className="bg-white p-6 font-serif" style={{ minHeight: "100%" }}>
      {name && (
        <div className="mb-4 text-center border-b border-gray-300 pb-3">
          <h1 className="text-lg font-bold tracking-wide">{name}</h1>
        </div>
      )}
      {visibleSections.map((section) => (
        <div key={section.id} className="mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider border-b border-gray-200 pb-0.5 mb-1.5">
            {section.title}
          </h2>
          <SectionContent section={section} />
        </div>
      ))}
    </div>
  );
}

function ModernTemplate({
  content,
  name,
}: {
  content: ResumeContent;
  name?: string;
}) {
  const visibleSections = content.sections
    .filter((s) => s.visible)
    .sort((a, b) => a.order - b.order);

  const sidebarTypes = ["skills", "languages", "certifications"];
  const sidebarSections = visibleSections.filter((s) =>
    sidebarTypes.includes(s.type)
  );
  const mainSections = visibleSections.filter(
    (s) => !sidebarTypes.includes(s.type)
  );

  return (
    <div className="bg-white font-sans flex" style={{ minHeight: "100%" }}>
      {/* Sidebar */}
      <div className="w-1/3 bg-zinc-800 text-white p-4">
        {name && (
          <h1 className="text-sm font-bold mb-4 leading-tight">{name}</h1>
        )}
        {sidebarSections.map((section) => (
          <div key={section.id} className="mb-3">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">
              {section.title}
            </h2>
            <div className="text-white">
              <SectionContent section={section} />
            </div>
          </div>
        ))}
      </div>
      {/* Main */}
      <div className="flex-1 p-4">
        {mainSections.map((section) => (
          <div key={section.id} className="mb-3">
            <h2 className="text-xs font-bold text-zinc-700 uppercase tracking-wider border-b-2 border-zinc-200 pb-0.5 mb-1.5">
              {section.title}
            </h2>
            <SectionContent section={section} />
          </div>
        ))}
      </div>
    </div>
  );
}

function CompactTemplate({
  content,
  name,
}: {
  content: ResumeContent;
  name?: string;
}) {
  const visibleSections = content.sections
    .filter((s) => s.visible)
    .sort((a, b) => a.order - b.order);

  return (
    <div
      className="bg-white p-4 font-sans"
      style={{ minHeight: "100%", fontSize: "9px" }}
    >
      {name && (
        <div className="mb-2 pb-1 border-b-2 border-gray-800">
          <h1 className="text-sm font-bold">{name}</h1>
        </div>
      )}
      {visibleSections.map((section) => (
        <div key={section.id} className="mb-2">
          <h2
            className="font-bold uppercase tracking-wide mb-1"
            style={{ fontSize: "8px" }}
          >
            {section.title}
          </h2>
          <SectionContent section={section} />
        </div>
      ))}
    </div>
  );
}

const SWEDISH_ACCENT = "#4B6A8A";

function SwedishTemplate({
  content,
  name,
}: {
  content: ResumeContent;
  name?: string;
}) {
  const allSections = content.sections
    .filter((s) => s.visible)
    .sort((a, b) => a.order - b.order);

  const photoSection = allSections.find((s) => s.type === "photo");
  const photoUrl = photoSection
    ? (photoSection.content as PhotoSectionContent).url
    : null;

  const bodySections = allSections.filter(
    (s) => s.type !== "photo"
  );

  return (
    <div className="bg-white p-6 font-sans" style={{ minHeight: "100%" }}>
      {/* Header */}
      <div
        className="mb-5 pb-4"
        style={{ borderBottom: `2px solid ${SWEDISH_ACCENT}` }}
      >
        <div className="flex items-start gap-4">
          {photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt="Profile"
              className="rounded"
              style={{ width: 56, height: 70, objectFit: "cover", flexShrink: 0 }}
            />
          )}
          <div className="flex-1">
            {name && (
              <h1 className="text-base font-bold tracking-wide mb-0.5">{name}</h1>
            )}
          </div>
        </div>
      </div>

      {/* Body sections */}
      {bodySections.map((section) => (
        <div key={section.id} className="mb-3">
          <h2
            className="text-[9px] font-bold uppercase tracking-widest pb-0.5 mb-1.5"
            style={{ color: SWEDISH_ACCENT, borderBottom: `1px solid ${SWEDISH_ACCENT}` }}
          >
            {section.title}
          </h2>
          <SectionContent section={section} />
        </div>
      ))}
    </div>
  );
}

export function ResumePreview({ content, name, scale = 1 }: ResumePreviewProps) {
  const Template =
    content.template === "modern"
      ? ModernTemplate
      : content.template === "compact"
      ? CompactTemplate
      : content.template === "swedish"
      ? SwedishTemplate
      : CleanTemplate;

  return (
    <div
      className="overflow-hidden rounded border border-border shadow-sm bg-white"
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        width: `${100 / scale}%`,
      }}
    >
      <Template content={content} name={name} />
    </div>
  );
}
