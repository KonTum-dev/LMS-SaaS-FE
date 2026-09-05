"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { marketingMessages } from "@/lib/i18n/marketing-messages";

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
  const { t } = useI18n(marketingMessages);
  return (
    <li className={styles.flowCard} data-tone={item.tone}>
      <span aria-hidden="true" className={styles.itemIcon}>
        {item.icon}
      </span>
      <span className={styles.itemCopy}>
        <strong>{t(item.name)}</strong>
        <small>{t(item.description)}</small>
      </span>
      <span className={styles.status}>{t(item.status)}</span>
    </li>
  );
}

function Connector({ label }: { label: string }) {
  const { t } = useI18n(marketingMessages);
  return (
    <div aria-hidden="true" className={styles.connector}>
      <span>{t(label)}</span>
      <i />
    </div>
  );
}

export function EcosystemFlow() {
  const { t } = useI18n(marketingMessages);
  return (
    <section
      aria-labelledby="ecosystem-flow-title"
      className={styles.ecosystem}
    >
      <div className={styles.header}>
        <span className={styles.eyebrow}>{t("LUỒNG TÍCH HỢP DX LMS")}</span>
        <h3 id="ecosystem-flow-title">
          {t("Dữ liệu đi vào một nơi, công việc đi ra đúng luồng")}
        </h3>
        <p>
          {t(
            "Các kết nối phục vụ một workspace trung tâm, nơi dữ liệu tenant, quyền truy cập và trạng thái thuê bao được kiểm soát nhất quán.",
          )}
        </p>
      </div>

      <div className={styles.flow}>
        <section
          aria-labelledby="ecosystem-inputs-title"
          className={styles.lane}
        >
          <div className={styles.laneHeading}>
            <span>01</span>
            <div>
              <small>{t("ĐẦU VÀO")}</small>
              <h4 id="ecosystem-inputs-title">{t("Nguồn dữ liệu vào")}</h4>
            </div>
          </div>
          <ul className={styles.cardList}>
            {inputs.map((item) => (
              <FlowCard item={item} key={item.name} />
            ))}
          </ul>
        </section>

        <Connector label={t("Chuẩn hóa")} />

        <article aria-labelledby="ecosystem-core-title" className={styles.core}>
          <span aria-hidden="true" className={styles.coreStep}>
            02
          </span>
          <div className={styles.coreBrand}>
            <span className={styles.markWrap}>
              <DxBrandMark className={styles.brandMark} />
            </span>
            <span>
              <small>{t("NỀN TẢNG TRUNG TÂM · MULTI-TENANT")}</small>
              <h4 id="ecosystem-core-title">
                {t("Không gian làm việc DX LMS")}
              </h4>
            </span>
          </div>
          <p>
            {t(
              "Một nguồn dữ liệu vận hành chung cho toàn bộ hành trình học tập.",
            )}
          </p>
          <ul className={styles.coreCapabilities}>
            <li>
              <DatabaseOutlined aria-hidden="true" />
              <span>
                <strong>{t("Đa tenant")}</strong>
                <small>{t("Dữ liệu tách biệt theo tổ chức")}</small>
              </span>
            </li>
            <li>
              <SafetyCertificateOutlined aria-hidden="true" />
              <span>
                <strong>{t("Phân quyền")}</strong>
                <small>{t("Vai trò gắn với đúng phạm vi")}</small>
              </span>
            </li>
            <li>
              <SwapOutlined aria-hidden="true" />
              <span>
                <strong>{t("Thuê bao")}</strong>
                <small>{t("Trial, active và gia hạn rõ ràng")}</small>
              </span>
            </li>
          </ul>
          <div className={styles.coreSignal}>
            <i aria-hidden="true" />
            <span>
              <strong>{t("Workspace đang đồng bộ")}</strong>
              <small>{t("Luồng trạng thái được ghi nhận theo sự kiện")}</small>
            </span>
          </div>
        </article>

        <Connector label={t("Kích hoạt")} />

        <section
          aria-labelledby="ecosystem-outputs-title"
          className={styles.lane}
        >
          <div className={styles.laneHeading}>
            <span>03</span>
            <div>
              <small>{t("ĐẦU RA")}</small>
              <h4 id="ecosystem-outputs-title">{t("Kết quả đầu ra")}</h4>
            </div>
          </div>
          <ul className={styles.cardList}>
            {outputs.map((item) => (
              <FlowCard item={item} key={item.name} />
            ))}
          </ul>
        </section>
      </div>

      <aside
        aria-labelledby="ecosystem-foundation-title"
        className={styles.foundation}
      >
        <div className={styles.foundationHeading}>
          <span aria-hidden="true">
            <DatabaseOutlined />
          </span>
          <div>
            <small>{t("HẠ TẦNG NỀN")}</small>
            <h4 id="ecosystem-foundation-title">
              {t("Một lớp kỹ thuật phục vụ toàn bộ luồng")}
            </h4>
          </div>
        </div>
        <ul>
          <li>
            <strong>MongoDB</strong>
            <span>{t("Lưu trữ dữ liệu nghiệp vụ")}</span>
          </li>
          <li>
            <strong>REST API</strong>
            <span>{t("Giao tiếp giữa giao diện và backend")}</span>
          </li>
          <li>
            <strong>JWT</strong>
            <span>{t("Xác thực yêu cầu theo phiên")}</span>
          </li>
          <li>
            <strong>Nginx</strong>
            <span>{t("HTTPS và reverse proxy")}</span>
          </li>
        </ul>
      </aside>
    </section>
  );
}
