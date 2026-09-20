import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ActionButton,
  AsyncState,
  BackButton,
  Badge,
  CompactControl,
  DataTable,
  DisclosureSurface,
  DiscoveryAction,
  DiscoveryCard,
  FilterBar,
  MetadataGrid,
  ProgressBar,
  PrimaryBlock,
  SearchField,
  SecondaryBlock,
  SectionHeader,
  SegmentedControl,
  StatCard,
  Surface,
  Tabs,
  GlassChrome,
} from "../app/components/ui-primitives";

const meta = {
  title: "Foundations/Primitives",
  parameters: { docs: { description: { story: "Production primitives used by the Investment OS screens." } } },
} satisfies Meta<typeof Surface>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Surfaces: Story = {
  render: () => (
    <div className="storybook-stack">
      <Surface surface="primary"><strong>Primary surface</strong><p>Default grouped content.</p></Surface>
      <Surface surface="secondary"><strong>Secondary surface</strong><p>Supporting grouped content.</p></Surface>
      <Surface surface="glass"><strong>Glass chrome</strong><p>Reserved for navigation and floating chrome.</p></Surface>
      <PrimaryBlock><strong>Primary block wrapper</strong><p>Production wrapper for primary content.</p></PrimaryBlock>
      <SecondaryBlock><strong>Secondary block wrapper</strong><p>Production wrapper for nested content.</p></SecondaryBlock>
      <GlassChrome><strong>Glass chrome wrapper</strong><p>Production wrapper for floating chrome.</p></GlassChrome>
    </div>
  ),
};

export const Controls: Story = {
  render: function ControlsStory() {
    const [segment, setSegment] = useState("All");
    const [tab, setTab] = useState("Summary");
    const [query, setQuery] = useState("");
    return (
      <div className="storybook-stack">
        <SectionHeader eyebrow="Reference" title="Controls" description="Shared interaction primitives." />
        <SearchField value={query} onChange={setQuery} placeholder="Search" ariaLabel="Search" count="3 results" />
        <FilterBar ariaLabel="Filter examples"><SegmentedControl options={["All", "Owned", "Watchlist"].map((value) => ({ value, label: value }))} value={segment} onChange={setSegment} ariaLabel="Filter" /></FilterBar>
        <Tabs options={["Summary", "Portfolio", "Research"].map((value) => ({ value, label: value }))} value={tab} onChange={setTab} ariaLabel="Sections" />
        <div className="storybook-inline"><ActionButton onClick={() => undefined}>Primary action</ActionButton><ActionButton compact onClick={() => undefined}>Compact action</ActionButton><BackButton onBack={() => undefined} /><Badge tone="positive">Positive</Badge><Badge tone="warning">Warning</Badge><Badge tone="negative">Negative</Badge></div>
      </div>
    );
  },
};


