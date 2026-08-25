export type UserRole = "SUPER_ADMIN" | "TENANT_ADMIN" | "INSTRUCTOR" | "LEARNER";
export type OrganizationStatus = "ACTIVE" | "SUSPENDED";
export type CourseStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type LmsModule = "USERS" | "COURSES" | "ENROLLMENTS" | "ASSIGNMENTS";

export interface Organization {
  _id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  primaryColor: string;
  logoUrl: string | null;
  enabledModules: LmsModule[];
  createdAt?: string;
}

export interface CurrentUser {
  sub: string;
  email: string;
  fullName: string;
  role: UserRole;
  tenantId?: string;
}

export interface AppUser {
  _id: string;
  email: string;
  fullName: string;
  role: Exclude<UserRole, "SUPER_ADMIN">;
  status: "ACTIVE" | "INACTIVE";
  createdAt?: string;
}

export interface Course {
  _id: string;
  title: string;
  slug: string;
  description: string;
  status: CourseStatus;
  instructorId?: string | Pick<AppUser, "_id" | "fullName" | "email">;
  createdAt?: string;
}

export interface Enrollment {
  _id: string;
  courseId: string | Pick<Course, "_id" | "title" | "slug" | "status">;
  userId: string | Pick<AppUser, "_id" | "fullName" | "email">;
  createdAt?: string;
}

export interface Assignment {
  _id: string;
  courseId: string | Pick<Course, "_id" | "title" | "slug">;
  title: string;
  description: string;
  dueAt?: string;
  published: boolean;
  createdAt?: string;
}

export interface DashboardData {
  scope: "platform" | "tenant" | "learner";
  stats: Array<{ key: string; label: string; value: number; suffix?: string }>;
  recentCourses: Course[];
}

export interface AuthResponse {
  accessToken: string;
  organization: Organization | null;
  user: CurrentUser;
}
