import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import {
  type ResumeDocument, type SectionKey, type TemplateId, templateMeta,
} from '../types';

/**
 * AETHER Resume Builder — PDF documents (spec §18–§23).
 *
 * Every template is single column, text-only and ATS-safe: no images, no icons,
 * no progress bars, no skill stars, no layout tables. The exported PDF therefore
 * contains real selectable/extractable text that AETHER's own resume analyzer can
 * parse back (spec §24, §69).
 *
 * Page breaks: entries use `wrap={false}` so an experience/project block is never
 * cut in half, and headings use `minPresenceAhead` so a heading never dangles at
 * the bottom of a page.
 */

interface SectionRenderProps {
  doc: ResumeDocument;
  base: number;
  heading: ReturnType<typeof headingFactory>;
  body: number;
  muted: string;
  accent: string;
}

function headingFactory(styles: any) {
  return (label: string, variant: 'ats' | 'minimal' | 'accent' | 'technical' = 'ats') => {
    const style = variant === 'minimal' ? styles.hMinimal
      : variant === 'accent' ? styles.hAccent
      : variant === 'technical' ? styles.hTechnical
      : styles.hAts;
    return (
      <Text style={style} minPresenceAhead={30}>{label.toUpperCase()}</Text>
    );
  };
}

/** Which sections actually have content, in the candidate's chosen order. */
function activeSections(doc: ResumeDocument, template: TemplateId): SectionKey[] {
  const defaultOrder = templateMeta(template).defaultOrder;
  const stored = (doc.sectionOrder || []).filter(k => defaultOrder.includes(k));
  const order = stored.length ? [...stored, ...defaultOrder.filter(k => !stored.includes(k))] : defaultOrder;

  const has: Record<SectionKey, boolean> = {
    summary: !!doc.summary?.trim(),
    experience: (doc.experience || []).some(e => e.title || e.company || (e.bullets || []).some(Boolean)),
    projects: (doc.projects || []).some(p => p.name || (p.bullets || []).some(Boolean)),
    education: (doc.education || []).some(e => e.degree || e.institution),
    skills: (doc.skills || []).length > 0,
    certifications: (doc.certifications || []).length > 0,
    achievements: (doc.achievements || []).length > 0,
    languages: (doc.languages || []).length > 0,
    custom: (doc.customSections || []).some(s => s.title || (s.items || []).length),
  };

  return order.filter(k => has[k]);
}

function contactParts(doc: ResumeDocument): string[] {
  return [doc.email, doc.phone, doc.location, ...(doc.links || [])].filter(Boolean) as string[];
}

function bulletLines(doc: ResumeDocument, items: string[]): string[] {
  return items.map(i => String(i || '').trim()).filter(Boolean);
}

