// GET /api/version — which build of the API is answering.
//
// The number is the same shape the admin and the POS show in their own
// version line (<major>.<minor>.<commit count>), so a staff member reading
// theirs out and the API's can be compared at a glance — the usual way an
// installed app turns out to be stuck on an old cached build.
export interface AppVersionInfo {
  version: string;
}
