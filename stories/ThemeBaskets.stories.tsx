import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeBaskets } from "../app/components/theme-baskets";
import type { ThemeBasketResponse } from "../app/lib/theme-baskets";
import { ActionButton, AsyncState, CompactControl } from "../app/components/ui-primitives";
import { desktopFrame, frame } from "./reference-frame";

const selectedBasket={
    name:"AI Infrastructure",returnPercent:31.7,memberCount:7,coveredCount:7,ownedCount:3,startDate:"2025-09-23",endDate:"2026-09-22",
    series:[{date:"2025-09-23",value:100},{date:"2025-12-31",value:94},{date:"2026-03-31",value:108},{date:"2026-06-30",value:96},{date:"2026-09-22",value:131.7}],
    companies:[
      {id:"nvda",name:"NVIDIA",ticker:"NVDA",ownershipStatus:"Owned" as const,sector:"Semiconductors",themes:["AI Infrastructure"],returnPercent:48.4},
      {id:"avgo",name:"Broadcom",ticker:"AVGO",ownershipStatus:"Not owned" as const,sector:"Semiconductors",themes:["AI Infrastructure"],returnPercent:26.1},
      {id:"lite",name:"Lumentum Holdings",ticker:"LITE",ownershipStatus:"Owned" as const,sector:"Technology Hardware",themes:["AI Infrastructure"],returnPercent:19.8},
    ],
  };
const sample:ThemeBasketResponse={
  generatedAt:"2026-09-23T09:00:00.000Z",dimension:"theme",period:"1y",refreshErrors:[],details:[selectedBasket],selectedBasket,
  baskets:[
    {name:"AI Infrastructure",returnPercent:31.7,memberCount:7,coveredCount:7,ownedCount:3,startDate:"2025-09-23",endDate:"2026-09-22",searchText:"NVIDIA NVDA Broadcom AVGO Lumentum Holdings LITE"},
    {name:"Cloud Platforms",returnPercent:24.8,memberCount:6,coveredCount:6,ownedCount:2,startDate:"2025-09-23",endDate:"2026-09-22",searchText:""},
    {name:"Semiconductors",returnPercent:22.4,memberCount:12,coveredCount:11,ownedCount:5,startDate:"2025-09-23",endDate:"2026-09-22",searchText:"NVIDIA NVDA Broadcom AVGO"},
    {name:"Power & Cooling",returnPercent:14.6,memberCount:8,coveredCount:7,ownedCount:2,startDate:"2025-09-23",endDate:"2026-09-22",searchText:""},
    {name:"Data Center Networking",returnPercent:9.3,memberCount:5,coveredCount:5,ownedCount:1,startDate:"2025-09-23",endDate:"2026-09-22",searchText:""},
    {name:"Automation",returnPercent:4.1,memberCount:9,coveredCount:8,ownedCount:2,startDate:"2025-09-23",endDate:"2026-09-22",searchText:""},
    {name:"Optical Networking",returnPercent:-4.2,memberCount:4,coveredCount:4,ownedCount:1,startDate:"2025-09-23",endDate:"2026-09-22",searchText:"Lumentum Holdings LITE"},
    {name:"Biotechnology",returnPercent:-12.8,memberCount:3,coveredCount:3,ownedCount:0,startDate:"2025-09-23",endDate:"2026-09-22",searchText:""},
  ],
};

const meta = { title: "Reference screens/Theme Baskets", parameters: { layout: "fullscreen", viewport: { defaultViewport: "mobile" } } } satisfies Meta;
export default meta;
type Story=StoryObj<typeof meta>;

export const Mobile: Story = { render: () => frame(<ThemeBaskets initialData={sample} />) };
export const Desktop: Story = { parameters: { viewport: { defaultViewport: "desktop" } }, render: () => desktopFrame(<ThemeBaskets initialData={sample} />) };
export const Loading: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => frame(<>
    <div className="theme-basket-controls">
      <CompactControl variant="select" ariaLabel="Regrouper les paniers par" value="theme" options={[{ value: "theme", label: "Thèmes" }, { value: "sector", label: "Secteurs" }]} onChange={() => undefined} />
      <CompactControl variant="select" ariaLabel="Période de performance" value="1y" options={[{ value: "1y", label: "1Y" }]} onChange={() => undefined} />
      <ActionButton compact disabled onClick={() => undefined} ariaLabel="Actualiser les cours des paniers">Actualiser</ActionButton>
    </div>
    <AsyncState title="Chargement des paniers…" description="Lecture des cours historiques en cache." className="theme-basket-state" />
  </>),
};