function stylesFor(doc: ResumeDocument) {
  const t = doc.typography || { fontFamily: 'Helvetica', fontSize: 9.5, lineHeight: 1.35, margin: 40 };
  const base = t.fontSize;
  const lh = t.lineHeight;
  return StyleSheet.create({
    page: {
      fontFamily: t.fontFamily || 'Helvetica',
      fontSize: base,
      lineHeight: lh,
      paddingTop: t.margin,
      paddingBottom: t.margin,
      paddingHorizontal: t.margin,
      color: '#111827',
    },
    // NOTE: no letterSpacing anywhere in these templates. PDF letter-spacing is
    // written as per-character offsets, which makes text extractors read
    // "EDUCATION" as "E D U C AT I O N" and breaks ATS keyword matching.
    name: { fontSize: base + 7, fontWeight: 'bold', textAlign: 'center' },
    nameLeft: { fontSize: base + 7, fontWeight: 'bold' },
    headline: { fontSize: base + 1, textAlign: 'center', marginTop: 3, color: '#374151' },
    headlineLeft: { fontSize: base + 1, marginTop: 3, color: '#374151' },
    contact: { fontSize: base - 0.5, textAlign: 'center', marginTop: 4, color: '#374151' },
    contactLeft: { fontSize: base - 0.5, marginTop: 4, color: '#374151', textAlign: 'right' },
    contactRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },

    hAts: {
      fontSize: base + 0.5, fontWeight: 'bold', marginTop: base + 3,
      marginBottom: 3, color: '#111827', borderBottomWidth: 0.75, borderBottomColor: '#9ca3af',
      paddingBottom: 1.5,
    },
    hMinimal: {
      fontSize: base - 0.5, fontWeight: 'bold', marginTop: base + 5,
      marginBottom: 3, color: '#111827',
    },
    hAccent: {
      fontSize: base + 0.5, fontWeight: 'bold', marginTop: base + 3,
      marginBottom: 3, color: '#1e3a8a', borderBottomWidth: 1, borderBottomColor: '#1e3a8a',
      paddingBottom: 1.5,
    },
    hTechnical: {
      fontSize: base + 0.5, fontWeight: 'bold', marginTop: base + 3,
      marginBottom: 3, color: '#111827', borderBottomWidth: 0.5, borderBottomColor: '#d1d5db',
      paddingBottom: 1.5,
    },

    entry: { marginBottom: 5 },
    entryHead: { flexDirection: 'row', justifyContent: 'space-between' },
    entryTitle: { fontWeight: 'bold', fontSize: base },
    entryMeta: { fontSize: base - 0.5, color: '#4b5563' },
    entryDates: { fontSize: base - 0.5, color: '#4b5563' },
    bulletRow: { flexDirection: 'row', marginLeft: 6, marginTop: 1 },
    bulletMark: { width: 7, fontSize: base },
    bulletText: { flex: 1, fontSize: base },
    paragraph: { fontSize: base, marginTop: 1 },
    lineRow: { flexDirection: 'row', marginTop: 1 },
    kvLabel: { width: 62, fontWeight: 'bold', fontSize: base },
    kvValue: { flex: 1, fontSize: base },
  });
}

// ── Shared section renderers ────────────────────────────────────────────────

function SummaryBlock({ doc, s }: { doc: ResumeDocument; s: any }) {
  return <Text style={s.paragraph}>{doc.summary}</Text>;
}

function ExperienceBlock({ doc, s, variant }: { doc: ResumeDocument; s: any; variant: ReuseVariant }) {
  return (
    <>
      {(doc.experience || []).map((e, i) => (
        <View key={i} style={s.entry} wrap={false}>
          <View style={s.entryHead}>
            <Text style={s.entryTitle}>
              {[e.title, e.company].filter(Boolean).join(variant === 'technical' ? ' | ' : ' — ')}
            </Text>
            <Text style={s.entryDates}>
              {[e.duration || [e.startDate, e.endDate].filter(Boolean).join(' – '), e.location].filter(Boolean).join(' · ')}
            </Text>
          </View>
          {e.description ? <Text style={s.entryMeta}>{e.description}</Text> : null}
          {bulletLines(doc, e.bullets || []).map((b, j) => (
            <View key={j} style={s.bulletRow}>
              <Text style={s.bulletMark}>•</Text>
              <Text style={s.bulletText}>{b}</Text>
            </View>
          ))}
        </View>
      ))}
    </>
  );
}

function ProjectsBlock({ doc, s, variant }: { doc: ResumeDocument; s: any; variant: ReuseVariant }) {
  const separator = variant === 'technical' ? ' | ' : ' — ';
  return (
    <>
      {(doc.projects || []).map((p, i) => (
        <View key={i} style={s.entry} wrap={false}>
          <View style={s.entryHead}>
            <Text style={s.entryTitle}>
              {[p.name, p.link].filter(Boolean).join(separator)}
            </Text>
            {p.technologies?.length ? <Text style={s.entryDates}>{p.technologies.join(' · ')}</Text> : null}
          </View>
          {p.description ? <Text style={s.entryMeta}>{p.description}</Text> : null}
          {bulletLines(doc, p.bullets || []).map((b, j) => (
            <View key={j} style={s.bulletRow}>
              <Text style={s.bulletMark}>•</Text>
              <Text style={s.bulletText}>{b}</Text>
            </View>
          ))}
        </View>
      ))}
    </>
  );
}

function EducationBlock({ doc, s }: { doc: ResumeDocument; s: any }) {
  return (
    <>
      {(doc.education || []).map((e, i) => (
        <View key={i} style={s.entry} wrap={false}>
          <View style={s.entryHead}>
            <Text style={s.entryTitle}>{[e.degree, e.institution].filter(Boolean).join(' — ')}</Text>
            <Text style={s.entryDates}>{[e.year, e.score, e.location].filter(Boolean).join(' · ')}</Text>
          </View>
        </View>
      ))}
    </>
  );
}