export const ReferencePage: Story = {
  render: function ReferencePageStory() {
    const [account, setAccount] = useState("Toutes");
    const [sort, setSort] = useState("Poids");
    const [segment, setSegment] = useState("Default");
    const [query, setQuery] = useState("");

    return (
      <div className="storybook-stack">
        <SectionHeader eyebrow="Investment OS" title="UI Reference" description="Production components only. Storybook is the executable design-system reference; Lovable mirrors these contracts for visual validation." />

        <div className="storybook-stack">
          <p className="eyebrow">Surfaces</p>
          <Surface surface="primary"><strong>Primary content</strong><p>Top-level content, search, KPI and discovery cards.</p></Surface>
          <Surface surface="secondary"><strong>Secondary inset</strong><p>Supporting information nested inside a content surface.</p></Surface>
          <Surface surface="glass"><strong>Glass chrome</strong><p>Navigation and floating chrome only.</p></Surface>
        </div>

        <div className="storybook-stack">
          <p className="eyebrow">Compact controls</p>
          <div className="storybook-inline">
            <CompactControl variant="select" ariaLabel="Enveloppe" value={account} onChange={setAccount} options={[{ value: "Toutes", label: "Toutes" }, { value: "CTO", label: "CTO" }, { value: "PEA", label: "PEA" }]} />
            <CompactControl variant="select" ariaLabel="Tri" value={sort} onChange={setSort} options={[{ value: "Poids", label: "Poids" }, { value: "Montant", label: "Montant" }]} />
            <CompactControl variant="icon" ariaLabel="Sens du tri" onClick={() => undefined}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10m0 0 3-3m-3 3-3-3" /></svg>
            </CompactControl>
          </div>
          <FilterBar ariaLabel="Reference filters"><SegmentedControl contained options={["Default", "Active"].map((value) => ({ value, label: value }))} value={segment} onChange={setSegment} ariaLabel="Reference segmented control" /></FilterBar>
        </div>

        <div className="storybook-stack">
          <p className="eyebrow">Search</p>
          <SearchField value={query} onChange={setQuery} placeholder="Rechercher une société, un ticker ou une analyse…" ariaLabel="Reference search" count="52/52 éléments" />
        </div>

        <div className="storybook-stack">
          <p className="eyebrow">Discovery cards</p>
          <DiscoveryCard kind="company">
            <strong>Example Corp</strong>
            <p>EXM · Software · Technology</p>
            <Badge tone="positive">Owned</Badge>
          </DiscoveryCard>
          <DiscoveryCard kind="watchlist">
            <div className="storybook-discovery-head"><div><strong>AMD</strong><Badge>Monitoring</Badge><p>AMD</p></div><DiscoveryAction ariaLabel="Open AMD" onClick={() => undefined}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 11.5 11.5 4.5M6 4.5h5.5V10" /></svg></DiscoveryAction></div>
            <p>Radar content keeps its signals, themes and thesis inside the same shell.</p>
            <div className="storybook-inline"><Badge>Monitoring</Badge><Badge>AI</Badge><Badge>Semiconductors</Badge></div>
          </DiscoveryCard>
          <DiscoveryCard kind="analysis">
            <strong>Example Corp — Valuation Check</strong>
            <p>Analysis cards share the same outer surface while keeping their own information hierarchy.</p>
            <Badge tone="positive">Current</Badge>
          </DiscoveryCard>
        </div>

        <div className="storybook-stack">
          <p className="eyebrow">Data display</p>
          <div className="storybook-grid">
            <StatCard label="Analyses" value="166" detail="Business · Valuation · Short · Mémo" />
            <StatCard label="Coverage" value="5/5" detail="Current references" />
          </div>
        </div>
      </div>
    );
  },
};

export const DataDisplay: Story = {
  render: () => (
    <div className="storybook-stack">
      <div className="storybook-grid">
        <StatCard label="Business score" value={82} detail="Strong operating quality" />
        <StatCard label="Coverage" value="4/5" detail="Current references" />
        <div className="storybook-card"><p className="eyebrow">Allocation</p><ProgressBar value={62} label="Allocation 62 percent" /><span className="storybook-caption">62%</span></div>
      </div>
      <MetadataGrid ariaLabel="Reference metadata" items={[{ label: "Sector", value: "Technology" }, { label: "Status", value: "Owned" }, { label: "Updated", value: "Today" }]} />
      <DataTable ariaLabel="Reference table" columns={[{ key: "name", label: "Name", render: (row) => row.name }, { key: "status", label: "Status", render: (row) => <Badge>{row.status}</Badge> }]} rows={[{ id: "a", name: "Example Corp", status: "Current" }]} getRowKey={(row) => row.id} />
    </div>
  ),
};

export const ContentStates: Story = {
  render: () => (
    <div className="storybook-stack">
      <DiscoveryCard as="article" kind="company"><h3>Discovery card</h3><p>Shared content container for companies and watchlist items.</p></DiscoveryCard>
      <DisclosureSurface level="primary" summary="Traceability"><p>Expandable secondary content stays inside the same surface hierarchy.</p></DisclosureSurface>
      <AsyncState title="No data in this state" description="The production empty and error presentation remains explicit." />
    </div>
  ),
};
