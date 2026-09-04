"use client";

import {
  ApiOutlined,
  BarChartOutlined,
  BellOutlined,
  CloudUploadOutlined,
  DatabaseOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import type { ReactNode } from "react";
import { DxBrandMark } from "@/components/brand/dx-brand-lockup";
import styles from "./ecosystem-flow.module.css";

interface FlowItem {
  description: string;
  icon: ReactNode;
  name: string;
  status: string;
  tone: "blue" | "cyan" | "green" | "violet";
}

const inputs: readonly FlowItem[] = [
  {
    name: "Firebase Authentication",
    description: "Xác thực và đưa người dùng vào đúng workspace.",
    status: "Đăng nhập",
    tone: "blue",
    icon: <LockOutlined />,
  },
  {
    name: "Nhập dữ liệu CSV",
    description: "Tạo nhanh học viên, lớp học và danh sách ban đầu.",
    status: "Dữ liệu đầu vào",
    tone: "cyan",
    icon: <CloudUploadOutlined />,
  },
  {
    name: "SePay IPN",
    description: "Nhận thông báo thanh toán và cập nhật đối soát.",
    status: "Thanh toán",
    tone: "green",
    icon: <SwapOutlined />,
  },
];

const outputs: readonly FlowItem[] = [
  {
    name: "Webhook tích hợp",
    description: "Đẩy sự kiện đã chọn sang hệ thống bên ngoài.",
    status: "Sự kiện",
    tone: "violet",
    icon: <ApiOutlined />,
  },
  {
    name: "Báo cáo vận hành",
    description: "Tổng hợp tiến độ học, điểm danh và học phí.",
    status: "Ra quyết định",
    tone: "blue",
    icon: <BarChartOutlined />,
  },
  {
    name: "Thông báo theo vai trò",
    description: "Gửi đúng nội dung cho đúng người và đúng phạm vi.",
    status: "Hành động",
    tone: "cyan",
    icon: <BellOutlined />,
  },
];

function FlowCard({ item }: { item: FlowItem }) {
  return (
    <li className={styles.flowCard} data-tone={item.tone}>
      <span aria-hidden="true" className={styles.itemIcon}>
        {item.icon}
      </span>
      <span className={styles.itemCopy}>
        <strong>{item.name}</strong>
        <small>{item.description}</small>
      </span>
      <span className={styles.status}>{item.status}</span>
    </li>
  );
}

function Connector({ label }: { label: string }) {
  return (
    <div aria-hidden="true" className={styles.connector}>
      <span>{label}</span>
      <i />
    </div>
  );
}

export function EcosystemFlow() {
  return (
    <section aria-labelledby="ecosystem-flow-title" className={styles.ecosystem}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>LUỒNG TÍCH HỢP DX LMS</span>
        <h3 id="ecosystem-flow-title">Dữ liệu đi vào một nơi, công việc đi ra đúng luồng</h3>
        <p>
          Các kết nối phục vụ một workspace trung tâm, nơi dữ liệu tenant, quyền truy cập và
          trạng thái thuê bao được kiểm soát nhất quán.
        </p>
      </div>

      <div className={styles.flow}>
        <section aria-labelledby="ecosystem-inputs-title" className={styles.lane}>
          <div className={styles.laneHeading}>
            <span>01</span>
            <div>
              <small>INPUTS</small>
              <h4 id="ecosystem-inputs-title">Nguồn dữ liệu vào</h4>
            </div>
          </div>
          <ul className={styles.cardList}>
            {inputs.map((item) => <FlowCard item={item} key={item.name} />)}
          </ul>
        </section>

        <Connector label="Chuẩn hóa" />

        <article aria-labelledby="ecosystem-core-title" className={styles.core}>
          <span aria-hidden="true" className={styles.coreStep}>02</span>
          <div className={styles.coreBrand}>
            <span className={styles.markWrap}>
              <DxBrandMark className={styles.brandMark} />
            </span>
            <span>
              <small>NỀN TẢNG TRUNG TÂM · MULTI-TENANT</small>
              <h4 id="ecosystem-core-title">DX LMS Workspace</h4>
            </span>
          </div>
          <p>Một nguồn dữ liệu vận hành chung cho toàn bộ hành trình học tập.</p>
          <ul className={styles.coreCapabilities}>
            <li>
              <DatabaseOutlined aria-hidden="true" />
              <span><strong>Đa tenant</strong><small>Dữ liệu tách biệt theo tổ chức</small></span>
            </li>
            <li>
              <SafetyCertificateOutlined aria-hidden="true" />
              <span><strong>Phân quyền</strong><small>Vai trò gắn với đúng phạm vi</small></span>
            </li>
            <li>
              <SwapOutlined aria-hidden="true" />
              <span><strong>Thuê bao</strong><small>Trial, active và gia hạn rõ ràng</small></span>
            </li>
          </ul>
          <div className={styles.coreSignal}>
            <i aria-hidden="true" />
            <span><strong>Workspace đang đồng bộ</strong><small>Luồng trạng thái được ghi nhận theo sự kiện</small></span>
          </div>
        </article>

        <Connector label="Kích hoạt" />

        <section aria-labelledby="ecosystem-outputs-title" className={styles.lane}>
          <div className={styles.laneHeading}>
            <span>03</span>
            <div>
              <small>OUTPUTS</small>
              <h4 id="ecosystem-outputs-title">Kết quả đầu ra</h4>
            </div>
          </div>
          <ul className={styles.cardList}>
            {outputs.map((item) => <FlowCard item={item} key={item.name} />)}
          </ul>
        </section>
      </div>

      <aside aria-labelledby="ecosystem-foundation-title" className={styles.foundation}>
        <div className={styles.foundationHeading}>
          <span aria-hidden="true"><DatabaseOutlined /></span>
          <div>
            <small>HẠ TẦNG NỀN</small>
            <h4 id="ecosystem-foundation-title">Một lớp kỹ thuật phục vụ toàn bộ luồng</h4>
          </div>
        </div>
        <ul>
          <li><strong>MongoDB</strong><span>Lưu trữ dữ liệu nghiệp vụ</span></li>
          <li><strong>REST API</strong><span>Giao tiếp giữa giao diện và backend</span></li>
          <li><strong>JWT</strong><span>Xác thực yêu cầu theo phiên</span></li>
          <li><strong>Nginx</strong><span>HTTPS và reverse proxy</span></li>
        </ul>
      </aside>
    </section>
  );
}