function SkillsBlock({ doc, s, variant }: { doc: ResumeDocument; s: any; variant: ReuseVariant }) {
  const skills = (doc.skills || []).filter(Boolean);
  if (variant === 'technical') {
    // Two short lines read naturally in extraction order — still plain text.
    return (
      <>
        <View style={s.lineRow}>
          <Text style={s.kvLabel}>Core</Text>
          <Text style={s.kvValue}>{skills.join(', ')}</Text>
        </View>
      </>
    );
  }
  return <Text style={s.paragraph}>{skills.join('  •  ')}</Text>;
}

function ListBlock({ items, s }: { items: string[]; s: any }) {
  return (
    <>
      {items.filter(Boolean).map((item, i) => (
        <View key={i} style={s.bulletRow}>
          <Text style={s.bulletMark}>•</Text>
          <Text style={s.bulletText}>{item}</Text>
        </View>
      ))}
    </>
  );
}

function LanguagesBlock({ doc, s }: { doc: ResumeDocument; s: any }) {
  return (
    <Text style={s.paragraph}>
      {(doc.languages || []).filter(l => l.name).map(l => `${l.name}${l.level ? ` (${l.level})` : ''}`).join('  •  ')}
    </Text>
  );
}

type ReuseVariant = 'classic' | 'technical' | 'minimal' | 'modern';

