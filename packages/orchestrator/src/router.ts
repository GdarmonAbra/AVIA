import type {
  BuildArtifact,
  DesignProposal,
  TaskState,
  TaskStatus,
  TestReport,
  WorkItemIntent,
} from "@avia/shared-types";

/**
 * Pure reducer for the AVIA task state machine. All side effects — spawning
 * agents, persisting state — live in the outer runner; this module is
 * purely (Event, State) -> State so it's trivially unit-testable.
 */

export type Event =
  | { type: "START"; at: string }
  | { type: "SUMMARY_COMPLETED"; at: string; intent: WorkItemIntent }
  | { type: "DESIGN_COMPLETED"; at: string; proposal: DesignProposal }
  | { type: "USER_APPROVED"; at: string }
  | { type: "USER_REJECTED"; at: string; reason?: string }
  | { type: "DEV_COMPLETED"; at: string; artifact: BuildArtifact }
  | { type: "TEST_COMPLETED"; at: string; report: TestReport }
  | { type: "ABORT"; at: string; reason?: string };

const MAX_DEV_TEST_LOOPS = 3;

export function reduce(state: TaskState, event: Event): TaskState {
  const next = (
    to: TaskStatus,
    patch: Partial<TaskState> = {},
    note?: string,
  ): TaskState => ({
    ...state,
    ...patch,
    status: to,
    updatedAt: event.at,
    history: [
      ...state.history,
      { at: event.at, from: state.status, to, ...(note ? { note } : {}) },
    ],
  });

  switch (event.type) {
    case "START":
      if (state.status !== "created") return state;
      return next("summarizing");

    case "SUMMARY_COMPLETED":
      if (state.status !== "summarizing") return state;
      return next("designing", { intent: event.intent });

    case "DESIGN_COMPLETED":
      if (state.status !== "designing") return state;
      return next("awaiting_user_approval", { proposal: event.proposal });

    case "USER_APPROVED":
      if (state.status !== "awaiting_user_approval") return state;
      return next("developing");

    case "USER_REJECTED":
      if (state.status !== "awaiting_user_approval") return state;
      return next("rejected", {}, event.reason);

    case "DEV_COMPLETED":
      if (state.status !== "developing") return state;
      return next("testing", { artifact: event.artifact });

    case "TEST_COMPLETED": {
      if (state.status !== "testing") return state;
      if (event.report.pass) {
        return next("done", { testReport: event.report });
      }
      if (state.devTestLoops + 1 >= MAX_DEV_TEST_LOOPS) {
        return next(
          "failed",
          { testReport: event.report, devTestLoops: state.devTestLoops + 1 },
          `Exhausted ${MAX_DEV_TEST_LOOPS} dev↔test loops.`,
        );
      }
      return next("developing", {
        testReport: event.report,
        devTestLoops: state.devTestLoops + 1,
      });
    }

    case "ABORT":
      if (state.status === "done" || state.status === "aborted") return state;
      return next("aborted", {}, event.reason);

    default: {
      const _exhaustive: never = event;
      void _exhaustive;
      return state;
    }
  }
}
