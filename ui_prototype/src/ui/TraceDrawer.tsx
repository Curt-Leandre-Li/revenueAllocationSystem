import type { DataRow } from "../domain/types";
import { DetailDrawer } from "./DetailDrawer";
import { TechnicalDetails } from "./TechnicalDetails";

interface TraceDrawerProps {
  open: boolean;
  title: string;
  details: DataRow;
  onClose: () => void;
}

export function TraceDrawer({ open, title, details, onClose }: TraceDrawerProps) {
  return (
    <DetailDrawer open={open} title={title} onClose={onClose}>
      <p className="drawerIntro">
        这里展示第一阶段可用的追溯入口。真实计算轨迹将在后续页面实现中接入服务。
      </p>
      <TechnicalDetails details={details} />
    </DetailDrawer>
  );
}