function renderSection(key: SectionKey, doc: ResumeDocument, s: any, variant: ReuseVariant, headingStyle: 'ats' | 'minimal' | 'accent' | 'technical') {
  const heading = headingFactory(s);
  const title = key === 'custom' ? null : SECTION_TITLES[key];
  const node = (() => {
    switch (key) {
      case 'summary': return <SummaryBlock doc={doc} s={s} />;
      case 'experience': return <ExperienceBlock doc={doc} s={s} variant={variant} />;
      case 'projects': return <ProjectsBlock doc={doc} s={s} variant={variant} />;
      case 'education': return <EducationBlock doc={doc} s={s} />;
      case 'skills': return <SkillsBlock doc={doc} s={s} variant={variant} />;
      case 'certifications': return <ListBlock items={(doc.certifications || []).filter(Boolean)} s={s} />;
      case 'achievements': return <ListBlock items={(doc.achievements || []).filter(Boolean)} s={s} />;
      case 'languages': return <LanguagesBlock doc={doc} s={s} />;
      case 'custom': return (
        <>
          {(doc.customSections || []).filter(cs => cs.title || (cs.items || []).length).map((cs, i) => (
            <View key={i} style={s.entry} wrap={false}>
              <Text style={s.entryTitle}>{cs.title}</Text>
              <ListBlock items={cs.items || []} s={s} />
            </View>
          ))}
        </>
      );
      default: return null;
    }
  })();

  if (key === 'custom') {
    // custom sections carry their own titles
    return (
      <View key={key}>
        {(doc.customSections || []).filter(cs => cs.title || (cs.items || []).length).map((cs, i) => (
          <View key={i} wrap={false}>
            {heading(cs.title || 'Additional', headingStyle)}
            <ListBlock items={cs.items || []} s={s} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View key={key}>
      {heading(title || '', headingStyle)}
      {node}
    </View>
  );
}

const SECTION_TITLES: Record<SectionKey, string> = {
  summary: 'Professional Summary',
  experience: 'Experience',
  projects: 'Projects',
  education: 'Education',
  skills: 'Skills',
  certifications: 'Certifications',
  achievements: 'Achievements',
  languages: 'Languages',
  custom: 'Additional',
};

// ── Templates ───────────────────────────────────────────────────────────────

function AtsClassic({ doc }: { doc: ResumeDocument }) {
  const s = stylesFor(doc);
  return (
    <Page size={doc.pageSize || 'A4'} style={s.page}>
      <Header doc={doc} s={s} variant="classic" />
      {activeSections(doc, 'ats-classic').map(k => renderSection(k, doc, s, 'classic', 'ats'))}
    </Page>
  );
}

function MinimalProfessional({ doc }: { doc: ResumeDocument }) {
  const s = stylesFor(doc);
  return (
    <Page size={doc.pageSize || 'A4'} style={s.page}>
      <Header doc={doc} s={s} variant="minimal" />
      {activeSections(doc, 'minimal-professional').map(k => renderSection(k, doc, s, 'minimal', 'minimal'))}
    </Page>
  );
}

function TechnicalProfessional({ doc }: { doc: ResumeDocument }) {
  const s = stylesFor(doc);
  return (
    <Page size={doc.pageSize || 'A4'} style={s.page}>
      <Header doc={doc} s={s} variant="classic" />
      {activeSections(doc, 'technical-professional').map(k => renderSection(k, doc, s, 'technical', 'technical'))}
    </Page>
  );
}

function ModernProfessional({ doc }: { doc: ResumeDocument }) {
  const s = stylesFor(doc);
  return (
    <Page size={doc.pageSize || 'A4'} style={s.page}>
      <Header doc={doc} s={s} variant="modern" />
      {activeSections(doc, 'modern-professional').map(k => renderSection(k, doc, s, 'modern', 'accent'))}
    </Page>
  );
}

function GraduateFresher({ doc }: { doc: ResumeDocument }) {
  const s = stylesFor(doc);
  return (
    <Page size={doc.pageSize || 'A4'} style={s.page}>
      <Header doc={doc} s={s} variant="classic" />
      {activeSections(doc, 'graduate-fresher').map(k => renderSection(k, doc, s, 'classic', 'ats'))}
    </Page>
  );
}

function Header({ doc, s, variant }: { doc: ResumeDocument; s: any; variant: 'classic' | 'minimal' | 'modern' }) {
  const contacts = contactParts(doc);
  if (variant === 'modern') {
    // Left-aligned block, single column. A two-column header makes PDF text
    // extraction merge the title into the contact line ("Engineerhuzaifa@…"),
    // which breaks ATS email parsing — so the accent styling stays, the columns go.
    return (
      <View style={{ marginBottom: 5, borderBottomWidth: 1.5, borderBottomColor: '#1e3a8a', paddingBottom: 4 }}>
        <Text style={s.nameLeft}>{doc.name || 'Your Name'}</Text>
        {doc.title ? <Text style={s.headlineLeft}>{doc.title}</Text> : null}
        {contacts.length ? <Text style={s.headlineLeft}>{contacts.join('  •  ')}</Text> : null}
      </View>
    );
  }
  if (variant === 'minimal') {
    return (
      <View style={{ marginBottom: 6 }}>
        <Text style={s.nameLeft}>{doc.name || 'Your Name'}</Text>
        {doc.title ? <Text style={s.headlineLeft}>{doc.title}</Text> : null}
        {contacts.length ? <Text style={s.headlineLeft}>{contacts.join('   ')}</Text> : null}
      </View>
    );
  }
  return (
    <View style={{ marginBottom: 4, borderBottomWidth: variant === 'classic' ? 1 : 0, borderBottomColor: '#111827', paddingBottom: 5 }}>
      <Text style={s.name}>{doc.name || 'Your Name'}</Text>
      {doc.title ? <Text style={s.headline}>{doc.title}</Text> : null}
      {contacts.length ? <Text style={s.contact}>{contacts.join('  •  ')}</Text> : null}
    </View>
  );
}

const TEMPLATE_COMPONENTS: Record<TemplateId, React.ComponentType<{ doc: ResumeDocument }>> = {
  'ats-classic': AtsClassic,
  'graduate-fresher': GraduateFresher,
  'minimal-professional': MinimalProfessional,
  'technical-professional': TechnicalProfessional,
  'modern-professional': ModernProfessional,
};

/**
 * The PDF document for a resume. `template` selects the layout; unknown values
 * fall back to AETHER ATS Classic.
 */
export default function ResumePdf({ doc, template }: { doc: ResumeDocument; template: string }) {
  const Component = TEMPLATE_COMPONENTS[template as TemplateId] || AtsClassic;
  return (
    <Document
      title={`${doc.name || 'Resume'}${doc.title ? ` — ${doc.title}` : ''}`}
      author={doc.name || 'AETHER candidate'}
      subject="Resume"
      creator="AETHER Resume Builder"
      producer="AETHER (@react-pdf/renderer)"
    >
      <Component doc={doc} />
    </Document>
  );
}
