import type { ReactNode } from "react";
import { AsyncState } from "../app/components/ui-primitives";

export const frame = (children: ReactNode) => (
  <div style={{ width: 390, minHeight: 844, overflow: "hidden" }}>
    <div className="app-shell">
      <section className="content" style={{ marginLeft: 0 }}>
        <div className="content-inner">{children}</div>
      </section>
    </div>
  </div>
);

export const stateFrame = (children: ReactNode) => frame(<div className="storybook-stack">{children}</div>);

export const asyncState = (title: string, description: string) => stateFrame(<AsyncState title={title} description={description} />);
