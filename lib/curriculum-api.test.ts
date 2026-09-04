import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCurriculumQuery,
  createCurriculumMutationId,
  curriculumApi,
} from "./curriculum-api";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock("@/lib/api", () => ({ apiFetch: mocks.apiFetch }));

const context = { token: "tenant-token" };

describe("curriculumApi contract", () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
    mocks.apiFetch.mockResolvedValue(null);
  });

  it("build query deterministic, giữ false/0 và bỏ blank/non-finite", () => {
    expect(
      buildCurriculumQuery({
        blank: "  ",
        includeArchived: false,
        invalid: Number.NaN,
        page: 0,
        search: "  Lan  ",
      }),
    ).toBe("?includeArchived=false&page=0&search=Lan");
    expect(buildCurriculumQuery({ search: "Lan", page: 2 })).toBe(
      buildCurriculumQuery({ page: 2, search: " Lan " }),
    );
  });

  it("tạo clientMutationId đúng RFC 4122 UUID v4", () => {
    const ids = Array.from({ length: 20 }, () => createCurriculumMutationId());
    ids.forEach((id) =>
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("đọc curriculum và lesson bằng course-scoped, encoded routes", async () => {
    await curriculumApi.getCurriculum(context, "course/one", {
      includeArchived: true,
    });
    await curriculumApi.getLesson(context, "course/one", "lesson/two");

    expect(mocks.apiFetch.mock.calls).toEqual([
      [
        "/courses/course%2Fone/curriculum?includeArchived=true",
        { token: "tenant-token" },
      ],
      ["/courses/course%2Fone/lessons/lesson%2Ftwo", { token: "tenant-token" }],
    ]);
  });

  it("đọc learner summary và manager progress bằng encoded, bounded query routes", async () => {
    await curriculumApi.getMyProgress(context, "course/one");
    await curriculumApi.getLearnerProgress(context, "course/one", {
      limit: 20,
      page: 2,
      search: "  Nguyễn Lan  ",
    });

    expect(mocks.apiFetch.mock.calls).toEqual([
      ["/courses/course%2Fone/my-progress", { token: "tenant-token" }],
      [
        "/courses/course%2Fone/learner-progress?limit=20&page=2&search=Nguy%E1%BB%85n+Lan",
        {
          token: "tenant-token",
        },
      ],
    ]);
  });

  it("PUT lesson my-progress gửi đúng CAS body và encoded route", async () => {
    await curriculumApi.setLessonProgress(context, "course/one", "lesson/two", {
      completed: true,
      expectedRevision: 0,
    });

    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/courses/course%2Fone/lessons/lesson%2Ftwo/my-progress",
      {
        body: JSON.stringify({ completed: true, expectedRevision: 0 }),
        method: "PUT",
        token: "tenant-token",
      },
    );
  });

  it("create section/lesson gửi idempotency và curriculum revision trong body", async () => {
    await curriculumApi.createSection(context, "course-1", {
      clientMutationId: "mutation-section",
      description: "Mở đầu",
      expectedCurriculumRevision: 3,
      title: "Chương 1",
    });
    await curriculumApi.createLesson(context, "course-1", "section-1", {
      clientMutationId: "mutation-lesson",
      expectedCurriculumRevision: 4,
      required: true,
      textContent: "Nội dung",
      title: "Bài 1",
      type: "TEXT",
    });

    expect(mocks.apiFetch.mock.calls).toEqual([
      [
        "/courses/course-1/curriculum/sections",
        {
          body: JSON.stringify({
            clientMutationId: "mutation-section",
            description: "Mở đầu",
            expectedCurriculumRevision: 3,
            title: "Chương 1",
          }),
          method: "POST",
          token: "tenant-token",
        },
      ],
      [
        "/courses/course-1/curriculum/sections/section-1/lessons",
        {
          body: JSON.stringify({
            clientMutationId: "mutation-lesson",
            expectedCurriculumRevision: 4,
            required: true,
            textContent: "Nội dung",
            title: "Bài 1",
            type: "TEXT",
          }),
          method: "POST",
          token: "tenant-token",
        },
      ],
    ]);
  });

  it("lifecycle section dùng đúng PATCH và POST course-scoped routes", async () => {
    await curriculumApi.updateSection(context, "course/1", "section/1", {
      description: "Mô tả mới",
      expectedRevision: 2,
      title: "Chương mới",
    });
    await curriculumApi.publishSection(context, "course/1", "section/1", {
      expectedRevision: 3,
    });
    await curriculumApi.archiveSection(context, "course/1", "section/1", {
      expectedRevision: 4,
    });

    expect(mocks.apiFetch.mock.calls).toEqual([
      [
        "/courses/course%2F1/curriculum/sections/section%2F1",
        {
          body: JSON.stringify({
            description: "Mô tả mới",
            expectedRevision: 2,
            title: "Chương mới",
          }),
          method: "PATCH",
          token: "tenant-token",
        },
      ],
      [
        "/courses/course%2F1/curriculum/sections/section%2F1/publish",
        {
          body: JSON.stringify({ expectedRevision: 3 }),
          method: "POST",
          token: "tenant-token",
        },
      ],
      [
        "/courses/course%2F1/curriculum/sections/section%2F1/archive",
        {
          body: JSON.stringify({ expectedRevision: 4 }),
          method: "POST",
          token: "tenant-token",
        },
      ],
    ]);
  });

  it("lifecycle lesson dùng đúng PATCH và POST course-scoped routes", async () => {
    await curriculumApi.updateLesson(context, "course/1", "lesson/1", {
      expectedRevision: 2,
      required: false,
      textContent: "Nội dung mới",
      type: "TEXT",
    });
    await curriculumApi.publishLesson(context, "course/1", "lesson/1", {
      expectedRevision: 3,
    });
    await curriculumApi.archiveLesson(context, "course/1", "lesson/1", {
      expectedRevision: 4,
    });

    expect(mocks.apiFetch.mock.calls).toEqual([
      [
        "/courses/course%2F1/lessons/lesson%2F1",
        {
          body: JSON.stringify({
            expectedRevision: 2,
            required: false,
            textContent: "Nội dung mới",
            type: "TEXT",
          }),
          method: "PATCH",
          token: "tenant-token",
        },
      ],
      [
        "/courses/course%2F1/lessons/lesson%2F1/publish",
        {
          body: JSON.stringify({ expectedRevision: 3 }),
          method: "POST",
          token: "tenant-token",
        },
      ],
      [
        "/courses/course%2F1/lessons/lesson%2F1/archive",
        {
          body: JSON.stringify({ expectedRevision: 4 }),
          method: "POST",
          token: "tenant-token",
        },
      ],
    ]);
  });

  it("replace lesson attachments dùng dedicated PUT CAS và giữ nguyên thứ tự ID", async () => {
    await curriculumApi.replaceLessonAttachments(
      context,
      "course/1",
      "lesson/1",
      {
        attachmentIds: ["64b000000000000000000012", "64b000000000000000000011"],
        expectedRevision: 7,
      },
    );

    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/courses/course%2F1/lessons/lesson%2F1/attachments",
      {
        body: JSON.stringify({
          attachmentIds: [
            "64b000000000000000000012",
            "64b000000000000000000011",
          ],
          expectedRevision: 7,
        }),
        method: "PUT",
        token: "tenant-token",
      },
    );
  });
});
