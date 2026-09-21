import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ActionButton,
  AsyncState,
  BackButton,
  Badge,
  CompactControl,
  DataTable,
  DiscoveryAction,
  DiscoveryCard,
  FilterBar,
  GlassChrome,
  MetadataGrid,
  PrimaryBlock,
  ProgressBar,
  SearchField,
  SectionHeader,
  SecondaryBlock,
  SegmentedControl,
  StatCard,
  Surface,
  Tabs,
} from "../app/components/ui-primitives";

const meta = {
  title: "Design System",
  parameters: {
    layout: "fullscreen",
    docs: { description: { story: "Reference page for production primitives. Lovable is the visible visual specification; Storybook verifies this executable contract." } },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const arrow = <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 11.5 11.5 4.5M6 4.5h5.5V10" /></svg>;

export const Overview: Story = {
  render: function DesignSystemOverview() {
    const [segment, setSegment] = useState("All");
    const [tab, setTab] = useState("Summary");
    const [account, setAccount] = useState("All accounts");
    const [query, setQuery] = useState("");

    return (
      <div className="storybook-stack storybook-reference-page">
        <SectionHeader heading="h1" eyebrow="Investment OS" title="Design system reference" description="One executable page for the contracts validated visually in Lovable and implemented by production React primitives." />

        <section className="storybook-reference-section" aria-labelledby="foundations-heading">
          <h2 id="foundations-heading">Foundations</h2>
          <p className="storybook-caption">Semantic hierarchy, responsive composition and accessibility are owned by production primitives and canonical tokens.</p>
        </section>

        <section className="storybook-reference-section" aria-labelledby="surfaces-heading">
          <h2 id="surfaces-heading">Surfaces</h2>
          <div className="storybook-grid">
            <Surface surface="primary"><strong>Primary</strong><p>Top-level content surface.</p></Surface>
            <SecondaryBlock><strong>Secondary</strong><p>Nested supporting surface.</p></SecondaryBlock>
            <GlassChrome><strong>Glass</strong><p>Navigation and floating chrome.</p></GlassChrome>
          </div>
          <PrimaryBlock><p>PrimaryBlock keeps the production article/section wrapper contract.</p></PrimaryBlock>
        </section>

        <section className="storybook-reference-section" aria-labelledby="controls-heading">
          <h2 id="controls-heading">Controls</h2>
          <div className="storybook-stack">
            <SearchField value={query} onChange={setQuery} placeholder="Search companies, tickers or analyses" ariaLabel="Search reference" count="3 results" />
            <FilterBar ariaLabel="Reference filters"><SegmentedControl options={["All", "Owned", "Watchlist"].map(value => ({ value, label: value }))} value={segment} onChange={setSegment} ariaLabel="Reference segment" /></FilterBar>
            <Tabs options={["Summary", "Portfolio", "Research"].map(value => ({ value, label: value }))} value={tab} onChange={setTab} ariaLabel="Reference tabs" />
            <div className="storybook-inline">
              <CompactControl variant="select" ariaLabel="Account" value={account} onChange={setAccount} options={[{ value: "All accounts", label: "All accounts" }, { value: "CTO", label: "CTO" }, { value: "PEA", label: "PEA" }]} />
              <CompactControl variant="icon" ariaLabel="Sort" onClick={() => undefined}>{arrow}</CompactControl>
              <ActionButton onClick={() => undefined}>Open reference</ActionButton>
              <BackButton onBack={() => undefined} />
              <DiscoveryAction ariaLabel="Open discovery item" onClick={() => undefined}>{arrow}</DiscoveryAction>
            </div>
          </div>
        </section>

        <section className="storybook-reference-section" aria-labelledby="badges-heading">
          <h2 id="badges-heading">Badges / States</h2>
          <div className="storybook-inline"><Badge>Neutral</Badge><Badge tone="accent">Accent</Badge><Badge tone="positive">Positive</Badge><Badge tone="warning">Warning</Badge><Badge tone="negative">Negative</Badge></div>
          <AsyncState title="No current analysis" description="The state remains explicit and actionable." action={<ActionButton onClick={() => undefined}>Retry</ActionButton>} />
        </section>

        <section className="storybook-reference-section" aria-labelledby="data-heading">
          <h2 id="data-heading">Data display</h2>
          <div className="storybook-grid">
            <StatCard label="Coverage" value="4/5" detail="Current references" />
            <div className="storybook-card"><span className="eyebrow">Progress</span><ProgressBar value={74} tone="positive" label="Coverage 74 percent" /><span className="storybook-caption">74%</span></div>
          </div>
          <MetadataGrid ariaLabel="Reference metadata" items={[{ label: "Sector", value: "Technology" }, { label: "Status", value: <Badge tone="positive">Owned</Badge> }, { label: "Updated", value: "Today" }]} />
          <DataTable ariaLabel="Reference data" columns={[{ key: "name", label: "Name", render: row => row.name }, { key: "status", label: "Status", render: row => <Badge>{row.status}</Badge> }]} rows={[{ id: "example", name: "Example Corp", status: "Current" }]} getRowKey={row => row.id} />
        </section>

        <section className="storybook-reference-section" aria-labelledby="discovery-heading">
          <h2 id="discovery-heading">Discovery cards</h2>
          <div className="storybook-stack">
            <DiscoveryCard kind="company"><strong>Example Corp</strong><p>EXM · Software · Technology</p><Badge tone="positive">Owned</Badge></DiscoveryCard>
            <DiscoveryCard kind="watchlist"><div className="storybook-discovery-head"><div><strong>AMD</strong><Badge>Monitoring</Badge><p>AMD</p></div><DiscoveryAction ariaLabel="Open AMD" onClick={() => undefined}>{arrow}</DiscoveryAction></div><p>Radar card content keeps signals, themes and thesis in the production shell.</p><div className="storybook-inline"><Badge>AI</Badge><Badge>Semiconductors</Badge></div></DiscoveryCard>
            <DiscoveryCard kind="analysis"><strong>Example Corp — Valuation</strong><p>Analysis card with the shared discovery shell.</p><Badge tone="positive">Current</Badge></DiscoveryCard>
          </div>
        </section>

        <section className="storybook-reference-section" aria-labelledby="screens-heading">
          <h2 id="screens-heading">Reference screens</h2>
          <p className="storybook-caption">Company, Radar, Analysis, Portfolio and Reader are separate stories and mount production screens with synthetic fixtures.</p>
        </section>
      </div>
    );
  },
};

