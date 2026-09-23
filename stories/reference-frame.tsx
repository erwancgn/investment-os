import type { ReactNode } from "react";
import { AsyncState } from "../app/components/ui-primitives";

export const frame = (children: ReactNode) => (
  <div style={{ width: "100%", maxWidth: 390, minHeight: 844, overflow: "hidden" }}>
    <div className="app-shell">
      <section className="content" style={{ marginLeft: 0 }}>
        <div className="content-inner">{children}</div>
      </section>
    </div>
  </div>
);

export const desktopFrame = (children: ReactNode) => (
  <div style={{ width: "100%", minHeight: 900, overflow: "hidden" }}>
    <div className="app-shell">
      <section className="content" style={{ marginLeft: 0 }}>
        <div className="content-inner">{children}</div>
      </section>
    </div>
  </div>
);

export const stateFrame = (children: ReactNode) => frame(<div className="storybook-stack">{children}</div>);

export const asyncState = (title: string, description: string) => stateFrame(<AsyncState title={title} description={description} />);
