import { Inspector } from "@/ui/inspector/Inspector";
import s from "./RightInspector.module.css";

export function RightInspector() {
  return (
    <div className={s.root}>
      <div className={s.header}>Inspector</div>
      <div className={s.content}>
        <Inspector />
      </div>
    </div>
  );
}
