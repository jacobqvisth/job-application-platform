import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
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
} from "@/lib/types/database";

// Use built-in PDF fonts only
Font.register({
  family: "Helvetica",
  fonts: [],
});

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Present";
  const [year, month] = dateStr.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[parseInt(month) - 1]} ${year}`;
}

// Clean Template Styles
const cleanStyles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1a1a",
  },
  header: {
    textAlign: "center",
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#cccccc",
  },
  name: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    borderBottomWidth: 0.5,
    borderBottomColor: "#cccccc",
    paddingBottom: 2,
    marginBottom: 5,
    color: "#333333",
  },
  summaryText: {
    fontSize: 9,
    lineHeight: 1.5,
    color: "#333333",
  },
  jobHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  jobTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  jobDate: {
    fontSize: 8,
    color: "#555555",
  },
  jobCompany: {
    fontSize: 9,
    color: "#555555",
  },
  bullet: {
    flexDirection: "row",
    marginTop: 2,
  },
  bulletDot: {
    fontSize: 8,
    marginRight: 4,
    marginTop: 1,
  },
  bulletText: {
    fontSize: 8,
    flex: 1,
    lineHeight: 1.4,
  },
  experienceItem: {
    marginBottom: 8,
  },
  skillRow: {
    flexDirection: "row",
    marginBottom: 2,
    flexWrap: "wrap",
  },
  skillCategoryName: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    marginRight: 4,
  },
  skillList: {
    fontSize: 8,
    color: "#444444",
    flex: 1,
  },
  certItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  certName: { fontSize: 8 },
  certDate: { fontSize: 8, color: "#555555" },
  langRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  langItem: { fontSize: 8 },
});

function CleanSectionContent({ section }: { section: ResumeSection }) {
  switch (section.type) {
    case "summary": {
      const c = section.content as SummarySectionContent;
      return <Text style={cleanStyles.summaryText}>{c.text}</Text>;
    }
    case "experience": {
      const c = section.content as ExperienceSectionContent;
      return (
        <View>
          {c.items.map((item) => (
            <View key={item.id} style={cleanStyles.experienceItem}>
              <View style={cleanStyles.jobHeader}>
                <Text style={cleanStyles.jobTitle}>{item.title}</Text>
                <Text style={cleanStyles.jobDate}>
                  {formatDate(item.startDate)} – {formatDate(item.endDate)}
                </Text>
              </View>
              <Text style={cleanStyles.jobCompany}>
                {item.company}{item.location ? ` · ${item.location}` : ""}
              </Text>
              {item.bullets.filter(Boolean).map((bullet, i) => (
                <View key={i} style={cleanStyles.bullet}>
                  <Text style={cleanStyles.bulletDot}>•</Text>
                  <Text style={cleanStyles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      );
    }
    case "education": {
      const c = section.content as EducationSectionContent;
      return (
        <View>
          {c.items.map((item) => (
            <View key={item.id} style={cleanStyles.experienceItem}>
              <View style={cleanStyles.jobHeader}>
                <Text style={cleanStyles.jobTitle}>{item.institution}</Text>
                <Text style={cleanStyles.jobDate}>
                  {formatDate(item.startDate)} – {formatDate(item.endDate)}
                </Text>
              </View>
              <Text style={cleanStyles.jobCompany}>
                {item.degree}{item.field ? `, ${item.field}` : ""}
                {item.gpa ? ` · GPA: ${item.gpa}` : ""}
              </Text>
            </View>
          ))}
        </View>
      );
    }
    case "skills": {
      const c = section.content as SkillsSectionContent;
      return (
        <View>
          {c.categories.filter((cat) => cat.skills.length > 0).map((cat) => (
            <View key={cat.id} style={cleanStyles.skillRow}>
              <Text style={cleanStyles.skillCategoryName}>{cat.name}:</Text>
              <Text style={cleanStyles.skillList}>{cat.skills.join(", ")}</Text>
            </View>
          ))}
        </View>
      );
    }
    case "certifications": {
      const c = section.content as CertificationsSectionContent;
      return (
        <View>
          {c.items.map((item) => (
            <View key={item.id} style={cleanStyles.certItem}>
              <Text style={cleanStyles.certName}>{item.name} · {item.issuer}</Text>
              <Text style={cleanStyles.certDate}>{formatDate(item.date)}</Text>
            </View>
          ))}
        </View>
      );
    }
    case "languages": {
      const c = section.content as LanguagesSectionContent;
      return (
        <View style={cleanStyles.langRow}>
          {c.items.map((item) => (
            <Text key={item.id} style={cleanStyles.langItem}>
              {item.language} ({item.proficiency})
            </Text>
          ))}
        </View>
      );
    }
    case "custom": {
      const c = section.content as CustomSectionContent;
      return <Text style={cleanStyles.summaryText}>{c.text}</Text>;
    }
    default:
      return null;
  }
}

function CleanResume({ content, name }: { content: ResumeContent; name: string }) {
  const visibleSections = content.sections
    .filter((s) => s.visible)
    .sort((a, b) => a.order - b.order);

  return (
    <Page size="A4" style={cleanStyles.page}>
      <View style={cleanStyles.header}>
        <Text style={cleanStyles.name}>{name}</Text>
      </View>
      {visibleSections.map((section) => (
        <View key={section.id} style={cleanStyles.section}>
          <Text style={cleanStyles.sectionTitle}>{section.title}</Text>
          <CleanSectionContent section={section} />
        </View>
      ))}
    </Page>
  );
}

// Modern Template
const modernStyles = StyleSheet.create({
  page: {
    flexDirection: "row",
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1a1a1a",
  },
  sidebar: {
    width: "30%",
    backgroundColor: "#27272a",
    color: "#ffffff",
    padding: 20,
  },
  sidebarName: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    marginBottom: 16,
    lineHeight: 1.3,
  },
  sidebarSection: {
    marginBottom: 12,
  },
  sidebarSectionTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: "#a1a1aa",
    marginBottom: 4,
  },
  sidebarText: {
    fontSize: 8,
    color: "#e4e4e7",
    lineHeight: 1.4,
  },
  main: {
    flex: 1,
    padding: 20,
  },
  mainSection: {
    marginBottom: 10,
  },
  mainSectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#3f3f46",
    borderBottomWidth: 1.5,
    borderBottomColor: "#e4e4e7",
    paddingBottom: 2,
    marginBottom: 5,
  },
  jobHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  jobTitle: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  jobDate: { fontSize: 7, color: "#71717a" },
  jobCompany: { fontSize: 8, color: "#52525b" },
  bullet: { flexDirection: "row", marginTop: 1.5 },
  bulletDot: { fontSize: 7, marginRight: 3 },
  bulletText: { fontSize: 7.5, flex: 1, lineHeight: 1.4 },
  experienceItem: { marginBottom: 7 },
  skillRow: { flexDirection: "row", marginBottom: 2, flexWrap: "wrap" },
  skillBold: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#d4d4d8", marginRight: 3 },
  skillText: { fontSize: 7.5, color: "#a1a1aa" },
});

function ModernSidebarSection({ section }: { section: ResumeSection }) {
  switch (section.type) {
    case "skills": {
      const c = section.content as SkillsSectionContent;
      return (
        <View>
          {c.categories.filter((cat) => cat.skills.length > 0).map((cat) => (
            <View key={cat.id} style={modernStyles.skillRow}>
              <Text style={modernStyles.skillBold}>{cat.name}: </Text>
              <Text style={modernStyles.skillText}>{cat.skills.join(", ")}</Text>
            </View>
          ))}
        </View>
      );
    }
    case "languages": {
      const c = section.content as LanguagesSectionContent;
      return (
        <View>
          {c.items.map((item) => (
            <Text key={item.id} style={modernStyles.sidebarText}>
              {item.language} ({item.proficiency})
            </Text>
          ))}
        </View>
      );
    }
    case "certifications": {
      const c = section.content as CertificationsSectionContent;
      return (
        <View>
          {c.items.map((item) => (
            <View key={item.id} style={{ marginBottom: 4 }}>
              <Text style={modernStyles.sidebarText}>{item.name}</Text>
              <Text style={{ ...modernStyles.sidebarText, color: "#a1a1aa", fontSize: 7 }}>
                {item.issuer} · {formatDate(item.date)}
              </Text>
            </View>
          ))}
        </View>
      );
    }
    default:
      return null;
  }
}

function ModernResume({ content, name }: { content: ResumeContent; name: string }) {
  const visibleSections = content.sections
    .filter((s) => s.visible)
    .sort((a, b) => a.order - b.order);

  const sidebarTypes = ["skills", "languages", "certifications"];
  const sidebarSections = visibleSections.filter((s) => sidebarTypes.includes(s.type));
  const mainSections = visibleSections.filter((s) => !sidebarTypes.includes(s.type));

  return (
    <Page size="A4" style={modernStyles.page}>
      <View style={modernStyles.sidebar}>
        <Text style={modernStyles.sidebarName}>{name}</Text>
        {sidebarSections.map((section) => (
          <View key={section.id} style={modernStyles.sidebarSection}>
            <Text style={modernStyles.sidebarSectionTitle}>{section.title}</Text>
            <ModernSidebarSection section={section} />
          </View>
        ))}
      </View>
      <View style={modernStyles.main}>
        {mainSections.map((section) => (
          <View key={section.id} style={modernStyles.mainSection}>
            <Text style={modernStyles.mainSectionTitle}>{section.title}</Text>
            <CleanSectionContent section={section} />
          </View>
        ))}
      </View>
    </Page>
  );
}

// Compact Template (reuses clean but tighter spacing)
const compactStyles = StyleSheet.create({
  page: {
    padding: 24,
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: "#1a1a1a",
  },
  header: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#1a1a1a",
    paddingBottom: 4,
    marginBottom: 8,
  },
  name: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
  },
  section: {
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 3,
  },
  experienceItem: { marginBottom: 5 },
  jobHeader: { flexDirection: "row", justifyContent: "space-between" },
  jobTitle: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  jobDate: { fontSize: 7.5, color: "#555555" },
  jobCompany: { fontSize: 8, color: "#555555" },
  bullet: { flexDirection: "row", marginTop: 1 },
  bulletDot: { fontSize: 7, marginRight: 3 },
  bulletText: { fontSize: 7.5, flex: 1, lineHeight: 1.3 },
  skillRow: { flexDirection: "row", marginBottom: 1.5, flexWrap: "wrap" },
  skillBold: { fontSize: 8, fontFamily: "Helvetica-Bold", marginRight: 3 },
  skillText: { fontSize: 8, color: "#333333" },
  summaryText: { fontSize: 8, lineHeight: 1.4 },
  certItem: { flexDirection: "row", justifyContent: "space-between", marginBottom: 1.5 },
  certName: { fontSize: 8 },
  certDate: { fontSize: 7.5, color: "#555555" },
  langRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  langItem: { fontSize: 8 },
});

function CompactSectionContent({ section }: { section: ResumeSection }) {
  switch (section.type) {
    case "summary": {
      const c = section.content as SummarySectionContent;
      return <Text style={compactStyles.summaryText}>{c.text}</Text>;
    }
    case "experience": {
      const c = section.content as ExperienceSectionContent;
      return (
        <View>
          {c.items.map((item) => (
            <View key={item.id} style={compactStyles.experienceItem}>
              <View style={compactStyles.jobHeader}>
                <Text style={compactStyles.jobTitle}>{item.title}</Text>
                <Text style={compactStyles.jobDate}>
                  {formatDate(item.startDate)} – {formatDate(item.endDate)}
                </Text>
              </View>
              <Text style={compactStyles.jobCompany}>
                {item.company}{item.location ? ` · ${item.location}` : ""}
              </Text>
              {item.bullets.filter(Boolean).map((bullet, i) => (
                <View key={i} style={compactStyles.bullet}>
                  <Text style={compactStyles.bulletDot}>•</Text>
                  <Text style={compactStyles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      );
    }
    case "education": {
      const c = section.content as EducationSectionContent;
      return (
        <View>
          {c.items.map((item) => (
            <View key={item.id} style={compactStyles.experienceItem}>
              <View style={compactStyles.jobHeader}>
                <Text style={compactStyles.jobTitle}>{item.institution}</Text>
                <Text style={compactStyles.jobDate}>
                  {formatDate(item.startDate)} – {formatDate(item.endDate)}
                </Text>
              </View>
              <Text style={compactStyles.jobCompany}>
                {item.degree}{item.field ? `, ${item.field}` : ""}
                {item.gpa ? ` · GPA: ${item.gpa}` : ""}
              </Text>
            </View>
          ))}
        </View>
      );
    }
    case "skills": {
      const c = section.content as SkillsSectionContent;
      return (
        <View>
          {c.categories.filter((cat) => cat.skills.length > 0).map((cat) => (
            <View key={cat.id} style={compactStyles.skillRow}>
              <Text style={compactStyles.skillBold}>{cat.name}:</Text>
              <Text style={compactStyles.skillText}> {cat.skills.join(", ")}</Text>
            </View>
          ))}
        </View>
      );
    }
    case "certifications": {
      const c = section.content as CertificationsSectionContent;
      return (
        <View>
          {c.items.map((item) => (
            <View key={item.id} style={compactStyles.certItem}>
              <Text style={compactStyles.certName}>{item.name} · {item.issuer}</Text>
              <Text style={compactStyles.certDate}>{formatDate(item.date)}</Text>
            </View>
          ))}
        </View>
      );
    }
    case "languages": {
      const c = section.content as LanguagesSectionContent;
      return (
        <View style={compactStyles.langRow}>
          {c.items.map((item) => (
            <Text key={item.id} style={compactStyles.langItem}>
              {item.language} ({item.proficiency})
            </Text>
          ))}
        </View>
      );
    }
    case "custom": {
      const c = section.content as CustomSectionContent;
      return <Text style={compactStyles.summaryText}>{c.text}</Text>;
    }
    default:
      return null;
  }
}

function CompactResume({ content, name }: { content: ResumeContent; name: string }) {
  const visibleSections = content.sections
    .filter((s) => s.visible)
    .sort((a, b) => a.order - b.order);

  return (
    <Page size="A4" style={compactStyles.page}>
      <View style={compactStyles.header}>
        <Text style={compactStyles.name}>{name}</Text>
      </View>
      {visibleSections.map((section) => (
        <View key={section.id} style={compactStyles.section}>
          <Text style={compactStyles.sectionTitle}>{section.title}</Text>
          <CompactSectionContent section={section} />
        </View>
      ))}
    </Page>
  );
}

export function ResumePDF({
  content,
  name,
}: {
  content: ResumeContent;
  name: string;
}) {
  const ResumeTemplate =
    content.template === "modern"
      ? ModernResume
      : content.template === "compact"
      ? CompactResume
      : CleanResume;

  return (
    <Document>
      <ResumeTemplate content={content} name={name} />
    </Document>
  );
}
