import type { Meta, StoryObj } from "@storybook/react-vite";
import { CompanyDetail } from "../app/components/company-detail";
import { desktopFrame, frame } from "./reference-frame";
import { company, companyDetail } from "./reference-fixtures";

const meta = { title: "Reference screens/Company", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Company: Story = { parameters: { viewport: { defaultViewport: "mobile" } }, render: () => frame(<CompanyDetail companyId={company.id} initialData={companyDetail} close={() => undefined} />) };
export const CompanyDesktop: Story = { parameters: { viewport: { defaultViewport: "desktop" } }, render: () => desktopFrame(<CompanyDetail companyId={company.id} initialData={companyDetail} close={() => undefined} />) };
