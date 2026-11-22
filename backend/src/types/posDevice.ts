// Where an unlock or enrolment came from, recorded on the session and device like a sign-in.
export interface RequestOrigin {
  ipAddress: string;
  userAgent: string | null;
}
