import { AttendanceSelfieReviewPanel } from "./AttendanceSelfieReviewPanel";
import { AttendanceSheetReviewPanel } from "./AttendanceSheetReviewPanel";

export function AdminReviewPage() {
  return (
    <div className="page-stack">
      <AttendanceSheetReviewPanel />
      <AttendanceSelfieReviewPanel />
    </div>
  );
}
