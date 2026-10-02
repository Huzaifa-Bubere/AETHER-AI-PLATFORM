import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DashboardSummary } from '../../services/dashboard';
import { ChartFrame } from './DashboardWidgets';

/**
 * Dashboard charts (spec §12).
 *
 * Tremor-style hierarchy built on the existing Recharts dependency — no new
 * charting library was added. Every chart renders from the summary payload and
 * shows an explicit empty state when there is no data, so an axis is never
 * drawn from fabricated points.
 */

const CATEGORY_LABELS: Record<string, string> = {
  PROGRAMMING_LANGUAGES: 'Languages',
  FRAMEWORKS_LIBRARIES: 'Frameworks',
  DATABASES: 'Databases',
  CS_FUNDAMENTALS: 'CS Fundamentals',
  APIs: 'APIs',
  CLOUD: 'Cloud',
  DEVOPS: 'DevOps',
  TESTING: 'Testing',
  TOOLS: 'Tools',
  SYSTEM_DESIGN: 'System Design',
  DATA_AI: 'Data / AI',
  PROFESSIONAL_SKILLS: 'Professional Skills',
};

const axisStyle = { fontSize: 11, fill: 'var(--muted-foreground)' };
const tooltipStyle = {
  fontSize: 12,
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--card-foreground)',
};

/** Assessment score over actual completed attempts. */
export function AssessmentOverTimeChart({ data }: { data: DashboardSummary['charts']['assessmentOverTime'] }) {
  const rows = data.map(d => ({ date: d.date.slice(5), score: d.score }));
  return (
    <ChartFrame title="Assessment Performance" subtitle="Score over each completed attempt" hasData={rows.length > 0}>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} domain={[0, 100]} width={32} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** Technical accuracy by category, from real question-level results. */
export function TechnicalByCategoryChart({
  data,
}: {
  data: DashboardSummary['charts']['technicalByCategory'];
}) {
  const rows = data.map(d => ({ category: d.category, accuracy: d.accuracy, attempted: d.attempted }));
  return (
    <ChartFrame title="Technical Topics" subtitle="Accuracy by category" hasData={rows.length > 0}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="category" tick={axisStyle} tickLine={false} axisLine={false} width={110} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number, _name, item) => [`${value}%`, `${(item?.payload as any)?.attempted ?? 0} answered`]}
          />
          <Bar dataKey="accuracy" radius={[0, 4, 4, 0]}>
            {rows.map((row, i) => (
              <Cell key={i} fill="var(--primary)" fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/**
 * Interview performance, split per role (spec §79).
 * Roles are never merged into a single meaningless line.
 */
export function InterviewByRoleChart({
  data,
}: {
  data: DashboardSummary['charts']['interviewByRole'];
}) {
  const entries = Object.entries(data).filter(([, points]) => points.length > 0);
  if (entries.length === 0) {
    return (
      <ChartFrame title="Interview Performance" subtitle="Over time, by role" hasData={false} />
    );
  }

  return (
    <div className="space-y-4">
      {entries.map(([roleSlug, points]) => (
        <ChartFrame
          key={roleSlug}
          title={`Interviews · ${roleSlug.replace(/-/g, ' ')}`}
          subtitle={`${points.length} completed`}
          hasData
        >
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={points.map((p, i) => ({ i: i + 1, score: p.score }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="i" tick={axisStyle} tickLine={false} axisLine={false} />
              <YAxis tick={axisStyle} tickLine={false} axisLine={false} domain={[0, 100]} width={32} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={label => `Interview ${label}`}
                formatter={(value: number) => [`${value}`, 'Score']}
              />
              <Line type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartFrame>
      ))}
    </div>
  );
}

/** ATS quality score across saved resume versions. */
export function AtsOverTimeChart({ data }: { data: DashboardSummary['charts']['atsOverTime'] }) {
  const rows = data.filter(d => typeof d.score === 'number');
  return (
    <ChartFrame title="Resume Quality" subtitle="ATS score over saved versions" hasData={rows.length > 0}>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={rows.map((d, i) => ({ i: i + 1, score: d.score as number, label: d.label }))}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            interval={0}
            height={40}
            angle={-20}
            textAnchor="end"
          />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} domain={[0, 100]} width={32} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value}/100`, 'ATS']} />
          <Line type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/**
 * Skill category coverage for the selected role.
 * A category with no assessment shows as unmeasured, not as an empty bar.
 */
export function SkillCoverageChart({
  data,
}: {
  data: DashboardSummary['charts']['skillCategoryCoverage'];
}) {
  const rows = data.map(d => ({
    category: CATEGORY_LABELS[d.category] ?? d.category,
    coverage: d.coverage,
  }));
  const hasData = rows.some(r => r.coverage !== null);
  return (
    <ChartFrame title="Skill Category Coverage" subtitle="Requirement coverage for this role" hasData={hasData}>
      <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 32)}>
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="category" tick={axisStyle} tickLine={false} axisLine={false} width={130} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number | undefined) =>
              value === undefined || value === null ? ['Not assessed'] : [`${value}%`, 'Coverage']
            }
          />
          <Bar dataKey="coverage" radius={[0, 4, 4, 0]}>
            {rows.map((row, i) => (
              <Cell key={i} fill="var(--primary)" fillOpacity={row.coverage === null ? 0.15 : 0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}